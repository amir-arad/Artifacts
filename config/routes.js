/**
 * will be attached explicitly to POST, PUT routes,
 * except for files upload routes which handle form parsing themselves
 */
var formData = require('./formData');

module.exports = function(app, config, passport) {
    // init the 3 authorization strategies  :admin, storyTeller, player
    var auth = new (require('../app/authorization/Strategies'))(app, config, passport,
        function(req, res){           // fallback to auth error
            res.setHeader('WWW-Authenticate', 'Basic realm="Artifacts"');
            res.send(401, { "msg" : "error.no.credentials" });    // Unauthorized
        });


    app.post('/logout', function(req, res, next){
        req.logout();
        res.send(204);         // OK, No Content
    });
    var silentOk = function (req, res) {
        res.send(204);         // OK, No Content
    };
    app.post('/login', formData, auth.sysop.authenticate, silentOk);

    var games = new (require('../app/controllers/Games'))(app, config);
    app.param('gameId', games.game);
    app.get('/games', formData, auth.sysop.authorize, games.list);
    app.post('/games', formData, auth.sysop.authorize, games.create);

    app.post('/games/:gameId/login', formData, auth.storyteller.authenticate, silentOk);

    app.get('/games/:gameId', auth.storyteller.authorize, games.show);
    app.put('/games/:gameId', formData, auth.storyteller.authorize, games.update);
    app.del('/games/:gameId', auth.storyteller.authorize, games.destroy);

    var players = new (require('../app/controllers/Players'))(app, config);
    app.param('playerId', players.player);
    app.get('/games/:gameId/players', auth.storyteller.authorize, players.list);
    app.post('/games/:gameId/players', formData, auth.storyteller.authorize, players.create);
    app.get('/games/:gameId/players/:playerId', auth.storyteller.authorize, players.show);
    app.put('/games/:gameId/players/:playerId', formData, auth.storyteller.authorize, players.update);
    app.del('/games/:gameId/players/:playerId', auth.storyteller.authorize, players.destroy);


    app.post('/games/:gameId/players/:playerId/login', formData, auth.player.authenticate, silentOk);

    var artifacts =  new (require('../app/controllers/Artifacts'))(app, config);
    app.param('artifactId', artifacts.artifact);
    app.get('/games/:gameId/artifacts', auth.storyteller.authorize, artifacts.listByGame);
    app.get('/games/:gameId/players/:playerId/artifacts', auth.player.authorize, artifacts.listByPlayer);

    // TODO get artifacts on ground by location + report location

    app.post('/games/:gameId/artifacts', formData, auth.storyteller.authorize, artifacts.create);
    app.get('/games/:gameId/artifacts/:artifactId', auth.player.authorize, artifacts.show);
    app.put('/games/:gameId/artifacts/:artifactId', formData, auth.storyteller.authorize, artifacts.update);
    app.del('/games/:gameId/artifacts/:artifactId', auth.storyteller.authorize, artifacts.destroy);
    // todo artifact pick, drop w/ playerAuth


    // var multipart = new (require('../app/controllers/Multipart'))(app, config);
    var assets = new (require('../app/controllers/Assets'))(app, config);
    app.param('assetId', assets.asset);
    app.get('/games/:gameId/assets', auth.storyteller.authorize, assets.list);
    app.get('/games/:gameId/assets/:assetId', auth.storyteller.authorize, assets.show);
    // no formData, form handling in the controller :
    app.post('/games/:gameId/assets', auth.storyteller.authorize, assets.create);
    app.put('/games/:gameId/assets/:assetId', formData, auth.storyteller.authorize, assets.update);
    app.del('/games/:gameId/assets/:assetId', auth.storyteller.authorize, assets.destroy);

    app.get('/games/:gameId/artifacts/:artifactId/assets', auth.player.authorize, assets.list);
    // no formData, form handling in the controller :
    app.post('/games/:gameId/artifacts/:artifactId/assets', formData, auth.storyteller.authorize, assets.create);
    app.put('/games/:gameId/artifacts/:artifactId/assets/:assetId', formData, auth.storyteller.authorize, assets.update);
    app.del('/games/:gameId/artifacts/:artifactId/assets/:assetId', auth.storyteller.authorize, assets.update);

    // specific hack for nicely display of artifact to the user
    app.param('assetFileName', assets.assetAsFile);
    app.get('/games/:gameId/artifacts/:artifactId/:assetFileName', auth.player.authorize, assets.show);

}