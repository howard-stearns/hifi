"use strict";
/*jslint vars:true, plusplus:true, forin:true*/
/*global Window, Script, Tablet, HMD, Controller, Account, XMLHttpRequest, location, print*/

//
//  goto.js
//  scripts/system/
//
//  Created by Dante Ruiz on 8 February 2017
//  Copyright 2016 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

(function () { // BEGIN LOCAL_SCOPE
    var AppUi = Script.require('appUi');
    var ui;
    var request = Script.require('request').request;
    var DEBUG = false;
    function debug() {
        if (!DEBUG) {
            return;
        }
        print('tablet-goto.js:', [].map.call(arguments, JSON.stringify));
    }

    function fromQml(message) {
        console.debug('tablet-goto::fromQml: message = ', JSON.stringify(message));

        var response = {id: message.id, jsonrpc: "2.0"};
        switch (message.method) {
        case 'request':
            request(message.params, function (error, data) {
                debug('rpc', request, 'error:', error, 'data:', data);
                response.error = error;
                response.result = data;
                ui.tablet.sendToQml(response);
            });
            return;
        default:
            response.error = {message: 'Unrecognized message', data: message};
        }
        ui.tablet.sendToQml(response);
    }

    var stories = {}, pingPong = false;
    function expire(id) {
        var options = {
            uri: Account.metaverseServerURL + '/api/v1/user_stories/' + id,
            method: 'PUT',
            json: true,
            body: {expire: "true"}
        };
        request(options, function (error, response) {
            debug('expired story', options, 'error:', error, 'response:', response);
            if (error || (response.status !== 'success')) {
                print("ERROR expiring story: ", error || response.status);
            }
        });
    }
    function pollForAnnouncements() {
        // We could bail now if !Account.isLoggedIn(), but what if we someday have system-wide announcments?
        var actions = 'announcement';
        var count = DEBUG ? 10 : 100;
        var options = [
            'now=' + new Date().toISOString(),
            'include_actions=' + actions,
            'restriction=' + (Account.isLoggedIn() ? 'open,hifi' : 'open'),
            'require_online=true',
            'protocol=' + encodeURIComponent(Window.protocolSignature()),
            'per_page=' + count
        ];
        var url = Account.metaverseServerURL + '/api/v1/user_stories?' + options.join('&');
        request({
            uri: url
        }, function (error, data) {
            debug(url, error, data);
            if (error || (data.status !== 'success')) {
                print("Error: unable to get", url,  error || data.status);
                return;
            }
            var didNotify = false, key;
            pingPong = !pingPong;
            data.user_stories.forEach(function (story) {
                var stored = stories[story.id], storedOrNew = stored || story;
                debug('story exists:', !!stored, storedOrNew);
                if ((storedOrNew.username === Account.username) && (storedOrNew.place_name !== location.placename)) {
                    if (storedOrNew.audience == 'for_connections') { // Only expire if we haven't already done so.
                        expire(story.id);
                    }
                    return; // before marking
                }
                storedOrNew.pingPong = pingPong;
                if (stored) { // already seen
                    return;
                }
                stories[story.id] = story;
                var message = story.username + " says something is happening in " + story.place_name + ". Open GOTO to join them.";
                Window.displayAnnouncement(message);
                didNotify = true;
            });
            for (key in stories) { // Any story we were tracking that was not marked, has expired.
                if (stories[key].pingPong !== pingPong) {
                    debug('removing story', key);
                    delete stories[key];
                }
            }
            if (didNotify) {
                ui.messagesWaiting(true);
                if (HMD.isHandControllerAvailable()) {
                    var STRENGTH = 1.0, DURATION_MS = 60, HAND = 2; // both hands
                    Controller.triggerHapticPulse(STRENGTH, DURATION_MS, HAND);
                }
            } else if (!Object.keys(stories).length) { // If there's nothing being tracked, then any messageWaiting has expired.
                ui.messagesWaiting(false);
            }
        });
    }
    var ANNOUNCEMENTS_POLL_TIME_MS = (DEBUG ? 10 : 60) * 1000;
    var pollTimer = Script.setInterval(pollForAnnouncements, ANNOUNCEMENTS_POLL_TIME_MS);

    Script.scriptEnding.connect(function () {
        Script.clearInterval(pollTimer);
    });

    ui = new AppUi({
	buttonName: "GOTO",
	normalMessagesButton: "goto-msg.svg",
	activeMessagesButton: "goto-a.svg",
	sortOrder: 8,
	home: "hifi/tablet/TabletAddressDialog.qml",
	onMessage: fromQml,
	onOpened: function () {
	    ui.messagesWaiting(false);
	    ui.tablet.sendToQml({ method: 'refreshFeeds', protocolSignature: Window.protocolSignature() });
	}
    });
}()); // END LOCAL_SCOPE
