/**
 * will be attached explicitly to POST, PUT routes,
 * except for files upload routes which handle form parsing themselves
 */
var formData = require('../../../config/formData');
module.exports = function(app, config, passport) {
    // init the 3 authorization strategies  :admin, storyTeller, player
    var auth = new (require('../authorization/Strategies'))(
        app, config, passport,
        function(req, res){           // fallback to auth error
         //   res.setHeader('WWW-Authenticate', 'Basic realm="Artifacts"');
            res.send(401, { "msg" : "error.no.credentials" });    // Unauthorized
        });

    function nocache(req, res, next) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        next();
    }
    app.post('/logout', function(req, res, next){
        req.logout();
        res.send(204);         // OK, No Content
    });
    var silentOk = function (req, res) {
        res.send(204);         // OK, No Content
    };
    app.post('/login', formData, auth.sysop.authenticate, silentOk);
    app.get('/login', formData, nocache, auth.sysop.getCredentials);


    var games = new (require('./../Games'))(app, config);
    app.param('gameId', games.game);
    app.get('/defaultGameName', nocache, games.defaultGameName);
    app.get('/games', nocache, auth.sysop.authorize, games.list);
    app.post('/games', formData, auth.sysop.authorize, games.create);

    app.post('/games/:gameId/login', formData, auth.storyteller.authenticate, silentOk);

    app.get('/games/:gameId', nocache, auth.storyteller.authorize, games.show);
    app.put('/games/:gameId', formData, auth.storyteller.authorize, games.update);
    app.del('/games/:gameId', auth.storyteller.authorize, games.destroy);

    var players = new (require('./../Players'))(app, config);
    app.param('playerId', players.player);
    app.get('/games/:gameId/players', nocache, auth.storyteller.authorize, players.list);
    app.post('/games/:gameId/players', formData, auth.storyteller.authorize, players.create);
    app.get('/games/:gameId/players/:playerId', nocache, auth.storyteller.authorize, players.show);
    app.put('/games/:gameId/players/:playerId', formData, auth.storyteller.authorize, players.update);
    app.del('/games/:gameId/players/:playerId', auth.storyteller.authorize, players.destroy);


    app.post('/games/:gameId/players/:playerId/login', formData, auth.player.authenticate, silentOk);

    var artifacts =  new (require('./../Artifacts'))(app, config);
    app.param('artifactId', artifacts.artifact);
    app.get('/games/:gameId/artifacts', nocache, auth.storyteller.authorize, artifacts.listByGame);
    app.get('/games/:gameId/players/:playerId/artifacts', nocache, auth.player.authorize, artifacts.listByPlayer);
    app.del('/games/:gameId/players/:playerId/artifacts/:artifactId', auth.player.authorize, artifacts.drop);
    app.get('/games/:gameId/players/:playerId/nearby', nocache, auth.player.authorize, artifacts.nearby);
    app.put('/games/:gameId/players/:playerId/nearby/:artifactId', auth.player.authorize, artifacts.pickup);

    // TODO get artifacts on ground by location + report location

    app.post('/games/:gameId/artifacts', formData, auth.storyteller.authorize, artifacts.create);
    app.get('/games/:gameId/artifacts/:artifactId', nocache, auth.player.authorize, artifacts.show);
    app.put('/games/:gameId/artifacts/:artifactId', formData, auth.storyteller.authorize, artifacts.update);
    app.del('/games/:gameId/artifacts/:artifactId', auth.storyteller.authorize, artifacts.destroy);
    // todo artifact pick, drop w/ playerAuth


    // var multipart = new (require('../app/controllers/Multipart'))(app, config);
    var assets = new (require('./../Assets'))(app, config);
    app.param('assetId', assets.asset);
    app.get('/games/:gameId/assets', nocache, auth.storyteller.authorize, assets.list);
    app.get('/games/:gameId/assets/:assetId', nocache, auth.storyteller.authorize, assets.show);
    // no formData, form handling in the controller :
    app.post('/games/:gameId/assets', auth.storyteller.authorize, assets.create);
    app.put('/games/:gameId/assets/:assetId', formData, auth.storyteller.authorize, assets.update);
    app.del('/games/:gameId/assets/:assetId', auth.storyteller.authorize, assets.destroy);

    app.get('/games/:gameId/artifacts/:artifactId/assets', nocache, auth.player.authorize, assets.list);
    // no formData, form handling in the controller :
    app.post('/games/:gameId/artifacts/:artifactId/assets', auth.storyteller.authorize, assets.create);
    app.put('/games/:gameId/artifacts/:artifactId/assets/:assetId', auth.storyteller.authorize, assets.changeArtifact);
    app.del('/games/:gameId/artifacts/:artifactId/assets/:assetId', auth.storyteller.authorize, assets.changeArtifact);

    // specific hack for nicely display of artifact to the user
    app.param('assetFileName', assets.assetAsFile);
    app.get('/games/:gameId/artifacts/:artifactId/:assetFileName', nocache, auth.player.authorize, assets.show);

};