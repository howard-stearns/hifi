//
//  ScriptableRigStateVariables.cpp
//  libraries/animation/src/
//
//  Created by Howard Stearns on 9/15/15.
//  Copyright (c) 2015 High Fidelity, Inc. All rights reserved.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#include "ScriptableRigStateVariables.h"

// locker allows multiple scripts (and the rig) safe access from different threads.
// Future: dry this up with a macro, and include other AnimVariant types.

bool ScriptableRigStateVariables::get(const QString& key, const bool& defaultValue) const {
    QMutexLocker locker(&_mutex);
    return _hash.contains(key) ? _hash.value(key).getBool() : defaultValue;
}
float ScriptableRigStateVariables::get(const QString& key, const float& defaultValue) const {
    QMutexLocker locker(&_mutex);
    return _hash.contains(key) ? _hash.value(key).getFloat() : defaultValue;
}
void ScriptableRigStateVariables::set(const QString& key, bool value) {
    QMutexLocker locker(&_mutex);
    _hash.insert(key, AnimVariant(value));
}
void ScriptableRigStateVariables::set(const QString& key, float value) {
    QMutexLocker locker(&_mutex);
    _hash.insert(key, AnimVariant(value));
}

void ScriptableRigStateVariables::doHash(std::function<void(const QHash<QString, AnimVariant>& _hash)> functionOfHash) {
    QMutexLocker locker(&_mutex);
    functionOfHash(_hash);
}