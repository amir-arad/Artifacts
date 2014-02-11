
var async = require('async');
var util = require('util');
var _ = require('underscore');
module.exports = function(app, config) {
    //    req.handshake.user == {
    //        type : 'player'
    //       game : 'sampleGame'
    //       playerName : 'bob'
    //      logged_in : true
    // }

    // https://github.com/techpines/express.io/tree/master/lib#socketrequest
    // https://github.com/techpines/express.io/tree/master/examples#server-appjs-5
    app.io.route('connect', function(req){            // todo not the correct event name. perhaps "sync" or something
        app.logger.debug("socket connect : \n" + util.inspect(req.handshake.session.passport.user));

        if (req.handshake.user.type === 'player'){
            // player app is waiting for inventory and nearby lists
            // query for an inventory and emit it via the socket as the supplied event
            var syncArtifactsListChain = [
                async.apply(app.services.games.game, req.handshake.user.game),     // find game by name
                async.apply(app.services.artifacts.listByOwner, req.handshake.user.playerName),  // get inventory by game and player
                _.bind(req.io.emit, req.io, 'inventory:sync')  // send inventory as event on socket, binding 'this'.
            ];

            req.io.join(req.handshake.user.game); // join game room
            // register to future changes in inventory
            app.services.messaging.on([req.handshake.user.game, 'artifacts', req.handshake.user.playerName, '*'], function(artifact) {
                app.logger.debug("event received : \n" + util.inspect(this.event) + "\n" + util.inspect(artifact));
                async.waterfall(syncArtifactsListChain);    // todo dirty : initiate a full sync on any change
            });
            req.io.respond();  // respond to original request

            // register to nearby changes (currently all changes in same game)
            app.services.messaging.on([req.handshake.user.game, 'artifacts', 'nearby', '*'], function(artifact) {
                app.logger.debug("event received : \n" + util.inspect(this.event) + "\n" + util.inspect(artifact));
                var geoJsonLocation = app.services.players.getPlayerLocation(req.handshake.user.game, req.handshake.user.playerName);
                async.waterfall([
                    async.apply(app.services.games.game, req.handshake.user.game),     // find game by name
                    async.apply(app.services.artifacts.listNearLocation, geoJsonLocation),  // get nearby by location
                    _.bind(req.io.emit, req.io, 'nearby:sync')  // send nearby as event on socket, binding 'this'.
                ], function (err, data) {     // after nearby is sent to the app
                    if (err) throw err;
                });
            });

        } else {
            app.logger.error("not implemented connection of type : " + req.handshake.user.type);
            req.io.respond();
        }
    });

    app.io.route('disconnect', function(req){
        app.logger.debug("socket disconnect : \n" + util.inspect(req.handshake.session.passport.user));
        req.io.leave(req.handshake.user.game); // leave game room
        req.io.respond();
    });

    app.io.route('report', function(req){
        app.logger.debug("socket report : " + req.handshake.session.passport.user + " : \n" + util.inspect(req.data));
        if (req.data && req.data.location){
            var geoJsonLocation =  { "type": "Point", "coordinates": [req.data.location.longitude, req.data.location.latitude] };
            app.services.messaging.emit([req.handshake.user.game, 'players', req.handshake.user.playerName, 'location'], geoJsonLocation);
            async.waterfall([
                async.apply(app.services.games.game, req.handshake.user.game),     // find game by name
                async.apply(app.services.artifacts.listNearLocation, geoJsonLocation),  // get nearby by location
                _.bind(req.io.emit, req.io, 'nearby:sync')  // send nearby as event on socket, binding 'this'.
            ], function (err, data) {     // after nearby is sent to the app
                if (err) throw err;
                req.io.respond();  // respond to original request
            });
        }
    });

    // send inventory , nearby with full artifacts lists when there is a change
}