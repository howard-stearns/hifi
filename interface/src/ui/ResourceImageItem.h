//
//  ResourceImageItem.cpp
//  interface/src/ui
//
//  Created by Howard Stearns on 2017/06/08
//  Copyright 2017 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

#pragma once
#ifndef hifi_ResourceImageItem_h
#define hifi_ResourceImageItem_h

// fixme: replace with QQuickFramebufferObject
#include <OffscreenQmlElement.h>

class ResourceImageItem : public QQuickItem {
    Q_OBJECT
    HIFI_QML_DECL
public:
    ResourceImageItem(QQuickItem* parent = nullptr);
};

#endif