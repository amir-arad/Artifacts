
var async = require('async');
var util = require('util');
var _ = require('underscore');
var CONNECTION_INIT = "init", CONNECTION_DESTROY = "destroy";
module.exports = function(app, config) {

    // optimizing data sent to client
    // keep cached list of item IDs sent to the client
    // compare to the cache before sending new data
    function syncClientItemsList(listId, socket, elementIdAttr, list, callback) {
        // uses cache saved on the socket
        socket.get(listId, function (err, cachedIdsStr) {
            if (err) return callback(err);
            // for now compare previous list to new one by comparing result of toString
            var newIdsStr = _.pluck(list, elementIdAttr).sort().toString();
            if (cachedIdsStr === newIdsStr) return callback('already sent to player');
            socket.emit(listId + ':sync', list, function (foobar) {   // callback with no arguments triggers a client bug (client won't ack)
                socket.set(listId, newIdsStr, function () {
                    return callback(null, list);
                });
            });
        });
    }

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
                async.apply(syncClientItemsList, 'inventory', req.io, '_id')  // sync list with client
            ];

            // register to future changes in inventory
            var inventoryListener = function (artifact) {
                app.logger.debug("event received : \n" + util.inspect(this.event) + "\n" + util.inspect(artifact));
                async.waterfall(syncArtifactsListChain);    // todo dirty : initiate a full sync on any change
            };
            // register to nearby changes
            var nearbyListener = function (artifact) {
                app.logger.debug("event received : \n" + util.inspect(this.event) + "\n" + util.inspect(artifact));
                var location = app.services.players.getPlayerRTData(req.handshake.user.game, req.handshake.user.playerName).location;
                async.waterfall(getAsyncWaterfallToSyncArtifactsByLocation(req, location, 'nearby'));
            };

            var cleanupPlayer = _.once(function(){
                app.services.messaging.off([req.handshake.user.game, 'artifacts', 'nearby', '*'], nearbyListener);
                app.services.messaging.off([req.handshake.user.game, 'artifacts', req.handshake.user.playerName, '*'], inventoryListener);
                app.services.players.deletePlayerRTData(req.handshake.user.game, req.handshake.user.playerName); // invalidate player realtime data
                req.io.leave(req.handshake.user.game); // leave game room
            });
            // in addition to global disconnection logic, also clean up internal listeners
            req.io.on(CONNECTION_DESTROY, cleanupPlayer);
            req.io.on('disconnect', cleanupPlayer);
            app.services.messaging.on([req.handshake.user.game, 'artifacts', 'nearby', '*'], nearbyListener);
            app.services.messaging.on([req.handshake.user.game, 'artifacts', req.handshake.user.playerName, '*'], inventoryListener);
            req.io.join(req.handshake.user.game); // join game room
            async.waterfall(syncArtifactsListChain);
            req.io.respond();  // respond to original request

        } else {  // if (req.handshake.user.type === 'player')
            // listener for artifacts on ground
            var syncGroundArtifacts = function () {
                async.waterfall(getAsyncWaterfallToSyncArtifactsByLocation(req, null, 'ground'));
            };
            var cleanupAdmin = _.once(function(){
                app.services.messaging.off([req.handshake.user.game, 'artifacts', 'nearby', '*'], syncGroundArtifacts);
                req.io.leave(req.handshake.user.game); // leave game room
            });
            // in addition to global disconnection logic, also clean up internal listeners
            req.io.on(CONNECTION_DESTROY, cleanupAdmin);
            req.io.on('disconnect', cleanupAdmin);

            app.services.messaging.on([req.handshake.user.game, 'artifacts', 'nearby', '*'], syncGroundArtifacts);
            syncGroundArtifacts();

            req.io.respond();
        }
    });

    app.io.route(CONNECTION_DESTROY, function(req){
        app.logger.debug("socket logical disconnect : \n" + util.inspect(req.handshake.session.passport.user));
        req.io.respond();
    });

    function getAsyncWaterfallToSyncArtifactsByLocation(req, lastKnownLocation, eventName){
        return [
            async.apply(app.services.games.game, req.handshake.user.game),     // find game by name
            async.apply(app.services.artifacts.listNearLocation, lastKnownLocation),  // get nearby by location
            async.apply(syncClientItemsList, eventName, req.io, '_id')  // sync list with client
        ];
    }


    app.io.route('report', function(req){
        if (req.data.location){
            app.logger.debug("location report : " + req.handshake.session.passport.user);
            var geoJsonLocation =  req.data.location;
            if (geoJsonLocation.type && geoJsonLocation.type === "Point"){
                app.services.messaging.emit([req.handshake.user.game, 'players', req.handshake.user.playerName, 'location'], geoJsonLocation);
                async.waterfall(getAsyncWaterfallToSyncArtifactsByLocation(req, geoJsonLocation, 'nearby'));
            } else {
                app.logger.debug("illegal location object type : " + geoJsonLocation.type + "\nfull request :\n"+ util.inspect(req));
            }
            req.io.respond();  // respond to original request
        }
        if (req.data.movement){
            app.services.messaging.emit([req.handshake.user.game, 'players', req.handshake.user.playerName, 'movement'], req.data.movement);
            app.logger.debug("movement report : " + req.handshake.session.passport.user + " : " + req.data.movement);
        }
    });
};