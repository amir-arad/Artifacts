/**
 * a module to init a sample game in the Artifacts application
 * User: amira
 * Date: 11/29/13
 * Time: 3:35 PM
 */

var async = require('async');
var _ = require('underscore');

var sampleGame = {
    name : 'sampleGame',
    password : '1234',
    description : 'a sample game created automatically',
    players : [
        {name : 'alice', password : 'wonderland', description : 'alice is a quiet player'},
        {name : 'bob', password : 'king123', description : 'bob always wins'},
        {name : 'zander', password : 'l33t!', description : 'zander is a new guy'},
    ],
    artifacts : [
        {name : 'rock', description : 'a rock', location : 'alice', assets : []},
        {name : 'paper', description : 'a piece of paper', location : 'bob', assets : []},
        {name : 'cissors', description : 'a pair of cissors', location : 'zander', assets : []},
        {name : 'magnet', description : 'a magnet', location : 'zander', assets : []}
    ]
};

var sampleGameName = 'sampleGame';
var sampleGamePassword = '1234';
var sampleGameDescription = 'a sample game created automatically';

module.exports = function(app, config, callback) {
    // check if sample game exists
    app.services.games.game({'name' : sampleGame.name}, function(err, game){
        if (err){
            // no sample game => init
            if (err instanceof app.errors.NotFound) return initSampleGame();
            // another error
            return callback(err);
        }
        if (config.bootstrapSampleGame === 'force'){
            app.services.games.destroy(game, initSampleGame);
        } else {
            return callback();
        }
    });
    function initSampleGame(err){
        if (err) return callback(err);
        async.waterfall([
            // create game
            async.apply(app.services.games.create, sampleGame.name, sampleGame.password),
            // add description
            function(game, cb){
                app.services.games.update(game, {description : sampleGame.description}, cb);
            },
            // add players
            function(game, cb){
                async.each(
                    sampleGame.players,
                    async.apply(app.services.players.create, game),
                    function(err){
                        cb(err, err? null : game);
                    });
            },
            // add artifacts
            function(game, cb){
                async.each(
                    sampleGame.artifacts,
                    async.apply(app.services.artifacts.create, game),
                    function(err){
                        cb(err, err? null : game);
                    });
            }
            // TODO add assets
            ], callback);
/*
        // create game
        app.services.games.create(sampleGame.name, sampleGame.password, function(err, game){
            if (err) return callback(err);
            // add description
            app.services.games.update(game, {description : sampleGame.description}, function(err, game){
                if(err) return callback(err);
                // add players
                async.each(
                    sampleGame.players,
                    _.partial(app.services.players.create, game),
                    function(err){
                        if(err) return callback(err);
                        // add artifacts
                        async.each(
                            sampleGame.artifacts,
                            _.partial(app.services.artifacts.create, game),
                            function(err){
                                if(err) return callback(err);
                                // TODO add assets!
                            });
                    });
            });
        });*/
    }
}