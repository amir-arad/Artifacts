
module.exports = function(app, config, passport) {
    var admin = new (require('../app/authorization/admin'))(app, config, passport);
    var adminAuth = admin.authorize(function(req, res){           // fallback to auth error
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
    app.post('/login', admin.authenticate, silentOk);

    var games = new (require('../app/controllers/Games'))(app, config);
    app.param('gameId', games.game);
    app.get('/games', adminAuth, games.list);
    app.post('/games', adminAuth, games.create);


    var storyteller = new (require('../app/authorization/storyteller'))(app, config, passport);
    var storytellerAuth = storyteller.authorize(adminAuth);
    app.post('/games/:gameId/login', storyteller.authenticate, silentOk);

    app.get('/games/:gameId', storytellerAuth, games.show);
    app.put('/games/:gameId', storytellerAuth, games.update);
    app.del('/games/:gameId', storytellerAuth, games.destroy);

    var players = new (require('../app/controllers/Players'))(app, config);
    app.param('playerId', players.player);
    app.get('/games/:gameId/players', storytellerAuth, players.list);
    app.post('/games/:gameId/players', storytellerAuth, players.create);
    app.get('/games/:gameId/players/:playerId', storytellerAuth, players.show);
    app.put('/games/:gameId/players/:playerId', storytellerAuth, players.update);
    app.del('/games/:gameId/players/:playerId', storytellerAuth, players.destroy);


    var player = new (require('../app/authorization/player'))(app, config, passport);
    var playerAuth = player.authorize(storytellerAuth);
    app.post('/games/:gameId/players/:playerId/login', player.authenticate, silentOk);

    var artifacts =  new (require('../app/controllers/Artifacts'))(app, config);
    app.param('artifactId', artifacts.artifact);
    app.get('/games/:gameId/artifacts', storytellerAuth, artifacts.listByGame);
    app.get('/games/:gameId/players/:playerId/artifacts', playerAuth, artifacts.listByPlayer);

    // TODO get artifacts on ground by location + report location

    app.post('/games/:gameId/artifacts', storytellerAuth, artifacts.create);
    app.get('/games/:gameId/artifacts/:artifactId', playerAuth, artifacts.show);
    app.put('/games/:gameId/artifacts/:artifactId', storytellerAuth, artifacts.update);
    app.del('/games/:gameId/artifacts/:artifactId', storytellerAuth, artifacts.destroy);
    // todo artifact pick, drop w/ playerAuth


   // var multipart = new (require('../app/controllers/Multipart'))(app, config);
    var assets = new (require('../app/controllers/Assets'))(app, config);
    app.param('assetId', assets.asset);
    app.get('/games/:gameId/assets', storytellerAuth, assets.list);
    app.get('/games/:gameId/assets/:assetId', storytellerAuth, assets.show);
    app.post('/games/:gameId/assets', storytellerAuth, assets.create);
    app.put('/games/:gameId/assets/:assetId', storytellerAuth, assets.update);
    app.del('/games/:gameId/assets/:assetId', storytellerAuth, assets.destroy);

    app.get('/games/:gameId/artifacts/:artifactId/assets', playerAuth, assets.list);
    app.post('/games/:gameId/artifacts/:artifactId/assets', storytellerAuth, assets.create);
    app.put('/games/:gameId/artifacts/:artifactId/assets/:assetId', storytellerAuth, assets.update);
    app.del('/games/:gameId/artifacts/:artifactId/assets/:assetId', storytellerAuth, assets.update);

    // specific hack for nicely display of artifact to the user
    app.param('assetFileName', assets.assetAsFile);
    app.get('/games/:gameId/artifacts/:artifactId/:assetFileName', playerAuth, assets.show);

}