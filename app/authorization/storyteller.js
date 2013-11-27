/**
 * routes for the game master's API
 * Created with IntelliJ IDEA.
 * User: amira
 * Date: 11/16/13
 * Time: 9:53 PM
 */

var express = require('express');
var util = require('util');
var LocalStrategy = require('passport-local').Strategy;

util.inherits(StorytellerStrategy, LocalStrategy);

var strategyName = 'storyteller';
var userType = 'storyteller';

function StorytellerStrategy(verify) {
    StorytellerStrategy.super_.call(this, {
        usernameField: 'password',
        passwordField: 'password',
        passReqToCallback: true
    }, function (req, password, password, done) {
        if (req.game && req.game.password === password){
            return done(null, new StorytellerUser(req.game._id));
        } else {
            return done();
        }
    });
    this.name = strategyName;
}

function StorytellerUser(gameId){
    this.type = userType;
    this.gameId = gameId;
}

module.exports = function (app, config, passport){
    var dao = new (require('../dal/Dao'))(app, {'collectionName':'games'});

    passport.use(new StorytellerStrategy());

    this.authorize = function (fallback){
        return function(req, res, next){
            if (req.user &&
                req.user.type === userType &&
                req.user.gameId &&
                req.game &&
                req.user.gameId === req.game._id.toHexString()){
                return next();
            } else {
                return fallback(req, res, next);
            }
        }
    };

    this.authenticate = [express.multipart(), passport.authenticate(strategyName)];

};