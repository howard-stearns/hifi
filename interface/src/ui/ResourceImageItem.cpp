//
//  ResourceImageItem.cpp
//  interface/src/ui
//
//  Created by Howard Stearns on 2017/06/08
//  Copyright 2017 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

#include <functional>
#include <OffscreenUi.h>
#include "ResourceImageItem.h"

HIFI_QML_DEF(ResourceImageItem)

class ResourceImageRenderer : QQuickFramebufferObject::Renderer {
    friend class ResourceImageItem;
protected:
    ResourceImageRenderer() : QQuickFramebufferObject::Renderer() { };
    void render() {};
};


ResourceImageItem::ResourceImageItem(QQuickItem* parent) : QQuickFramebufferObject(parent) { }

QUrl ResourceImageItem::getSource() const {
    return _source;
}
void ResourceImageItem::setSource(const QUrl& source) {
    _source = source;
    emit sourceChanged();
}

QQuickFramebufferObject::Renderer *ResourceImageItem::createRenderer() const {
    return new ResourceImageRenderer();
}
