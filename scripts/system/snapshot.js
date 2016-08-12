//
// snapshot.js
//
// Created by David Kelly on 1 August 2016
// Copyright 2016 High Fidelity, Inc
//
// Distributed under the Apache License, Version 2.0
// See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
var SNAPSHOT_DELAY = 500; // 500ms
var toolBar = Toolbars.getToolbar("com.highfidelity.interface.toolbar.system");
var resetOverlays;
var button = toolBar.addButton({
    objectName: "snapshot",
    imageURL: Script.resolvePath("assets/images/tools/snap.svg"),
    visible: true,
    buttonState: 1,
    defaultState: 1,
    hoverState: 2,
    alpha: 0.9,
});

function confirmShare(data) {
    var dialog = new OverlayWebWindow('Snapshot', Script.resolvePath("html/ShareSnapshot.html"), 800, 470);
    function onMessage(message) {
        if (message == 'ready') { // The window can now receive data from us.
            dialog.emitScriptEvent(data); // Send it.
            return;
        } // Rest is confirmation processing
        dialog.webEventReceived.disconnect(onMessage); // I'm not certain that this is necessary. If it is, what do we do on normal close?
        dialog.close();
        dialog.deleteLater();
        message = message.filter(function (picture) { return picture.share; });
        if (message.length) {
            print('sharing', message.map(function (picture) { return picture.localPath; }).join(', '));
            message.forEach(function (data) {
                Window.shareSnapshot(data.localPath);
            });
        } else {
            print('declined to share', JSON.stringify(data));
        }
    }
    dialog.webEventReceived.connect(onMessage);
    dialog.raise();
}

function snapshotShared(success) {
    if (success) {
        // for now just print status
        print('snapshot uploaded and shared');
    } else {
        // for now just print an error.
        print('snapshot upload/share failed');
    } 
}

function onClicked() {
    // update button states
    resetOverlays = Menu.isOptionChecked("Overlays");
    Window.snapshotTaken.connect(resetButtons);
    
    button.writeProperty("buttonState", 0);
    button.writeProperty("defaultState", 0);
    button.writeProperty("hoverState", 2);
     
    // hide overlays if they are on
    if (resetOverlays) {
        Menu.setIsOptionChecked("Overlays", false);
    }
    
    // hide hud
    toolBar.writeProperty("visible", false);

    // take snapshot (with no notification)
    Script.setTimeout(function () {
        Window.takeSnapshot(false);
    }, SNAPSHOT_DELAY);
}

function resetButtons(path, notify) {
    // show overlays if they were on
    if (resetOverlays) {
        Menu.setIsOptionChecked("Overlays", true); 
    }
    // show hud
    toolBar.writeProperty("visible", true);
    
    // update button states
    button.writeProperty("buttonState", 1);
    button.writeProperty("defaultState", 1);
    button.writeProperty("hoverState", 3);
    Window.snapshotTaken.disconnect(resetButtons);

    // last element in data array tells dialog whether we can share or not
    confirmShare([ 
            { localPath: path }, 
            { canShare: Boolean(Window.location.placename), isLoggedIn: Account.isLoggedIn() } 
    ]);
 }

button.clicked.connect(onClicked);
Window.snapshotShared.connect(snapshotShared);

Script.scriptEnding.connect(function () {
    toolBar.removeButton("snapshot");
    button.clicked.disconnect(onClicked);
    Window.snapshotShared.disconnect(snapshotShared);
});
