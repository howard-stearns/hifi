//
//  AvatarManager.cpp
//  interface/src/avatar
//
//  Created by Stephen Birarda on 1/23/2014.
//  Copyright 2014 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#include <string>

#include <QScriptEngine>

#if defined(__GNUC__) && !defined(__clang__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdouble-promotion"
#endif

#include <glm/gtx/string_cast.hpp>

#if defined(__GNUC__) && !defined(__clang__)
#pragma GCC diagnostic pop
#endif


#include <PerfStat.h>
#include <RegisteredMetaTypes.h>
#include <UUID.h>

#include "Application.h"
#include "Avatar.h"
#include "AvatarManager.h"
#include "Menu.h"
#include "MyAvatar.h"
#include "SceneScriptingInterface.h"
#include "AvatarRig.h"

// 70 times per second - target is 60hz, but this helps account for any small deviations
// in the update loop
static const quint64 MIN_TIME_BETWEEN_MY_AVATAR_DATA_SENDS = (1000 * 1000) / 70;

// We add _myAvatar into the hash with all the other AvatarData, and we use the default NULL QUid as the key.
const QUuid MY_AVATAR_KEY;  // NULL key

static QScriptValue localLightToScriptValue(QScriptEngine* engine, const AvatarManager::LocalLight& light) {
    QScriptValue object = engine->newObject();
    object.setProperty("direction", vec3toScriptValue(engine, light.direction));
    object.setProperty("color", vec3toScriptValue(engine, light.color));
    return object;
}

static void localLightFromScriptValue(const QScriptValue& value, AvatarManager::LocalLight& light) {
    vec3FromScriptValue(value.property("direction"), light.direction);
    vec3FromScriptValue(value.property("color"), light.color);
}

void AvatarManager::registerMetaTypes(QScriptEngine* engine) {
    qScriptRegisterMetaType(engine, localLightToScriptValue, localLightFromScriptValue);
    qScriptRegisterSequenceMetaType<QVector<AvatarManager::LocalLight> >(engine);
}

#define TARGET_FPS 75.0f
#define TARGET_PERIOD_MS (1000.0f / TARGET_FPS)
AvatarManager::AvatarManager(QObject* parent) :
    _avatarFades()
{
    // register a meta type for the weak pointer we'll use for the owning avatar mixer for each avatar
    qRegisterMetaType<QWeakPointer<Node> >("NodeWeakPointer");
    _myAvatar = std::make_shared<MyAvatar>(std::make_shared<AvatarRig>());
    _renderDistanceController.setMeasuredValueSetpoint(TARGET_PERIOD_MS); //FIXME
    const float TREE_SCALE = 32768.0f; // Not in shared library, alas.
    const float SMALLEST_REASONABLE_HORIZON = 0.5f; // FIXME 5
    _renderDistanceController.setControlledValueHighLimit(1.0f/SMALLEST_REASONABLE_HORIZON);
    _renderDistanceController.setControlledValueLowLimit(1.0f/TREE_SCALE);

    // Advice for tuning parameters:
    // See PIDController.h. There's a sectionon tuning in the reference.
    // Turn off HYSTERESIS_PROPORTION and extra logging by defining PID_TUNING in Avatar.cpp.
    // Turn on logging with the following:
    _renderDistanceController.setHistorySize("avatar render", TARGET_FPS * 4); // FIXME
    // KP is usually tuned by setting the other constants to zero, finding the maximum value that doesn't oscillate,
    // and taking about 0.6 of that. A typical osciallation would be with error=37fps with avatars 10m away, so
    // KP*37=1/10 => KP(oscillating)=0.1/37 = 0.0027
    //_renderDistanceController.setKP(0.0015f);
    // alt: 
    // Our anti-windup limits accumulated error to 10*targetFrameRate, so the sanity check on KI is
    // KI*750=controlledValueHighLimit=1 => KI=1/750.
    //_renderDistanceController.setKI(0.001);

    auto& packetReceiver = DependencyManager::get<NodeList>()->getPacketReceiver();
    packetReceiver.registerListener(PacketType::BulkAvatarData, this, "processAvatarDataPacket");
    packetReceiver.registerListener(PacketType::KillAvatar, this, "processKillAvatar");
    packetReceiver.registerListener(PacketType::AvatarIdentity, this, "processAvatarIdentityPacket");
    packetReceiver.registerListener(PacketType::AvatarBillboard, this, "processAvatarBillboardPacket");
}

