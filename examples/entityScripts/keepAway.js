(function () {
    // Randomly moves attached entity a bit in a random direction -- but only one participant at a time does so.
    // Meanwhile, the attached entity will also move away from you if you are too close -- but only for one particpant at a time.
    // This is an example of two uses of libraries/owner.js.

    /* Example snippet:
Entities.addEntity({
            type: 'Sphere',
            name: 'keepAway',
            position: Vec3.sum(MyAvatar.position, Vec3.multiply(5, Quat.getFront(Camera.orientation))),
            dimensions: {x: 0.5, y: 0.5, z: 0.5},
            color: {red: Math.random() * 255, green: Math.random() * 255, blue: Math.random() * 255},
            damping: 0.5,
            angularDamping: 0.5,
            gravity: {x: 0, y: -9.8, z: 0},
            collisionsWillMove: true,
            script: "http://howard-stearns.github.io/models/scripts/load/keepAway.js"
        })
    */

    Script.include("../libraries/owner.js");
    var entityID,
        randomRate = 1,         // seconds
        distanceRate = 1 / 2,   // seconds
        distanceAllowance = 3,  // meters
        distanceScale = 0.5,    // meters/second
        stopRandom = false,
        distanceTimer,
        keepAwayFromMe = false,
        claiming = false,
        randomOwner = ownerModule('io.highfidelity.keepAway.random'),
        distanceOwner = ownerModule('io.highfidelity.keepAway.distance');

    function randomCentered() { return Math.random() - 0.5; }
    function moveRandom() { // Fires at randomRate for the one machine chosen to do so.
        var newData = {velocity: {x: randomCentered(), y: randomCentered(), z: randomCentered()}},
            nextChange = Math.ceil(Math.random() * 2000 / randomRate);
        // If we stop doing this (because we've left), someone else will pick up.
        randomOwner.renewingEdit(entityID, newData);
        if (!stopRandom) { Script.setTimeout(moveRandom, nextChange); }
    }
    function startRandom() {
        Script.setTimeout(moveRandom, randomRate * 1000);
    }
    function endRandom() {
        stopRandom = true;
    }

    function moveDistance() {  // every user checks their distance and tries to claim if close enough.
        var me = MyAvatar.position,
            ball = Entities.getEntityProperties(entityID, ['position']).position;
        ball.y = me.y;
        var vector = Vec3.subtract(ball, me);

        // All the first people within distanceAllowance will try to claim. One is chosen, who will
        // keep ownership until they are outside of distanceAllowance.
        if (Vec3.length(vector) < distanceAllowance) {
            if (!keepAwayFromMe && !claiming) {
                claiming = true;
                print('claiming');
                distanceOwner.claim(entityID,
                                    function () { claiming = false; keepAwayFromMe = true; print('acquired'); },
                                    function () { claiming = keepAwayFromMe = false; print('released'); });
            }
        } else {
            if (keepAwayFromMe || claiming) {
                print('releasing');
                distanceOwner.release(entityID);
            }
        }
        if (keepAwayFromMe) {  // Only one will have the ball move away.
            distanceOwner.renewingEdit(entityID, {velocity: Vec3.multiply(distanceScale, Vec3.normalize(vector))});
        }
    }

    this.preload = function (givenEntityID) {
        var properties = Entities.getEntityProperties(givenEntityID, ['userData']),
            userData = properties.userData && JSON.parse(properties.userData);
        entityID = givenEntityID;
        if (userData) {
            randomRate = userData.randomRate || randomRate;
            distanceRate = userData.distanceRate || distanceRate;
            distanceAllowance = userData.distanceAllowance || distanceAllowance;
        }

        // random runs for only one of the users present
        randomOwner.claim(entityID, startRandom, endRandom);
        // distance runs all the time by everyone to check that user's distance
        distanceTimer = Script.setInterval(moveDistance, distanceRate);
    };
    this.unload = function () {
        endRandom();
        Script.clearTimeout(distanceTimer);
        randomOwner.release(entityID);
        distanceOwner.release(entityID);
    };
})
