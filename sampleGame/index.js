/**
 * a module to init a sample game in the Artifacts application
 * User: amira
 * Date: 11/29/13
 * Time: 3:35 PM
 */

var async = require('async');
var _ = require('underscore');
var fs = require('fs');

var sampleGame = {
    name : 'sampleGame',
    password : '1234',
    description : 'a sample game created automatically',
    players : {
        alice : {name : 'alice', password : 'wonderland', description : 'alice is a quiet player'},
        bob : {name : 'bob', password : 'king123', description : 'bob always wins'},
        zander : {name : 'zander', password : 'l33t!', description : 'zander is a new guy'},
    },
    artifacts : {
        rock : {name : 'rock', description : 'a rock', player : 'alice', mainAsset : 'rock.jpg', iconAsset: 'rock.jpg', assets : []},
        paper : {name : 'paper', description : 'a piece of paper', player : 'bob', mainAsset : 'paper.jpg', iconAsset: 'paper.jpg', assets : []},
        scissors : {name : 'scissors', description : 'a pair of cissors', player : 'zander', mainAsset : 'scissors.jpg', iconAsset: 'scissors.jpg', assets : []},
        magnet : {name : 'magnet', description : 'a magnet', player : 'zander', mainAsset : 'magnet.jpg', iconAsset: 'magnet.jpg', assets : []}
    }
};

function endsWith(suffix, str) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

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

    function uploadAssetsByType(files, game, type, contentType, cb) {
        async.each(
            _.filter(files, async.apply(endsWith, type)),
            function (filename, cb) {
                // insert file as artifact
                var readStream = fs.createReadStream(__dirname + '/' + filename);
                app.services.assets.create(game, [], filename, contentType, readStream,
                    // add asset to artifact model
                    function (err, asset) {
                        if (err) return cb(err);
                        var fileLocalPart = filename.split('.', 1)[0];
                        sampleGame.artifacts[ fileLocalPart].assets.push(asset);
                        cb();
                    });
            },
            function (err) {
                cb(err, err ? null : game);
            });
    }

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
                    _.values(sampleGame.players),
                    async.apply(app.services.players.create, game),
                    function(err){
                        cb(err, err? null : game);
                    });
            },
            // upload assets
            // TODO add html
            function(game, cb){
                fs.readdir( __dirname, function (err, files) {
                    uploadAssetsByType(files, game, '.jpg', 'image/jpeg', cb);
                });
            },
            // add artifacts
            function(game, cb){
                async.each(
                    _.values(sampleGame.artifacts),
                    function(artifact, cb){
                        app.services.artifacts.create(game, artifact,
                            function(err, artifact){
                                if (err) return cb(err);
                                // add assets by artifact model
                                async.each(
                                    sampleGame.artifacts[artifact.name].assets,
                                    function(asset, cb){
                                        app.services.assets.changeArtifact(asset, artifact, true, cb);
                                    },
                                    cb);
                            });
                    },
                    function(err){
                        cb(err, err? null : game);
                    });
            }
        ], callback);
    }
}