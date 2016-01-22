"use strict";
/*jslint nomen: true, plusplus: true, vars: true */
/*global Entities, Script, MyAvatar, print */

// Provides utilities claim, renewingEdit and release of ownership of a key in and entity, for use among cooperating scripts
// in both repeating and event-driven code. For example,
// * An entity with an entity script may have a Script.update.connect or Script.setInterval function that repeatedly changes
//   properties of the entity. The exported claim function can be used to start the update or interval function in only one
//   of the entity scripts.
// * An interface script used by many people can use the exported claim function to ensure that only one person can operate
//   on an entity at a time (e.g., when multiple people click on the entity).
//
// The goal here is to efficiently avoid duplication of work. It does not absolutely prevent some overlapping edits.


/* Some of the cases:

A    writes A0 
     |     reads B1 - looses            NORMAL CASE
     V     ^                            A bids and loses.
time 0 1 2 3                            B bids and wins.
       ^   V
       |   reads B1 - wins
B      writes B1

-------------------------------------------------------------------

A    writes A0                           SHIFT CASE
     |     reads A0 - wins               A thinks it is owner, but fails when it tries to write.
     |     ^     reads B0 - releases       It cooperatively releases at that time.
     V     |     ^                       B thinks it is owner and continues
time 0 1 2 3 4 5 6                       (Unfortunately, this leaves the SLOW machine in charge!)
       ^     ^   V
       |     |   reads B1
       |     server receives B1
B      writes B1 but isn't received at entity server yet

-------------------------------------------------------------------

A    writes A0                           INTERLEAVED CASE
     |     reads A0 - wins               Both think they win, and both writes interleave each other
     |     ^       writes A7             Assumption is that we cannot be so unlucky for very long.
     |     |       |                     Eventually resolves, with some duplicate work.
     |     |       |   has not received B8, sees A7 still, and writes A9
     V     |       V   V
time 0 1 2 3 4 5 6 7 8 9 10
       ^     ^   |   ^   ^
       |     |   |   |   has not received A7, see B8 still, and writes B10
       |     |   V   writes B8
       |     |   reads B1 - wins
       |     server receives B1
B      writes B1 but isn't received at entity server yet

Variations arise when there are 100 participants....

*/


