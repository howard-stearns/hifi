(function () {
    // See tests/performance/tribbles.js
    Script.include("../libraries/owner.js");
    var dimensions, oldColor, entityID,
        editRate = 60,
        moveRate = 1,
        scale = 2,
        accumulated = 0,
        increment = {red: 1, green: 1, blue: 1},
        hasUpdate = false,
        shuttingDown = false,
        ownedEntity = ownerModule('tribble');
    function nextWavelength(color) {
        var old = oldColor[color];
        if (old === 255) {
            increment[color] = -1;
        } else if (old === 0) {
            increment[color] = 1;
        }
        var next = (old + increment[color]) % 256;
        return next;
    }
    function update(delta) {  // High frequency stuff is done in update in case we fall behind.
        accumulated += delta;
        if (accumulated > (1 / editRate)) {
            var newColor = {red: nextWavelength('red'), green: nextWavelength('green'), blue: nextWavelength('blue')};
            oldColor = newColor;
            ownedEntity.renewingEdit(entityID, {color: newColor});
            accumulated = 0;
        }
    }
    function randomCentered() { return Math.random() - 0.5; }
    function randomVector() { return {x: randomCentered() * dimensions.x, y: randomCentered() * dimensions.y, z: randomCentered() * dimensions.z}; }
    function move() {
        var newData = {velocity: Vec3.sum({x: 0, y: 1, z: 0}, randomVector()), angularVelocity: Vec3.multiply(Math.PI, randomVector())};
        var nextChange = Math.ceil(Math.random() * 2000 / moveRate);
        ownedEntity.renewingEdit(entityID, newData);
        if (!shuttingDown) { Script.setTimeout(move, nextChange); }
    }
    function startup() {
        var properties = Entities.getEntityProperties(entityID, ['color', 'dimensions', 'userData']);
        var userData = properties.userData && JSON.parse(properties.userData);
        var moveTimeout = userData ? userData.moveTimeout : 0;
        var editTimeout = userData ? userData.editTimeout : 0;
        editRate = (userData && userData.editRate) || editRate;
        moveRate = (moveRate && userData.moveRate) || moveRate;
        oldColor = properties.color;
        dimensions = Vec3.multiply(scale, properties.dimensions);
        if (editTimeout) {
            hasUpdate = true;
            Script.update.connect(update);
            if (editTimeout > 0) {
                Script.setTimeout(function () { Script.update.disconnect(update); hasUpdate = false; }, editTimeout * 1000);
            }
        }
        if (moveTimeout) {
            Script.setTimeout(move, 1000);
            if (moveTimeout > 0) {
                Script.setTimeout(function () { shuttingDown = true; }, moveTimeout * 1000);
            }
        }
    }
    function shutdown() {
        shuttingDown = true;
        if (hasUpdate) { Script.update.disconnect(update); }
    }
    this.preload = function (givenEntityID) {
        entityID = givenEntityID;
        ownedEntity.claim(entityID, startup, shutdown);
    };
    this.unload = shutdown;
})