void AvatarManager::init() {
    _myAvatar->init();
    {
        QWriteLocker locker(&_hashLock);
        _avatarHash.insert(MY_AVATAR_KEY, _myAvatar);
    }

    connect(DependencyManager::get<SceneScriptingInterface>().data(), &SceneScriptingInterface::shouldRenderAvatarsChanged, this, &AvatarManager::updateAvatarRenderStatus, Qt::QueuedConnection);

    render::ScenePointer scene = qApp->getMain3DScene();
    render::PendingChanges pendingChanges;
    if (DependencyManager::get<SceneScriptingInterface>()->shouldRenderAvatars()) {
        _myAvatar->addToScene(_myAvatar, scene, pendingChanges);
    }
    scene->enqueuePendingChanges(pendingChanges);
}

void AvatarManager::updateMyAvatar(float deltaTime) {
    bool showWarnings = Menu::getInstance()->isOptionChecked(MenuOption::PipelineWarnings);
    PerformanceWarning warn(showWarnings, "AvatarManager::updateMyAvatar()");

    _myAvatar->update(deltaTime);

    quint64 now = usecTimestampNow();
    quint64 dt = now - _lastSendAvatarDataTime;

    if (dt > MIN_TIME_BETWEEN_MY_AVATAR_DATA_SENDS) {
        // send head/hand data to the avatar mixer and voxel server
        PerformanceTimer perfTimer("send");
        _myAvatar->sendAvatarDataPacket();
        _lastSendAvatarDataTime = now;
    }
}

void AvatarManager::updateOtherAvatars(float deltaTime) {
    if (_avatarHash.size() < 2 && _avatarFades.isEmpty()) {
        return;
    }
    bool showWarnings = Menu::getInstance()->isOptionChecked(MenuOption::PipelineWarnings);
    PerformanceWarning warn(showWarnings, "Application::updateAvatars()");

    PerformanceTimer perfTimer("otherAvatars");
    const float FEED_FORWARD_RANGE = 2;
    const float fps = qApp->getLastInstanteousFps();
    const float paintWait = qApp->getLastDisplayPeriod() / 1000.0f;
    //const float modularizedPeriod = floor((1000.0f / std::min(fps, TARGET_FPS)) / TARGET_PERIOD_MS) * TARGET_PERIOD_MS;
    // measured value: 1) bigger => more desirable plant activity (i.e., more rendering), 2) setpoint=TARGET_PERIOD_MS=13.333
    // single vsync: no load=>1or2. high load=>12or13
    // over vsync: just over: 13. way over: 14...15...16
    //const float effective = ((1000.0f / fps) < TARGET_PERIOD_MS) ? (TARGET_PERIOD_MS - paintWait) : ((2.0f * TARGET_PERIOD_MS) - paintWait);
    const float effective = qApp->getLastDeducedNonVSyncFps();
    const bool isAtSetpoint = false; //FIXME fabsf(effectiveFps - _renderDistanceController.getMeasuredValueSetpoint()) < FEED_FORWARD_RANGE;
    const float distance = 1.0f / _renderDistanceController.update(effective + (isAtSetpoint ? _renderFeedForward : 0.0f), deltaTime, isAtSetpoint, fps, paintWait);

    const float RENDER_DISTANCE_DEADBAND = 1.0f; //FIXME 0.3f; // meters
    if (fabsf(distance - _renderDistance) > RENDER_DISTANCE_DEADBAND) {
        _renderDistance = distance;
    }

    // simulate avatars
    AvatarHash::iterator avatarIterator = _avatarHash.begin();
    int renderableCount = 0;
    while (avatarIterator != _avatarHash.end()) {
        auto avatar = std::dynamic_pointer_cast<Avatar>(avatarIterator.value());

        if (avatar == _myAvatar || !avatar->isInitialized()) {
            // DO NOT update _myAvatar!  Its update has already been done earlier in the main loop.
            // DO NOT update or fade out uninitialized Avatars
            ++avatarIterator;
        } else if (avatar->shouldDie()) {
            removeAvatarMotionState(avatar);
            _avatarFades.push_back(avatarIterator.value());
            QWriteLocker locker(&_hashLock);
            avatarIterator = _avatarHash.erase(avatarIterator);
        } else {
            avatar->startUpdate();
            avatar->simulate(deltaTime);
            if (!avatar->getShouldSkipRendering()) {
                renderableCount++;
            }
            avatar->endUpdate();
            ++avatarIterator;
        }
    }
    _renderedAvatarCount = renderableCount;

    // simulate avatar fades
    simulateAvatarFades(deltaTime);
}

void AvatarManager::simulateAvatarFades(float deltaTime) {
    QVector<AvatarSharedPointer>::iterator fadingIterator = _avatarFades.begin();

    const float SHRINK_RATE = 0.9f;
    const float MIN_FADE_SCALE = 0.001f;

    render::ScenePointer scene = qApp->getMain3DScene();
    render::PendingChanges pendingChanges;
    while (fadingIterator != _avatarFades.end()) {
        auto avatar = std::static_pointer_cast<Avatar>(*fadingIterator);
        avatar->startUpdate();
        avatar->setTargetScale(avatar->getScale() * SHRINK_RATE, true);
        if (avatar->getTargetScale() < MIN_FADE_SCALE) {
            avatar->removeFromScene(*fadingIterator, scene, pendingChanges);
            fadingIterator = _avatarFades.erase(fadingIterator);
        } else {
            avatar->simulate(deltaTime);
            ++fadingIterator;
        }
        avatar->endUpdate();
    }
    scene->enqueuePendingChanges(pendingChanges);
}

