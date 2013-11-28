/**
 * Generic local authorization strategy
 * User: amira
 * Date: 11/27/13
 * Time: 11:03 PM
 */

var busboy = require('connect-busboy');
var express = require('express');
var util = require('util');
var LocalStrategy = require('passport-local').Strategy;

module.exports = function (app, config, passport, strategyName, getUserFromReq, isAuthorized, authorizeFallback){

    util.inherits(CustomStrategy, LocalStrategy);

    function CustomStrategy() {
        CustomStrategy.super_.call(this, {
            usernameField: 'password',
            passwordField: 'password',
            passReqToCallback: true
        }, function (req, password, password, done) {
            return done(null, getUserFromReq(req, password));
        });
        this.name = strategyName;
    }

    passport.use(new CustomStrategy());

    this.authorize = function(req, res, next){
        if (isAuthorized(req)){
            return next();
        } else {
            return authorizeFallback(req, res, next);
        }
    };

    this.authenticate = [busboy({limit : {fields : 1, files : 0, fieldSize : 128}}),    // use busboy to handle the form data
        function(req, res, next) {
            req.busboy.on('field', function(fieldname, val) {
                if (!req.body) req.body = {};
                req.body.password = val;
            });
            req.busboy.on('end', next);
            req.pipe(req.busboy);
        },
        passport.authenticate(strategyName)];

};