// Answers a an object with the exported functions, and accepts an object that can either be the key string or an object to be
// that the exported functions will be added to (and from which non-default parameters can be specified).
// (The 'ownerModule =' is required due to the way Script.include works.)
ownerModule = function ownerModule(exportsObjectOrKey) {
    var exports = ('string' === typeof exportsObjectOrKey) ? {} : exportsObjectOrKey,
        // Script can call ownerModule with different keys.
        key = (exports === exportsObjectOrKey) ? exports.keyString : exportsObjectOrKey,
        OWNERSHIP_DATA_KEY = exports.ownershipDataKey || 'io.highFidelity.owner', // Must be unique among user data.

        // Others can assume the owner has disconnected and claim ownership if the owner has not done a renewingEdit in this time.
        // Time is in ms and spans upload from owner, download to owner, Interface client time skew, and all service delays.
        HEARTBEAT_PERIOD = exports.heartbeatPeriod || 5000,

        // How quickly we notice a release while we're waiting, in ms.
        // The timing does not effect network load, but only how often the including script does a getEntityProperties.
        PICKUP_RESPONSIVENESS = exports.pickupResponsiveness || 250,

        // How long we sit on a request before seeing if we've won, in ms.
        // This needs to be long enough for all participants to enter a claim and for the broadcasted results to reach each claimant.
        REQUEST_ALLOWANCE = exports.requestAllowance || 500,

        deleted = 'deleted', // a flag
        handlers = {}; // per entity
    function debug() {
        //print([].map.call(arguments, JSON.stringify));
    }

    // We currently keep ownership information in userData.
    function getOwnershipData(entityId) {
        var properties = Entities.getEntityProperties(entityId, ['userData', 'type']),
            userDataString = properties.userData,
            userData = userDataString ? JSON.parse(userDataString) : {},
            allOwnershipData = userData[OWNERSHIP_DATA_KEY] || {}; // data for all calls of ownerModule(key)
        debug('getOwnershipData', userDataString, allOwnershipData);
        if (properties.type === 'Unknown') {
            return deleted;
        }
        return allOwnershipData[key]; // Just for our key.
    }
    function setOwnershipData(entityId, keySpecificOwnershipData, properties) {
        var userDataString = ((properties.userData !== undefined) ? properties :
                              Entities.getEntityProperties(entityId, ['userData'])).userData,
            userData = userDataString ? JSON.parse(userDataString) : {}, // Might be other userData.
            allOwnershipData = userData[OWNERSHIP_DATA_KEY] || {}, // Might have other keys in play.
            existingKeySpecificData = allOwnershipData[key] || {};

        debug('setOwnership', entityId, existingKeySpecificData, userDataString);

        // Here is the weak link.
        // Network or computer delays can allow a participant to make a claim that arrives after someone else has
        // already successfully become owner. This will result in one or both parties to fail the following
        // test when they attempt to write data:
        if (existingKeySpecificData.owner &&
            (existingKeySpecificData.owner !== MyAvatar.sessionUUID) &&
            ((Date.now() - existingKeySpecificData.timestamp) <= HEARTBEAT_PERIOD)) { // Why is this test needed?
            print("Warning: when setting " + JSON.stringify(keySpecificOwnershipData) + " in " + JSON.stringify(properties) + ", " +
                  existingKeySpecificData.owner +
                  " assumed ownership of " + (Entities.getEntityProperties(entityId, ['name']).name || 'unknown') + " (" + entityId +
                  ") " + (Date.now() - existingKeySpecificData.timestamp) + "ms ago while we thought we had ownership. " +
                  "Releasing without writing data to network.");
            // Design choice: we cannot renew ownership here, but should we send the data anyway?
            // I think it is safer if we do. Alternatively, we could just return after release (which can then be synchronous).
            var handlerData = handlers[entityId];
            if (handlerData) {
                Script.setTimeout(function () {
                    handlerData.onRelease();  // Don't remove handlers...
                    waitForUnowned(entityId); // ... and go back to waiting.
                }, 0); // After the edit is made, below.
            }
        } else { // only if we're not releasing, so that we don't wipe out the other owner

            if (keySpecificOwnershipData) {
                allOwnershipData[key] = keySpecificOwnershipData;
            } else {  // releasing
                delete allOwnershipData[key];
            }
            if (Object.keys(allOwnershipData).length) {
                userData[OWNERSHIP_DATA_KEY] = allOwnershipData;
            } else { // clean up userData when the last key is removed
                delete userData[OWNERSHIP_DATA_KEY];
            }
            properties.userData = Object.keys(userData).length ? JSON.stringify(userData) : ''; // never undefined
        }

        Entities.editEntity(entityId, properties);
    }

    function waitForUnowned(entityId) { // For internal use after callbacks have been recorded.
        function loop() {
            debug('waitForUnowned loop', entityId);
            // This handles someone leaving AND it handles an explicit release. An alternate implementation might have claim
            // subscribe(key) and explicit release sendMessage(key, 'released') so that it would be "instantly" known.
            // (The case of someone disconnecting would still be slow in its response time.)
            var ownershipData = getOwnershipData(entityId);
            if (ownershipData === deleted) { return; }
            // explictly unowned or expired (e.g., owner left)
            if (!ownershipData || ((Date.now() - ownershipData.timestamp) > HEARTBEAT_PERIOD)) {
                requestOwnership(entityId);
            } else {
                Script.setTimeout(loop, PICKUP_RESPONSIVENESS);
            }
        }
        loop();
    }
    function requestOwnership(entityId) {
        debug('requestOwnership', entityId);
        // Available right now (by construction), but a competing claim could be in flight.
        exports.renewingEdit(entityId); // Exactly like ownership, but don't invoke callbacks yet.
        Script.setTimeout(function () { // wait for others to request. The LAST one round trip before REQUEST_ALLOWANCE wins.
            var ownershipData = getOwnershipData(entityId);
            if (ownershipData === deleted) { return; }
            if (ownershipData && (ownershipData.owner === MyAvatar.sessionUUID) && handlers[entityId]) { // Still me! I win!
                // If our sessionUUID has changed due to a disconnect, we have to wait for an expiration just like any
                // other owner being disconnected.
                debug('acquired', entityId, key);
                handlers[entityId].onAcquire();
            } else { // Someone else won. Wait for it.
                waitForUnowned(entityId);
            }
        }, REQUEST_ALLOWANCE);
    }

    // Claim exclusive ownership of key in the entity specified by entityId. Invokes the onAcquire callback whenver ownership is
    // acquired (which may be never). Invokes onRelease when ownership is lost -- either by an explicit release or a heartbeat
    // timeout (see renewingEdit). The attempt to claim (and the onAquire/onRelease callbacks) remain in place until explicitly
    // released. (This makes it easier for applications to tolerate network outages.)
    // 
    // Note:
    // * Applications cannot rely on onRelease being invoked by the owner, as the client may have quit.
    // * You claim a key (an arbitrary opaque string) in use by cooperating scripts. You do _not_ claim an entity property.
    //   Thus there's nothing to keep anyone from editing a property in the normal way, without ownership.
    //   Note that entityScripts/keepAway.js uses two invocations of ownerModule with different keys, and the owning processes
    //   associated with each have different lifetimes, and both write to velocity in their own way.
    exports.claim = function claim(entityId, onAcquire, onRelease) {
        debug('claim', entityId);
        if (handlers[entityId]) {
            print("Warning: replacing existing claim. You should first release('" + entityId + "', '" + key + "').");
        }
        handlers[entityId] = {onAcquire: onAcquire, onRelease: onRelease};
        waitForUnowned(entityId);
    };

    // Synchronously invokes onRelease (which must have been set by a successful claim), and arrange to not invoke onAcquire
    // or onRelease any more. (Clients can make a new claim, of course.)
    exports.release = function release(entityId) {
        var callbacks = handlers[entityId],
            ownership = getOwnershipData(entityId);
        debug('release', entityId);
        delete handlers[entityId];
        if (ownership && (ownership.owner === MyAvatar.sessionUUID)) {  // Pun: ('deleted').owner is undefined
            setOwnershipData(entityId, null, {}); // remove tag if it is still not me
        }
        if (!callbacks) {
            print("Attempt to release '" + key + "' in " + entityId + " without ownership.");
            return;
        }
        callbacks.onRelease();
    };

    // Just like Entities.editEntity, but the ownership of key is re-asserted, which prevents anyone else from
    // acquiring ownership of key for one HEARTBEAT_PERIOD. Caller must already have already succesfully
    // claim'd ownership of key. Side-effects properties with new/changed userData.
    exports.renewingEdit = function renewingEdit(entityId, optionalProperties) {
        debug('renewingEdit', entityId, JSON.stringify(optionalProperties));
        // HighFidelity tolerates machine/network failures, so a heartbeat is necessary to know that
        // an owner has gone away.
        setOwnershipData(entityId, {owner: MyAvatar.sessionUUID, timestamp: Date.now()}, optionalProperties || {});
    };

    return exports;
}
