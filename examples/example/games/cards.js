"use strict";
/*jslint nomen: true, plusplus: true, vars: true*/
/*global Vec3, Quat, MyAvatar, Entities, Camera, Script, print */

// Note: We assume that the "front face" of card faces down its own positive z axis,
// i.e., front faces you when you are in the same orientation, so the BACK is on the card's getFront side.
// So the card dimensions are:
//   x = width = positive is to the right as you look at the face of the card
//   y = height = positive is towards the top of the card
//   z = thickness = positive is from the back toward the front
var cardDimensions = {x: 0.0635, y: 0.0889, z: 0.0003};
var cardWeight = 0.0022;

var colors = [  // TODO: remove when we get card models. See below
    {red: 255, green: 0, blue: 0},
    {red: 0, green: 255, blue: 0},
    {red: 0, green: 0, blue: 255},
    {red: 255, green: 255, blue: 0},
    {red: 0, green: 255, blue: 255},
    {red: 255, green: 0, blue: 255},
    {red: 128, green: 128, blue: 128}
];

function debug() { // Display the arguments not just [Object object].
    print.apply(null, [].map.call(arguments, JSON.stringify));
}

var cards = [];
function makeCards(n) { // Make a deck of n cards, which must separately then be stacked somewhere.
    var i, card, density = cardWeight / (cardDimensions.x * cardDimensions.y * cardDimensions.z);
    for (i = 0; i < n; i++) {
        card = Entities.addEntity({
            name: 'card-' + i,
            type: 'Box',
            dimensions: cardDimensions,
            density: density,
            dynamic: 1,
            color: colors[i % colors.length]
            // TODO: replace above with the correct form of below
            //modelURL: "whatever" + i,
            //shapeType: 'Box'
        });
        debug("Created", card, Entities.getEntityProperties(card).position);
        cards.push(card);
    }
}
function cleanupCards() { // delete 'em all
    cards.forEach(Entities.deleteEntity);
}
// Make a set of cards dynamic, after having made them static.
// Stack the deck with the first card (of global cards array) at position and rotation.
// The back of the card faces Quat.getFront(rotation), and the position is adjusted half a card thickness in that direction.
// Each subsequent card is stacked in the forward direction (on the back of the previous card).
function stackCards(position, rotation, optionalIncrementalRotationInDegrees) {
     // The extra gap keeps the cards from touching while we rotate them. Otherwise they'll scatter from friction.
    var deltaPosition = cardDimensions.z,
        offset = Vec3.multiply(deltaPosition, Quat.getFront(rotation)),
        angle = 0,
        anchor = Vec3.sum(position, Vec3.sum(Vec3.multiply(cardDimensions.x / -2, Quat.getRight(rotation)),
                                             Vec3.multiply(cardDimensions.y / -2, Quat.getUp(rotation))));
    position = Vec3.sum(position, Vec3.multiply(0.5 * cardDimensions.z, Quat.getFront(rotation)));
    debug('position', position, 'anchor', anchor);
    cards.forEach(function (card) {
        var thisRotation = rotation;
        if (optionalIncrementalRotationInDegrees) {
            thisRotation = Quat.multiply(Quat.angleAxis(angle, Quat.getFront(rotation)), rotation);
            angle += optionalIncrementalRotationInDegrees;
        }
        position = Vec3.sum(anchor, Vec3.sum(Vec3.multiply(cardDimensions.x / 2, Quat.getRight(thisRotation)),
                                             Vec3.multiply(cardDimensions.y / 2, Quat.getUp(thisRotation))));
        Entities.editEntity(card, {
            position: position,
            rotation: thisRotation,
            // The randomness in physics can keep these from settling after spread. This keeps them still.
            velocity: Vec3.ZERO,
            angularVelocity: Vec3.ZERO,
            dynamic: 0
        });
        //debug("stacked",  card, position, thisRotation);
        //position = Vec3.sum(position, offset);
        anchor = Vec3.sum(anchor, offset);
    });
    cards.forEach(function (card) { Entities.editEntity(card, {dynamic: 1}); }); // Turn physics on again.
}
// spread cardsInHand, following the initial orientation of the first card.
function spreadCards(cardsInHand) {
    
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

makeCards(52);
stackCards(beforeMe(), Camera.orientation, -10);

Script.scriptEnding.connect(cleanupCards);
