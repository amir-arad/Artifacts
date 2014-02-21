
var async = require('async');
var util = require('util');
var _ = require('underscore');
var CONNECTION_INIT = "init", CONNECTION_DESTROY = "destroy";
module.exports = function(app, config) {

    // optimizing data sent to player
    // keep cached list of artifact IDs sent to the player
    // compare to the cache before sending new data
    function sendSyncWithCache(attribute, game, player, socket, artifacts, callback) {
        socket.get(attribute, function (err, cached) {
            if (err) return callback(err);
            var newArtifactIdsStr = _.pluck(artifacts, '_id').sort().toString();
            if (cached === newArtifactIdsStr) return callback('already sent to player');
            socket.emit(attribute + ':sync', artifacts, function (foobar) {   // callback with no arguments triggers a client bug (client won't ack)
                socket.set(attribute, newArtifactIdsStr, function () {
                    return callback(null, artifacts);
                });
            });
        });
    };
    //    req.handshake.user == {
    //        type : 'player'
    //       game : 'sampleGame'
    //       playerName : 'bob'
    //      logged_in : true
    // }

    // https://github.com/techpines/express.io/tree/master/lib#socketrequest
    // https://github.com/techpines/express.io/tree/master/examples#server-appjs-5
    app.io.route(CONNECTION_INIT, function(req){            // todo not the correct event name. perhaps "sync" or something
        app.logger.debug("socket connect : \n" + util.inspect(req.handshake.session.passport.user));

        if (req.handshake.user.type === 'player'){
            app.services.players.deletePlayerRTData(req.handshake.user.game, req.handshake.user.playerName); // invalidate player realtime data
            // player app is waiting for inventory and nearby lists
            // query for an inventory and emit it via the socket as the supplied event
            var syncArtifactsListChain = [
                async.apply(app.services.games.game, req.handshake.user.game),     // find game by name
                async.apply(app.services.artifacts.listByOwner, req.handshake.user.playerName),  // get inventory by game and player
                async.apply(sendSyncWithCache, 'inventory', req.handshake.user.game, req.handshake.user.playerName, req.io)  // filter if same as last sent event
//                _.bind(req.io.emit, req.io, 'inventory:sync'),  // send inventory as event on socket, binding 'this'.
//                async.apply(cache, 'inventory', req.handshake.user.game, req.handshake.user.playerName)  // filter if same as last sent event
            ];

            // register to future changes in inventory
            var inventoryListener = function (artifact) {
                app.logger.debug("event received : \n" + util.inspect(this.event) + "\n" + util.inspect(artifact));
                async.waterfall(syncArtifactsListChain);    // todo dirty : initiate a full sync on any change
            };
            // register to nearby changes (currently all changes in same game)
            var nearbyListener = function (artifact) {
                app.logger.debug("event received : \n" + util.inspect(this.event) + "\n" + util.inspect(artifact));
                var geoJsonLocation = app.services.players.getPlayerRTData(req.handshake.user.game, req.handshake.user.playerName).location;
                async.waterfall(getAsyncWaterfallToNearbySync(req, geoJsonLocation));
            };

            // in addition to global disconnection logic, also clean up internal listeners
            req.io.on(CONNECTION_DESTROY, function(){
                app.services.messaging.off([req.handshake.user.game, 'artifacts', 'nearby', '*'], nearbyListener);
                app.services.messaging.off([req.handshake.user.game, 'artifacts', req.handshake.user.playerName, '*'], inventoryListener);
                app.services.players.deletePlayerRTData(req.handshake.user.game, req.handshake.user.playerName); // invalidate player realtime data
                req.io.leave(req.handshake.user.game); // leave game room
            });
            app.services.messaging.on([req.handshake.user.game, 'artifacts', 'nearby', '*'], nearbyListener);
            app.services.messaging.on([req.handshake.user.game, 'artifacts', req.handshake.user.playerName, '*'], inventoryListener);
            req.io.join(req.handshake.user.game); // join game room
            async.waterfall(syncArtifactsListChain);
            req.io.respond();  // respond to original request

        } else {
            app.logger.error("not implemented connection of type : " + req.handshake.user.type);
            req.io.respond();
        }
    });

    app.io.route(CONNECTION_DESTROY, function(req){
        app.logger.debug("socket disconnect : \n" + util.inspect(req.handshake.session.passport.user));
        req.io.respond();
    });

    function getAsyncWaterfallToNearbySync(req, lastKnownLocation){
        return [
            async.apply(app.services.games.game, req.handshake.user.game),     // find game by name
            async.apply(app.services.artifacts.listNearLocation, lastKnownLocation),  // get nearby by location
            async.apply(sendSyncWithCache, 'nearby', req.handshake.user.game, req.handshake.user.playerName, req.io)  // filter if same as last sent event
//            _.bind(req.io.emit, req.io, 'nearby:sync'),  // send nearby as event on socket, binding 'this'.
//            async.apply(cache, 'nearby', req.handshake.user.game, req.handshake.user.playerName),  // filter if same as last sent event
        ];
    }


    app.io.route('report', function(req){
        if (req.data.location){
            app.logger.debug("location report : " + req.handshake.session.passport.user + " : " + req.data.location.longitude + ',' + req.data.location.latitude);
            var geoJsonLocation =  { "type": "Point", "coordinates": [req.data.location.longitude, req.data.location.latitude] };
            app.services.messaging.emit([req.handshake.user.game, 'players', req.handshake.user.playerName, 'location'], geoJsonLocation);
            async.waterfall(getAsyncWaterfallToNearbySync(req, geoJsonLocation));
            req.io.respond();  // respond to original request
        }
        if (req.data.movement){
            app.services.messaging.emit([req.handshake.user.game, 'players', req.handshake.user.playerName, 'movement'], req.data.movement);
            app.logger.debug("movement report : " + req.handshake.session.passport.user + " : " + req.data.movement);
        }
    });

    // send inventory , nearby with full artifacts lists when there is a change
}