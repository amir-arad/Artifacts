
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
    app.io.route('connect', function(req){            // todo not the correct event. perhaps "sync" or something
        app.logger.debug("socket connect : \n" + util.inspect(req.handshake));

        if (req.handshake.user.type === 'player'){
            // player app is waiting for inventory and nearby lists
            // cache "get game" result for the next 2 requests
            var getGame = async.memoize(async.apply(app.services.games.game, req.handshake.user.game));
            // this function will query for an inventory of an owner and will emit it via the socket as the supplied event
            function syncListByOwner(ownerName, event, callback) {
                // sync the entire list
                var syncArtifactsListChain = [
                    getGame,     // find game by name
                    async.apply(app.services.artifacts.listByOwner, ownerName),  // get inventory by game and player
                    _.bind(req.io.emit, req.io, event + ':sync')  // send inventory as event on socket, binding 'this'.
                ];
                async.waterfall(syncArtifactsListChain, callback);
                async.waterfall([
                    getGame,     // find game by name
                    function (game, callback){              // register to all artifact events on the owner
                        var gameEmitter = app.services.artifacts.gameEmitter(game.name);
                        gameEmitter.on([ownerName, '*'], function(artifact) {
                            var event = this.event;
                            async.waterfall(syncArtifactsListChain);    // todo dirty : initiate a full sync on any change
                        });
                        callback();
                    }
                ].concat(syncArtifactsListChain)   // then initiate a full sync
                    , callback);
            }
            // execute both inventory and nearby queries
            async.parallel([
                async.apply(syncListByOwner, req.handshake.user.playerName, 'inventory'),   // send inventory to user
                async.apply(syncListByOwner, 'everywhere', 'nearby')] // send only global nearby to user
                , function (err, data) {     // after both are sent to the app
                    if (err) throw err;
                    req.io.join(req.handshake.user.game); // join game room
                    req.io.respond();  // respond to original request
                });
        } else {
            app.logger.error("not implemented connection of type : " + req.handshake.user.type);
            req.io.respond();
        }
    });

    app.io.route('disconnect', function(req){
        app.logger.debug("socket disconnect : \n" + util.inspect(req.handshake));
        req.io.leave(req.handshake.user.game); // leave game room
        req.io.respond();
    });

    app.io.route('report', function(req){
        app.logger.debug("socket report : " + req.handshake.session.passport.user);
        // todo send nearby if changed
    });

    // send inventory , nearby with full artifacts lists when there is a change
}