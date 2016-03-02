"use strict";
/*jslint nomen: true, plusplus: true, vars: true*/
/*global Vec3, Quat, MyAvatar, Entities, Camera, Script, print */

var cardDimensions = {x: 0.0635, y: 0.0889, z: 0.0003};
var cardWeight = 0.0022;

var colors = [
    {red: 255, green: 0, blue: 0},
    {red: 0, green: 255, blue: 0},
    {red: 0, green: 0, blue: 255},
    {red: 255, green: 255, blue: 0},
    {red: 0, green: 255, blue: 255},
    {red: 255, green: 0, blue: 255},
    {red: 0, green: 255, blue: 255},
    {red: 128, green: 128, blue: 128}
];

function debug() { // Display the arguments not just [Object object].
    print.apply(null, [].map.call(arguments, JSON.stringify));
}

var cards = [];

function stack(position, rotation) {
    var offset = Vec3.multiply(cardDimensions.z, Quat.getFront(rotation));
    cards.forEach(function (card) {
        Entities.editEntity(card, {
            position: position,
            rotation: rotation,
        });
        debug("stacked",  card, position);
        position = Vec3.sum(position, offset);
    });
}

function makeDeck() {
    var n = 52, i, card;
    for (i = 0; i < n; i++) {
        card = Entities.addEntity({
            name: 'card-' + i,
            type: 'Box',
            dimensions: cardDimensions,
            weight: cardWeight,
            color: colors[i % colors.length]
        });
        debug("Created", card, Entities.getEntityProperties(card).position);
        cards.push(card);
    }
}

function cleanupCards() {
    cards.forEach(Entities.deleteEntity);
}

function myChest() {
    var waist = MyAvatar.position,
        chest = {x: waist.x, y: waist.y + 0.5, z: waist.z};
    debug("my feet", waist, "chest", chest);
    return chest;
}
function beforeMe() {
    var chest = myChest(),
        before = Vec3.sum(chest, Quat.getFront(Camera.orientation));
    debug("before", before);
    return before;
}

makeDeck();
stack(beforeMe(), Camera.orientation);

Script.scriptEnding.connect(cleanupCards);
