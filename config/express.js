/**
 * Module dependencies.
 */
var express = require('express.io');
var mongoStore = require('connect-mongo')(express);
var flash = require('connect-flash');
var helpers = require('view-helpers');
var passportSocketIo = require("passport.socketio");
var async = require('async');
var util = require('util');
var config = require('./config');

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

    var cookieParser = express.cookieParser;

    //cookieParser should be above session
    app.use(cookieParser());

    //bodyParser should be above methodOverride
    // app.use(express.bodyParser());  replaced bodyParser with urlencoded and json
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.methodOverride());

    // http://stackoverflow.com/questions/14408573/need-to-reduce-the-timeout-period-for-a-route-in-expressjs
    app.use(connectTimeout({ time: 10000 }));

    //express/mongo session storage
    var sessionConfig = {
        key: 'connect.sid',
        secret: config.cookie_secret,
        store: new mongoStore({
            db: db,
            collection: 'sessions'
        })
    };
    app.use(express.session(sessionConfig));

    // connect flash for flash messages
    // app.use(flash());

    //dynamic helpers
    app.use(helpers(config.app.name));

    // use passport session for express
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

    // init http and socket (but don't listen on a port yet)
    // need to be called before app.io.configure
    app.http().io();

    app.io.configure(function() {
        // ugly patch to make express.io and passportSocketIo to work their different session magic
        var expressAuth = app.io.get('authorization');

        // create an extended copy of the session configuration for passport session for socket.io
        sessionConfig = util._extend({
            passport : passport,                // send customized instance of passport
            cookieParser : cookieParser,        // send the cookie parser in use
            success : expressAuth,  // callback on success
            fail : onSocketAuthorizeFail     // callback on fail/error
        }, sessionConfig);

        function onSocketAuthorizeFail(data, message, error, accept){
            if(error) throw new Error(message);
            console.log('failed connection to socket.io:', message);
            accept(null, false);  // propagate
        }
        app.io.set('authorization', passportSocketIo.authorize(sessionConfig));
    });
};
