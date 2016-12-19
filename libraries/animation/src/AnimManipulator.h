//
//  AnimManipulator.h
//
//  Created by Anthony J. Thibault on 9/8/15.
//  Copyright (c) 2015 High Fidelity, Inc. All rights reserved.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#ifndef hifi_AnimManipulator_h
#define hifi_AnimManipulator_h

#include "AnimNode.h"

// Allows procedural control over a set of joints.

class AnimManipulator : public AnimNode {
public:
    friend class AnimTests;

    AnimManipulator(const QString& id, float alpha);
    virtual ~AnimManipulator() override;

    virtual const AnimPoseVec& evaluate(const AnimVariantMap& animVars, float dt, Triggers& triggersOut) override;
    virtual const AnimPoseVec& overlay(const AnimVariantMap& animVars, float dt, Triggers& triggersOut, const AnimPoseVec& underPoses) override;

    void setAlphaVar(const QString& alphaVar) { _alphaVar = alphaVar; }

    virtual void setSkeletonInternal(AnimSkeleton::ConstPointer skeleton) override;

    struct JointVar {
        enum class Type {
            AbsoluteRotation = 0,
            AbsolutePosition,
            RelativeRotation,
            RelativePosition,
            NumTypes
        };

        JointVar(const QString& varIn, const QString& jointNameIn, Type typeIn) : var(varIn), jointName(jointNameIn), type(typeIn), jointIndex(-1), hasPerformedJointLookup(false) {}
        QString var = "";
        QString jointName = "";
        Type type = Type::AbsoluteRotation;
        int jointIndex = -1;
        bool hasPerformedJointLookup = false;
        bool isRelative = false;
    };

    void addJointVar(const JointVar& jointVar);
    void removeAllJointVars();

protected:
    // for AnimDebugDraw rendering
    virtual const AnimPoseVec& getPosesInternal() const override;

    AnimPose computeRelativePoseFromJointVar(const AnimVariantMap& animVars, const JointVar& jointVar,
                                             const AnimPose& defaultRelPose, const AnimPoseVec& underPoses);

    AnimPoseVec _poses;
    float _alpha;
    QString _alphaVar;

    std::vector<JointVar> _jointVars;

    // no copies
    AnimManipulator(const AnimManipulator&) = delete;
    AnimManipulator& operator=(const AnimManipulator&) = delete;

};

#endif // hifi_AnimManipulator_h