AvatarSharedPointer AvatarManager::newSharedAvatar() {
    return AvatarSharedPointer(std::make_shared<Avatar>(std::make_shared<AvatarRig>()));
}

// virtual
AvatarSharedPointer AvatarManager::addAvatar(const QUuid& sessionUUID, const QWeakPointer<Node>& mixerWeakPointer) {
    auto avatar = std::dynamic_pointer_cast<Avatar>(AvatarHashMap::addAvatar(sessionUUID, mixerWeakPointer));
    render::ScenePointer scene = qApp->getMain3DScene();
    render::PendingChanges pendingChanges;
    if (DependencyManager::get<SceneScriptingInterface>()->shouldRenderAvatars()) {
        avatar->addToScene(avatar, scene, pendingChanges);
    }
    scene->enqueuePendingChanges(pendingChanges);
    return avatar;
}

// protected
void AvatarManager::removeAvatarMotionState(AvatarSharedPointer avatar) {
    auto rawPointer = std::static_pointer_cast<Avatar>(avatar);
    AvatarMotionState* motionState = rawPointer->getMotionState();
    if (motionState) {
        // clean up physics stuff
        motionState->clearObjectBackPointer();
        rawPointer->setMotionState(nullptr);
        _avatarMotionStates.remove(motionState);
        _motionStatesToAdd.remove(motionState);
        _motionStatesToDelete.push_back(motionState);
    }
}

// virtual
void AvatarManager::removeAvatar(const QUuid& sessionUUID) {
    AvatarHash::iterator avatarIterator = _avatarHash.find(sessionUUID);
    if (avatarIterator != _avatarHash.end()) {
        std::shared_ptr<Avatar> avatar = std::dynamic_pointer_cast<Avatar>(avatarIterator.value());
        if (avatar != _myAvatar && avatar->isInitialized()) {
            removeAvatarMotionState(avatar);
            _avatarFades.push_back(avatarIterator.value());
            QWriteLocker locker(&_hashLock);
            _avatarHash.erase(avatarIterator);
        }
    }
}

void AvatarManager::clearOtherAvatars() {
    // clear any avatars that came from an avatar-mixer
    AvatarHash::iterator avatarIterator =  _avatarHash.begin();
    while (avatarIterator != _avatarHash.end()) {
        auto avatar = std::static_pointer_cast<Avatar>(avatarIterator.value());
        if (avatar == _myAvatar || !avatar->isInitialized()) {
            // don't remove myAvatar or uninitialized avatars from the list
            ++avatarIterator;
        } else {
            removeAvatarMotionState(avatar);
            _avatarFades.push_back(avatarIterator.value());
            QWriteLocker locker(&_hashLock);
            avatarIterator = _avatarHash.erase(avatarIterator);
        }
    }
    _myAvatar->clearLookAtTargetAvatar();
}

void AvatarManager::setLocalLights(const QVector<AvatarManager::LocalLight>& localLights) {
    if (QThread::currentThread() != thread()) {
        QMetaObject::invokeMethod(this, "setLocalLights", Q_ARG(const QVector<AvatarManager::LocalLight>&, localLights));
        return;
    }
    _localLights = localLights;
}

QVector<AvatarManager::LocalLight> AvatarManager::getLocalLights() const {
    if (QThread::currentThread() != thread()) {
        QVector<AvatarManager::LocalLight> result;
        QMetaObject::invokeMethod(const_cast<AvatarManager*>(this), "getLocalLights", Qt::BlockingQueuedConnection,
            Q_RETURN_ARG(QVector<AvatarManager::LocalLight>, result));
        return result;
    }
    return _localLights;
}

QVector<QUuid> AvatarManager::getAvatarIdentifiers() {
    QReadLocker locker(&_hashLock);
    return _avatarHash.keys().toVector();
}
AvatarData* AvatarManager::getAvatar(QUuid avatarID) {
    QReadLocker locker(&_hashLock);
    return _avatarHash[avatarID].get();  // Non-obvious: A bogus avatarID answers your own avatar.
}


void AvatarManager::getObjectsToDelete(VectorOfMotionStates& result) {
    result.clear();
    result.swap(_motionStatesToDelete);
}

void AvatarManager::getObjectsToAdd(VectorOfMotionStates& result) {
    result.clear();
    for (auto motionState : _motionStatesToAdd) {
        result.push_back(motionState);
    }
    _motionStatesToAdd.clear();
}

