//
//  ScriptableRigStateVariables.h
//  libraries/animation/src/
//
//  Created by Howard Stearns on 9/15/15.
//  Copyright (c) 2015 High Fidelity, Inc. All rights reserved.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#ifndef hifi_ScriptableRigStateVariables_h
#define hifi_ScriptableRigStateVariables_h

#include <functional>
#include <QObject>
#include <QMutex>
#include <QString>
#include "AnimVariant.h"

class ScriptableRigStateVariables : public QObject {
    Q_OBJECT
public:
    // Note that Javascript [] notation affects QObject properties, not any operator[] that might be defined here.
    Q_INVOKABLE bool get(const QString& key, const bool& defaultValue) const;
    Q_INVOKABLE float get(const QString& key, const float& defaultValue) const;
    Q_INVOKABLE void set(const QString& key, bool value);
    Q_INVOKABLE void set(const QString& key, float value);
    void doHash(std::function<void(const QHash<QString, AnimVariant>& hash)> functionOfHash); // Safe access of hash, using lambda.
private:
    mutable QMutex _mutex;
    QHash<QString, AnimVariant> _hash {};
};
Q_DECLARE_METATYPE(ScriptableRigStateVariables*);

#endif
