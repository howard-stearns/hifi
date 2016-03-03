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

var deck = [];
function makeCards(n) { // Make a deck of n cards, which must separately then be stacked somewhere.
    var i, card, density = cardWeight / (cardDimensions.x * cardDimensions.y * cardDimensions.z),
	userData = JSON.stringify({
	    wearable: {
		joints: {
		    RightHand: [{x: 0.1, y: 0.1, z: 0.1},
				Quat.fromPitchYawRollDegrees(90, 90, 30)],
		    LeftHand: [{x: -0.05, y: 0.15, z: 0.05},
			       Quat.fromPitchYawRollDegrees(0, 0, 70)]
		}
	    }
	});
    for (i = 0; i < n; i++) {
        card = Entities.addEntity({
            name: 'card-' + i,
            type: 'Box',
            dimensions: cardDimensions,
            density: density,
            dynamic: 1,
	    userData: userData,
            color: colors[i % colors.length]
            // TODO: replace above with the correct form of below when we get models.
            //modelURL: "whatever" + i,
            //shapeType: 'Box'
        });
        debug("Created", card, Entities.getEntityProperties(card).position);
        deck.push(card);
    }
}
function cleanupCards() { // delete 'em all
    deck.forEach(Entities.deleteEntity);
}
// Make a set of cards dynamic, after having made them static.
// Stack the deck with the first card (of global cards array) at position and rotation (using registrationPoint).
// Each subsequent card is stacked in the "forward" direction (on the back of the previous card).
function spreadCards(cards, position, rotation, optionalIncrementalRotationInDegrees) {
    var registrationPoint = {x: 0.5, y: 0.5, z: 1.0},   // Front face of card make it easy to set them face down a surface.
        perpendicular = Quat.getFront(rotation),
        offset = Vec3.multiply(cardDimensions.z, perpendicular), // Stack each card past the back of the previous
        rotationalOffset = Quat.angleAxis(optionalIncrementalRotationInDegrees || 0, perpendicular);
    // It's easiest to get the pinwheel by chaning the registration point. We want left-handed and right-handed people
    // to play together, so we set the registration point differently for each set of cards in hand.
    if (optionalIncrementalRotationInDegrees < 0) { // spread clockwise, as though in your left hand
        registrationPoint = {x: 0, y: 0, z: 1.0};
    } else if (optionalIncrementalRotationInDegrees > 0) { // spread counterclockwise, as though in your right hand
        registrationPoint = {x: 1, y: 0, z: 1.0};
    }
    cards.forEach(function (card) {
        // TODO: Instead of slamming each card into position, animate each card individually.
        Entities.editEntity(card, {
            position: position,
            rotation: rotation,
            registrationPoint: registrationPoint,
            // The randomness in physics can keep these from settling after spread. This keeps them still.
            velocity: Vec3.ZERO,
            angularVelocity: Vec3.ZERO,
            dynamic: 0
        });
        position = Vec3.sum(position, offset);
        rotation = Quat.multiply(rotationalOffset, rotation);
    });
    cards.forEach(function (card) { Entities.editEntity(card, {dynamic: 1}); }); // Turn physics on again.
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
spreadCards(deck, beforeMe(), Camera.orientation);
Script.scriptEnding.connect(cleanupCards);