void AvatarManager::getObjectsToChange(VectorOfMotionStates& result) {
    result.clear();
    for (auto state : _avatarMotionStates) {
        if (state->_dirtyFlags > 0) {
            result.push_back(state);
        }
    }
}

void AvatarManager::handleOutgoingChanges(const VectorOfMotionStates& motionStates) {
    // TODO: extract the MyAvatar results once we use a MotionState for it.
}

void AvatarManager::handleCollisionEvents(const CollisionEvents& collisionEvents) {
    for (Collision collision : collisionEvents) {
        // TODO: The plan is to handle MOTIONSTATE_TYPE_AVATAR, and then MOTIONSTATE_TYPE_MYAVATAR. As it is, other
        // people's avatars will have an id that doesn't match any entities, and one's own avatar will have
        // an id of null. Thus this code handles any collision in which one of the participating objects is
        // my avatar. (Other user machines will make a similar analysis and inject sound for their collisions.)
        if (collision.idA.isNull() || collision.idB.isNull()) {
            MyAvatar* myAvatar = getMyAvatar();
            const QString& collisionSoundURL = myAvatar->getCollisionSoundURL();
            if (!collisionSoundURL.isEmpty()) {
                const float velocityChange = glm::length(collision.velocityChange);
                const float MIN_AVATAR_COLLISION_ACCELERATION = 0.01f;
                const bool isSound = (collision.type == CONTACT_EVENT_TYPE_START) && (velocityChange > MIN_AVATAR_COLLISION_ACCELERATION);

                if (!isSound) {
                    return;  // No sense iterating for others. We only have one avatar.
                }
                // Your avatar sound is personal to you, so let's say the "mass" part of the kinetic energy is already accounted for.
                const float energy = velocityChange * velocityChange;
                const float COLLISION_ENERGY_AT_FULL_VOLUME = 0.5f;
                const float energyFactorOfFull = fmin(1.0f, energy / COLLISION_ENERGY_AT_FULL_VOLUME);

                // For general entity collisionSoundURL, playSound supports changing the pitch for the sound based on the size of the object,
                // but most avatars are roughly the same size, so let's not be so fancy yet.
                const float AVATAR_STRETCH_FACTOR = 1.0f;

                AudioInjector::playSound(collisionSoundURL, energyFactorOfFull, AVATAR_STRETCH_FACTOR, myAvatar->getPosition());
                myAvatar->collisionWithEntity(collision);
                return;            }
        }
    }
}

void AvatarManager::updateAvatarPhysicsShape(const QUuid& id) {
    AvatarHash::iterator avatarItr = _avatarHash.find(id);
    if (avatarItr != _avatarHash.end()) {
        auto avatar = std::static_pointer_cast<Avatar>(avatarItr.value());
        AvatarMotionState* motionState = avatar->getMotionState();
        if (motionState) {
            motionState->addDirtyFlags(Simulation::DIRTY_SHAPE);
        } else {
            ShapeInfo shapeInfo;
            avatar->computeShapeInfo(shapeInfo);
            btCollisionShape* shape = ObjectMotionState::getShapeManager()->getShape(shapeInfo);
            if (shape) {
                AvatarMotionState* motionState = new AvatarMotionState(avatar.get(), shape);
                avatar->setMotionState(motionState);
                _motionStatesToAdd.insert(motionState);
                _avatarMotionStates.insert(motionState);
            }
        }
    }
}

void AvatarManager::updateAvatarRenderStatus(bool shouldRenderAvatars) {
    if (DependencyManager::get<SceneScriptingInterface>()->shouldRenderAvatars()) {
        for (auto avatarData : _avatarHash) {
            auto avatar = std::dynamic_pointer_cast<Avatar>(avatarData);
            render::ScenePointer scene = qApp->getMain3DScene();
            render::PendingChanges pendingChanges;
            avatar->addToScene(avatar, scene, pendingChanges);
            scene->enqueuePendingChanges(pendingChanges);
        }
    } else {
        for (auto avatarData : _avatarHash) {
            auto avatar = std::dynamic_pointer_cast<Avatar>(avatarData);
            render::ScenePointer scene = qApp->getMain3DScene();
            render::PendingChanges pendingChanges;
            avatar->removeFromScene(avatar, scene, pendingChanges);
            scene->enqueuePendingChanges(pendingChanges);
        }
    }
}


AvatarSharedPointer AvatarManager::getAvatarBySessionID(const QUuid& sessionID) {
    if (sessionID == _myAvatar->getSessionUUID()) {
        return std::static_pointer_cast<Avatar>(_myAvatar);
    }
    QReadLocker locker(&_hashLock);
    auto iter = _avatarHash.find(sessionID);
    if (iter != _avatarHash.end()) {
        return iter.value();
    } else {
        return AvatarSharedPointer();
    }
}
