/**
 * Module dependencies.
 */
var express = require('express'),
    mongoStore = require('connect-mongo')(express),
    flash = require('connect-flash'),
    helpers = require('view-helpers'),
    config = require('./config');

var connectTimeout = require('connect-timeout');

module.exports = function(app, config, passport, db) {
    app.set('showStackError', true);

    //Prettify HTML
    app.locals.pretty = true;

    //Should be placed before express.static
    app.use(express.compress({
        filter: function(req, res) {
            return (/json|text|javascript|css/).test(res.getHeader('Content-Type'));
        },
        level: 9
    }));

    //Setting the fav icon and static folder
    app.use(express.favicon());
    app.use(express.static(config.root + '/public', { maxAge: config.maxAge }));

    //Don't use logger for test env
    if (process.env.NODE_ENV !== 'test') {
        app.use(express.logger('dev'));
    }

    //Enable jsonp
    app.enable("jsonp callback");

    //cookieParser should be above session
    app.use(express.cookieParser());

    //bodyParser should be above methodOverride
    // app.use(express.bodyParser());  replaced bodyParser with urlencoded and json
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.methodOverride());

    // http://stackoverflow.com/questions/14408573/need-to-reduce-the-timeout-period-for-a-route-in-expressjs
    app.use(connectTimeout({ time: 10000 }));

    //express/mongo session storage
    app.use(express.session({
        secret: config.cookie_secret,
        store: new mongoStore({
            db: db,
            collection: 'sessions'
        })
    }));

    //connect flash for flash messages
    app.use(flash());

    //dynamic helpers
    app.use(helpers(config.app.name));

    //use passport session
    app.use(passport.initialize());
    app.use(passport.session());
    passport.serializeUser(function(user, done) {
        return done(null, JSON.stringify(user));
    });
    passport.deserializeUser(function(user, done) {
        return done(null, JSON.parse(user));
    });

    //routes should be at the last
    app.use(app.router);

    app.use(function(err, req, res, next) {
        if (err.name.indexOf('not found')){
            //Log it
            console.error(err.stack);

            // TODO change jsonp to render ?
            //Error page
            res.status(500).jsonp('500', {
                error: err.message
            });
        } else {
            // TODO change jsonp to render ?
            res.status(404).jsonp('404', {
                url: req.originalUrl,
                error: err.message
            });
        }
    });

    //Assume 404 since no middleware responded
    app.use(function(req, res, next) {
        // TODO change jsonp to render ?
        res.status(404).jsonp('404', {
            url: req.originalUrl,
            error: 'Not found'
        });
    });

};
