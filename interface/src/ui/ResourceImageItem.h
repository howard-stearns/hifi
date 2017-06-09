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

#include <QQuickFramebufferObject>
#include <OffscreenQmlElement.h>

class ResourceImageItem : public QQuickFramebufferObject {
    Q_OBJECT
    HIFI_QML_DECL
    Q_PROPERTY(QUrl source READ getSource WRITE setSource NOTIFY sourceChanged)
public:
    ResourceImageItem(QQuickItem* parent = nullptr);
    Renderer *createRenderer() const;
    QUrl getSource() const;
    void setSource(const QUrl& url);
signals:
    void sourceChanged();
private:
    QUrl _source{};
};

#endif
