/**
 * authorization for the administrator API
 * User: amira
 * Date: 11/16/13
 * Time: 9:54 PM
 */

var express = require('express');
var util = require('util');
var LocalStrategy = require('passport-local').Strategy;

util.inherits(AdminStrategy, LocalStrategy);

var strategyName = 'admin';
var userType = 'admin';

function AdminStrategy(verify) {
    AdminStrategy.super_.call(this, {
        usernameField: 'password',
        passwordField: 'password',
        passReqToCallback: true
    }, function (password, password, done) {
        var adminUser = (password && password === config.app.adminPassword) ? new AdminUser() : false;
        return done(null, adminUser);
    });
    this.name = strategyName;
}

function AdminUser(){
    this.type = userType;
}

module.exports = function (app, config, passport){

    passport.use(new AdminStrategy());

    this.authorize = function (fallback){
        return function(req, res, next){
            if (req.user && req.user.type === userType){
                return next();
            } else {
                return fallback(req, res, next);
            }
        }
    };

    this.authenticate = [express.multipart(), passport.authenticate(strategyName)];

};