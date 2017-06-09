//
//  SpectatorCamera.qml
//  qml/hifi
//
//  Spectator Camera
//
//  Created by Zach Fox on 2017-06-05
//  Copyright 2016 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

import QtQuick 2.5
import QtQuick.Controls 1.4
import "../styles-uit"
import "../controls-uit" as HifiControlsUit
import "../controls" as HifiControls

// references HMD, XXX from root context

Rectangle {
    HifiConstants { id: hifi; }

    id: spectatorCamera;
    // Style
    color: hifi.colors.baseGray;
    
    //
    // TITLE BAR START
    //
    Item {
        id: titleBarContainer;
        // Size
        width: spectatorCamera.width;
        height: 50;
        // Anchors
        anchors.left: parent.left;
        anchors.top: parent.top;

        // "Spectator" text
        RalewaySemiBold {
            id: titleBarText;
            text: "Spectator";
            // Text size
            size: hifi.fontSizes.overlayTitle;
            // Anchors
            anchors.fill: parent;
            anchors.leftMargin: 16;
            // Style
            color: hifi.colors.lightGrayText;
            // Alignment
            horizontalAlignment: Text.AlignHLeft;
            verticalAlignment: Text.AlignVCenter;
        }

        // Separator
        HifiControlsUit.Separator {
            anchors.left: parent.left;
            anchors.right: parent.right;
            anchors.bottom: parent.bottom;
        }
    }
    //
    // TITLE BAR END
    //
    
    //
    // SPECTATOR APP DESCRIPTION START
    //
    Item {
        id: spectatorDescriptionContainer;
        // Size
        width: spectatorCamera.width;
        height: childrenRect.height;
        // Anchors
        anchors.left: parent.left;
        anchors.top: titleBarContainer.bottom;

        // (i) Glyph
        HiFiGlyphs {
            id: spectatorDescriptionGlyph;
            text: hifi.glyphs.info;
            // Size
            width: 20;
            height: parent.height;
            size: 60;
            // Anchors
            anchors.left: parent.left;
            anchors.leftMargin: 20;
            anchors.top: parent.top;
            anchors.topMargin: 0;
            // Style
            color: hifi.colors.lightGrayText;
            horizontalAlignment: Text.AlignHLeft;
            verticalAlignment: Text.AlignTop;
        }

        // "Spectator" app description text
        RalewayLight {
            id: spectatorDescriptionText;
            text: "Spectator lets you change what your monitor displays while you're using a VR headset. Use Spectator when streaming and recording video.";
            // Text size
            size: 14;
            // Size
            width: 350;
            height: paintedHeight;
            // Anchors
            anchors.top: parent.top;
            anchors.topMargin: 15;
            anchors.left: spectatorDescriptionGlyph.right;
            anchors.leftMargin: 40;
            // Style
            color: hifi.colors.lightGrayText;
            wrapMode: Text.WordWrap;
            // Alignment
            horizontalAlignment: Text.AlignHLeft;
            verticalAlignment: Text.AlignVCenter;
        }

        // "Learn More" text
        RalewayRegular {
            id: spectatorLearnMoreText;
            text: "Learn More About Spectator";
            // Text size
            size: 14;
            // Size
            width: paintedWidth;
            height: paintedHeight;
            // Anchors
            anchors.top: spectatorDescriptionText.bottom;
            anchors.topMargin: 10;
            anchors.left: spectatorDescriptionText.anchors.left;
            anchors.leftMargin: spectatorDescriptionText.anchors.leftMargin;
            // Style
            color: hifi.colors.blueAccent;
            wrapMode: Text.WordWrap;
            font.underline: true;
            // Alignment
            horizontalAlignment: Text.AlignHLeft;
            verticalAlignment: Text.AlignVCenter;
            
            MouseArea {
                anchors.fill: parent;
                hoverEnabled: enabled;
                onClicked: {
                    console.log("FIXME! Add popup pointing to 'Learn More' page");
                }
                onEntered: parent.color = hifi.colors.blueHighlight;
                onExited: parent.color = hifi.colors.blueAccent;
            }
        }

        // Separator
        HifiControlsUit.Separator {
            anchors.left: parent.left;
            anchors.right: parent.right;
            anchors.top: spectatorLearnMoreText.bottom;
            anchors.topMargin: spectatorDescriptionText.anchors.topMargin;
        }
    }
    //
    // SPECTATOR APP DESCRIPTION END
    //

    
    //
    // SPECTATOR CONTROLS START
    //
    Item {
        id: spectatorControlsContainer;
        // Size
        height: spectatorCamera.height - spectatorDescriptionContainer.height - titleBarContainer.height;
        // Anchors
        anchors.top: spectatorDescriptionContainer.bottom;
        anchors.topMargin: 20;
        anchors.left: parent.left;
        anchors.leftMargin: 25;
        anchors.right: parent.right;
        anchors.rightMargin: anchors.leftMargin;

        // "Camera On" Checkbox
        HifiControlsUit.CheckBox {
            id: cameraToggleCheckBox;
            colorScheme: hifi.colorSchemes.dark;
            anchors.left: parent.left;
            anchors.top: parent.top;
            text: "Camera On";
            boxSize: 24;
            onClicked: {
                sendToScript({method: (checked ? 'spectatorCameraOn' : 'spectatorCameraOff')});
            }
        }

        // Spectator Camera Preview
        //Image {
        ResourceImageItem {
            id: spectatorCameraPreview;
            height: 250;
            anchors.left: parent.left;
            anchors.top: cameraToggleCheckBox.bottom;
            anchors.topMargin: 20;
            anchors.right: parent.right;
            fillMode: Image.PreserveAspectFit;
            horizontalAlignment: Image.AlignHCenter;
            verticalAlignment: Image.AlignVCenter;
            // source: "http://1.bp.blogspot.com/-1GABEq__054/T03B00j_OII/AAAAAAAAAa8/jo55LcvEPHI/s1600/Winning.jpg";
        }
        
        // "Monitor Shows" Switch Label Glyph
        HiFiGlyphs {
            id: monitorShowsSwitchLabelGlyph;
            text: hifi.glyphs.screen;
            size: 32;
            color: hifi.colors.blueHighlight;
            anchors.top: spectatorCameraPreview.bottom;
            anchors.topMargin: 12;
            anchors.left: parent.left;
        }
        // "Monitor Shows" Switch Label
        RalewayLight {
            id: monitorShowsSwitchLabel;
            text: "MONITOR SHOWS:";
            anchors.top: spectatorCameraPreview.bottom;
            anchors.topMargin: 20;
            anchors.left: monitorShowsSwitchLabelGlyph.right;
            anchors.leftMargin: 6;
            size: 16;
            width: paintedWidth;
            height: paintedHeight;
            color: hifi.colors.lightGrayText;
            verticalAlignment: Text.AlignVCenter;
        }
        // "Monitor Shows" Switch
        HifiControlsUit.Switch {
            id: monitorShowsSwitch;
            height: 30;
            anchors.left: parent.left;
            anchors.right: parent.right;
            anchors.top: monitorShowsSwitchLabel.bottom;
            anchors.topMargin: 10;
            labelTextOff: "HMD Preview";
            labelTextOn: "Camera View";
            labelGlyphOnText: hifi.glyphs.alert;
            onCheckedChanged: {
                sendToScript({method: 'setMonitorShowsCameraView', params: checked});
            }
        }

        // "Switch View From Controller" Checkbox
        HifiControlsUit.CheckBox {
            id: switchViewFromControllerCheckBox;
            colorScheme: hifi.colorSchemes.dark;
            anchors.left: parent.left;
            anchors.top: monitorShowsSwitch.bottom;
            anchors.topMargin: 25;
            text: "Pressing Vive's Left Thumbpad Switches Monitor View";
            boxSize: 24;
            onClicked: {
                sendToScript({method: 'changeSwitchViewFromControllerPreference', params: checked});
            }
        }
    }    
    //
    // SPECTATOR CONTROLS END
    //

    //
    // FUNCTION DEFINITIONS START
    //
    //
    // Function Name: fromScript()
    //
    // Relevant Variables:
    // None
    // 
    // Arguments:
    // message: The message sent from the SpectatorCamera JavaScript.
    //     Messages are in format "{method, params}", like json-rpc.
    // 
    // Description:
    // Called when a message is received from spectatorCamera.js.
    //
    function fromScript(message) {
        switch (message.method) {
        case 'updateSpectatorCameraCheckbox':
            cameraToggleCheckBox.checked = message.params;
        break;
        case 'updateMonitorShowsSwitch':
            monitorShowsSwitch.checked = message.params;
        break;
        default:
            console.log('Unrecognized message from spectatorCamera.js:', JSON.stringify(message));
        }
    }
    signal sendToScript(var message);

    //
    // FUNCTION DEFINITIONS END
    //
}
