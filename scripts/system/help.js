"use strict";

//
//  help.js
//  scripts/system/
//
//  Created by Howard Stearns on 2 Nov 2016
//  Copyright 2016 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
/* globals Tablet, Script, HMD, Controller, Menu */

(function() { // BEGIN LOCAL_SCOPE
    var AppUi = Script.require('appUi');
    var HOME_BUTTON_TEXTURE = Script.resourcesPath()
	+ "meshes/tablet-with-home-button.fbx/tablet-with-home-button.fbm/button-root.png";
    var TABLET_DATA = {textures: JSON.stringify({"tex.close" : HOME_BUTTON_TEXTURE})};
    var ui = new AppUi({
	buttonName: "HELP",
	sortOrder: 6,
	home: Script.resourcesPath() + "html/tabletHelp.html",
	toOpen: function () { // Instead of merely displaying the home html
	    if (HMD.tabletID) {
                Entities.editEntity(HMD.tabletID, TABLET_DATA);
            }
            Menu.triggerOption('Help...');
            onHelpScreen = true;
        }
    });

    function onScreenChanged(type, url) {
        onHelpScreen = type === "Web" && (url.indexOf(HELP_URL) === 0);
        button.editProperties({ isActive: onHelpScreen });
    }

    button.clicked.connect(onClicked);
    tablet.screenChanged.connect(onScreenChanged);

    Script.scriptEnding.connect(function () {
        if (onHelpScreen) {
            tablet.gotoHomeScreen();
        }
        button.clicked.disconnect(onClicked);
        tablet.screenChanged.disconnect(onScreenChanged);
        if (tablet) {
            tablet.removeButton(button);
        }
    });
}()); // END LOCAL_SCOPE
