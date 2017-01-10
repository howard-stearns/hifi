//
//  NameCard.qml
//  qml/hifi
//
//  Created by Howard Stearns on 12/9/2016
//  Copyright 2016 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

import Hifi 1.0 as Hifi
import QtQuick 2.5
import QtGraphicalEffects 1.0
import "../styles-uit"

Row {
    id: thisNameCard
    // Spacing
    spacing: 10
    // Anchors
    anchors.top: parent.top
    anchors {
        topMargin: (parent.height - contentHeight)/2
        bottomMargin: (parent.height - contentHeight)/2
        leftMargin: 10
        rightMargin: 10
    }

    // Properties
    property int contentHeight: 50
    property string displayName: ""
    property string userName: ""
    property int displayTextHeight: 18
    property int usernameTextHeight: 12
    property real audioLevel: 0.0
    property string defaultImage: "../../icons/defaultNameCardUser.png"
    property string  imageUrl: ""
    property var imageAction: function() { }
    property string imageActionTarget: ''
    property string imageMaskColor: "white"

    Rectangle { // containing rectangle with specific width
        width: contentHeight
        height: contentHeight
        clip: true
        id: avatarImage
        Image {
            id: userImage
            source: imageUrl || defaultImage
            anchors.fill: parent
        }
        // I can't get OpacityMask to work, so I'm instead masking off the corners with the  border of of a too-big
        // rounded rectangle, and clipping the too-big rectangle by its parent. -HRS
        Rectangle {
            id: mask
            anchors {
                horizontalCenter: userImage.horizontalCenter
                verticalCenter: userImage.verticalCenter
            }
            width: contentHeight * 2
            height: contentHeight * 2
            radius: contentHeight
            color: "transparent"
            border.color: imageMaskColor
            border.width: contentHeight / 2.0
        }
        MouseArea {
            anchors.fill: parent
            onClicked: imageAction(imageActionTarget, displayName)
        }
    }
    Column {
        id: textContainer
        // Size
        width: parent.width - avatarImage.width - parent.anchors.leftMargin - parent.anchors.rightMargin - parent.spacing
        height: contentHeight

        // DisplayName Text
        FiraSansSemiBold {
            id: displayNameText
            // Properties
            text: thisNameCard.displayName
            elide: Text.ElideRight
            // Size
            width: parent.width
            // Text Size
            size: thisNameCard.displayTextHeight
            // Text Positioning
            verticalAlignment: Text.AlignVCenter
        }

        // UserName Text
        FiraSansRegular {
            id: userNameText
            // Properties
            text: thisNameCard.userName
            elide: Text.ElideRight
            visible: thisNameCard.displayName
            // Size
            width: parent.width
            // Text Size
            size: thisNameCard.usernameTextHeight
            // Text Positioning
            verticalAlignment: Text.AlignVCenter
        }

        // Spacer
        Item {
            height: 4
            width: parent.width
        }

        // VU Meter
        Rectangle { // CHANGEME to the appropriate type!
            id: nameCardVUMeter
            // Size
            width: parent.width
            height: 8
            // Style
            radius: 4
            // Rectangle for the VU meter base
            Rectangle {
                id: vuMeterBase
                // Anchors
                anchors.fill: parent
                // Style
                color: "#dbdbdb" // Very appropriate hex value here
                radius: parent.radius
            }
            // Rectangle for the VU meter audio level
            Rectangle {
                id: vuMeterLevel
                // Size
                width: (thisNameCard.audioLevel) * parent.width
                // Style
                color: "#dbdbdb" // Very appropriate hex value here
                radius: parent.radius
                // Anchors
                anchors.bottom: parent.bottom
                anchors.top: parent.top
                anchors.left: parent.left
            }
            // Gradient for the VU meter audio level
            LinearGradient {
                anchors.fill: vuMeterLevel
                source: vuMeterLevel
                start: Qt.point(0, 0)
                end: Qt.point(parent.width, 0)
                gradient: Gradient {
                    GradientStop { position: 0.05; color: "#00CFEF" }
                    GradientStop { position: 0.5; color: "#9450A5" }
                    GradientStop { position: 0.95; color: "#EA4C5F" }
                }
            }
        }
    }
}
