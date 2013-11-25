
module.exports = function(app, config, passport, auth) {
    // TODO add authorization and authenticatoin
    // TODO consider more http response headers like Allow : http://en.wikipedia.org/wiki/List_of_HTTP_header_fields.

    var games = new (require('../app/controllers/Games'))(app, config);
    app.param('gameId', games.game);
    app.get('/games', games.list);
    app.post('/games', games.create);
    app.get('/games/:gameId', games.show);
    app.put('/games/:gameId', games.update);
    app.del('/games/:gameId', games.destroy);

    var players = new (require('../app/controllers/Players'))(app, config);
    app.param('playerId', players.player);
    app.get('/games/:gameId/players', players.list);
    app.post('/games/:gameId/players', players.create);
    app.get('/games/:gameId/players/:playerId', players.show);
    app.put('/games/:gameId/players/:playerId', players.update);
    app.del('/games/:gameId/players/:playerId', players.destroy);

    var artifacts =  new (require('../app/controllers/Artifacts'))(app, config);
    app.param('artifactId', artifacts.artifact);
    app.get('/games/:gameId/artifacts', artifacts.listByGame);
    app.get('/games/:gameId/players/:playerId/artifacts', artifacts.listByPlayer);
    // TODO get artifacts by location
    app.post('/games/:gameId/artifacts', artifacts.create);
    app.get('/games/:gameId/artifacts/:artifactId', artifacts.show);
    app.put('/games/:gameId/artifacts/:artifactId', artifacts.update);
    app.del('/games/:gameId/artifacts/:artifactId', artifacts.destroy);


   // var multipart = new (require('../app/controllers/Multipart'))(app, config);
    var assets = new (require('../app/controllers/Assets'))(app, config);
    app.param('assetId', assets.asset);
    app.get('/games/:gameId/assets', assets.list);
    app.get('/games/:gameId/assets/:assetId', assets.show);
    app.post('/games/:gameId/assets', assets.create);
    app.put('/games/:gameId/assets/:assetId', assets.update);
    app.del('/games/:gameId/assets/:assetId', assets.destroy);

    app.get('/games/:gameId/artifacts/:artifactId/assets', assets.list);
    app.post('/games/:gameId/artifacts/:artifactId/assets', assets.create);
    app.put('/games/:gameId/artifacts/:artifactId/assets/:assetId', assets.update);
    app.del('/games/:gameId/artifacts/:artifactId/assets/:assetId', assets.update);

    // specific hack for nicely display of artifact to the user
    app.param('assetFileName', assets.assetAsFile);
    app.get('/games/:gameId/artifacts/:artifactId/:assetFileName', assets.show);

}

// TODO old routes
/*

module.exports = function(app, passport, auth) {
    //User Routes
    var users = require('../app/controllers/users');
    app.get('/signin', users.signin);
    app.get('/signup', users.signup);
    app.get('/signout', users.signout);

    //Setting up the users api
    app.post('/users', users.create);

    app.post('/users/session', passport.authenticate('local', {
        failureRedirect: '/signin',
        failureFlash: 'Invalid email or password.'
    }), users.session);

    app.get('/users/me', users.me);
    app.get('/users/:userId', users.show);

    //Setting the facebook oauth routes
    app.get('/auth/facebook', passport.authenticate('facebook', {
        scope: ['email', 'user_about_me'],
        failureRedirect: '/signin'
    }), users.signin);

    app.get('/auth/facebook/callback', passport.authenticate('facebook', {
        failureRedirect: '/signin'
    }), users.authCallback);

    //Setting the github oauth routes
    app.get('/auth/github', passport.authenticate('github', {
        failureRedirect: '/signin'
    }), users.signin);

    app.get('/auth/github/callback', passport.authenticate('github', {
        failureRedirect: '/signin'
    }), users.authCallback);

    //Setting the twitter oauth routes
    app.get('/auth/twitter', passport.authenticate('twitter', {
        failureRedirect: '/signin'
    }), users.signin);

    app.get('/auth/twitter/callback', passport.authenticate('twitter', {
        failureRedirect: '/signin'
    }), users.authCallback);

    //Setting the google oauth routes
    app.get('/auth/google', passport.authenticate('google', {
        failureRedirect: '/signin',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ]
    }), users.signin);

    app.get('/auth/google/callback', passport.authenticate('google', {
        failureRedirect: '/signin'
    }), users.authCallback);

    //Finish with setting up the userId param
    app.param('userId', users.user);

    //Article Routes
    var articles = require('../app/controllers/articles');
    app.get('/articles', articles.all);
    app.post('/articles', auth.requiresLogin, articles.create);
    app.get('/articles/:articleId', articles.show);
    app.put('/articles/:articleId', auth.requiresLogin, auth.article.hasAuthorization, articles.update);
    app.del('/articles/:articleId', auth.requiresLogin, auth.article.hasAuthorization, articles.destroy);

    //Finish with setting up the articleId param
    app.param('articleId', articles.article);

    //Home route
    var index = require('../app/controllers/index');
    app.get('/', index.render);

};*/
