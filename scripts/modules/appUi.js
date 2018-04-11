//
//  libraries/appUi.js
//
//  Created by Howard Stearns on 3/20/18.
//  Copyright 2018 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

function AppUi(properties) {
    var that = this;
    function defaultButton(name, suffix) {
	var base = that[name] || (that.buttonPrefix + suffix);
	that[name] = (base.indexOf('/') >= 0) ? base : (that.graphicsDirectory + base); //poor man's merge
    }

    // Defaults:
    that.tabletName = "com.highfidelity.interface.tablet.system";
    that.inject = "";
    that.graphicsDirectory = "icons/tablet-icons/"; // Where to look for button svgs. See below.
    that.checkIsOpen = function checkIsOpen(type, tabletUrl) { // Are we active? Value used to set isOpen.
	return (type === that.type) && (tabletUrl.indexOf(that.home) >= 0); // Actual url may have prefix or suffix.
    }
    that.toOpen = function toOpen() { // How to open the app.
	if (that.isQML()) {
	    that.tablet.loadQMLSource(that.home);
	} else {
	    that.tablet.gotoWebScreen(that.home, that.inject);
	}
    };
    that.toClose = function toClose() { // How to close the app.
	// for toolbar-mode: go back to home screen, this will close the window.
	that.tablet.gotoHomeScreen();
    };
    that.buttonActive = function buttonActive(isActive) { // How to make the button active (white).
	that.button.editProperties({isActive: isActive});
    };
    that.messagesWaiting = function messagesWaiting(isWaiting) { // How to indicate a message light on button.
	// Note that waitingButton doesn't have to exist unless someone explicitly calls this with isWaiting true.
        that.button.editProperties({
            icon: isWaiting ? that.normalMessagesButton : that.normalButton,
            activeIcon: isWaiting ? that.activeMessagesButton : that.activeButton
        });
    };
    that.isQML = function isQML() { // We set type property in onClick.
	return that.type === 'QML';
    }
    that.eventSignal = function eventSignal() { // What signal to hook onMessage to.
	return that.isQML() ? that.tablet.fromQml : that.tablet.webEventReceived;
    };

    // Overwrite with the given properties:
    Object.keys(properties).forEach(function (key) { that[key] = properties[key]; });

    // Properties:
    that.tablet = Tablet.getTablet(that.tabletName);
    // Must be after we gather properties.
    that.buttonPrefix = that.buttonPrefix || that.buttonName.toLowerCase() + "-";
    defaultButton('normalButton', 'i.svg');
    defaultButton('activeButton', 'a.svg');
    defaultButton('normalMessagesButton', 'i-msg.svg');
    defaultButton('activeMessagesButton', 'a-msg.svg');
    that.button = that.tablet.addButton({
        icon: that.normalButton,
        activeIcon: that.activeButton,
        text: that.buttonName,
        sortOrder: that.sortOrder
    });
    that.ignore = function ignore() { };

    // Handlers
    that.onScreenChanged = function onScreenChanged(type, url) {
	// Set isOpen, wireEventBridge, set buttonActive as appropriate,
	// and finally call onOpened() or onClosed() IFF defined.
	print('hrs fixme onScreenChanged', type, url, that.isOpen);
        if (that.checkIsOpen(type, url)) {
	    if (!that.isOpen) {
		that.isOpen = true;
		that.wireEventBridge(true);
		that.buttonActive(true);
		if (that.onOpened) {
		    that.onOpened();
		}
	    }

        } else { // Not us.  Should we do something for type Home, Menu, and particularly Closed (meaning tablet hidden?
	    if (that.isOpen) {
		that.isOpen = false;
		that.wireEventBridge(false);
		that.buttonActive(false);
		if (that.onClosed) {
		    that.onClosed();
		}
	    }
        }
    };
    that.hasEventBridge = false;
    that.wireEventBridge = function wireEventBridge(on) {
	// Sets hasEventBridge and wires onMessage to eventSignal as appropriate, IFF onMessage defined.
	print('hrs fixme wireEventBridge', on, that.hasEventBridge);
	if (!that.onMessage) { return; }
        if (on) {
            if (!that.hasEventBridge) {
		print('hrs fixme connecting', that.eventSignal());
                that.eventSignal().connect(that.onMessage);
                that.hasEventBridge = true;
            }
        } else {
            if (that.hasEventBridge) {
		print('hrs fixme connecting', that.eventSignal());		
                that.eventSignal().disconnect(that.onMessage);
                that.hasEventBridge = false;
            }
        }
    };
    that.isOpen = false;
    // To facilitate incremental development, only wire onClicked to do something when "home" is defined in properties.
    that.onClicked = that.home
	? function onClicked() {
	    // Call toOpen() or toClose(), and reset type based on current home property.
            if (that.isOpen) {
		that.toClose();
            } else {
		that.type = /.qml$/.test(that.home) ? 'QML' : 'Web'
		that.toOpen();
            }
	} : that.ignore;
    that.onScriptEnding = function onScriptEnding() {
	// Close if necessary, clean up any remaining handlers, and remove the button.
	if (that.isOpen) {
	    that.toClose();
	}
	that.tablet.screenChanged.disconnect(that.onScreenChanged);
	if (that.button) {
            if (that.onClicked) {
		that.button.clicked.disconnect(that.onClicked);
	    }
            that.tablet.removeButton(that.button);
	}
    };
    // Set up the handlers.
    that.tablet.screenChanged.connect(that.onScreenChanged);    
    that.button.clicked.connect(that.onClicked);
    Script.scriptEnding.connect(that.onScriptEnding);
};
module.exports = AppUi;
