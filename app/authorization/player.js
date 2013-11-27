/**
 * routes for the player's API
 * Created with IntelliJ IDEA.
 * User: amira
 * Date: 11/16/13
 * Time: 9:53 PM
 */

var express = require('express');
var util = require('util');
var LocalStrategy = require('passport-local').Strategy;

util.inherits(PlayerStrategy, LocalStrategy);

var strategyName = 'player';
var userType = 'player';

function PlayerStrategy(verify) {
    PlayerStrategy.super_.call(this, {
        usernameField: 'password',
        passwordField: 'password',
        passReqToCallback: true
    }, function (req, password, password, done) {
        if (req.player && req.player.password === password){
            return done(null, new PlayerUser(req.game._id, req.player.name));
        } else {
            return done();
        }
    });
    this.name = strategyName;
}

function PlayerUser(gameId, playerName){
    this.type = userType;
    this.gameId = gameId;
    this.playerName = playerName;
}

module.exports = function (app, config, passport){
    var dao = new (require('../dal/Dao'))(app, {'collectionName':'games'});

    passport.use(new PlayerStrategy());

    this.authorize = function (fallback){
        return function(req, res, next){
            if (req.user &&
                req.user.type === userType &&
                req.user.gameId &&
                req.game &&
                req.user.gameId === req.game._id.toHexString() &&
                req.user.playerName &&
                (
                    req.player && req.user.playerName === req.player.name ||
                    req.artifact && req.user.playerName === req.artifact.location
                )){
                return next();
            } else {
                return fallback(req, res, next);
            }
        }
    };

    this.authenticate = [express.multipart(), passport.authenticate(strategyName)];

};