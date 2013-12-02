/**
 * Generic local authorization strategy
 * assumes a single field in the log in, called 'password'
 * User: amira
 * Date: 11/27/13
 * Time: 11:03 PM
 */

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

    this.authenticate = passport.authenticate(strategyName);

};