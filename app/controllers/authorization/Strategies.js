/**
 * Authentication strategies for sys admin, storyteller and player
 * User: amira
 * Date: 11/27/13
 * Time: 11:15 PM
 */

var CustomAuthStrategy = require('./CustomAuthStrategy');

module.exports = function (app, config, passport, authorizeFallback){

    function User(type, gameId, playerName){
        this.type = type;
        this.gameId = gameId;
        this.playerName = playerName;
    }

    function checkUserType(req, type) {
        return req.user && req.user.type === type;
    }

    this.sysop = new CustomAuthStrategy(app, config, passport, "sysop",
        function(req, password){
            return (password && password === config.app.adminPassword) ? new User("sysop") : null;
        }, function(req){
            return checkUserType(req, "sysop");
        }, authorizeFallback);


    function checkUserGame(req) {
        return req.user.gameId &&
            req.game &&
            req.user.gameId === req.game._id.toHexString();
    }

    this.storyteller = new CustomAuthStrategy(app, config, passport, "storyteller",
        function(req, password){
            return (req.game && req.game.password === password)? new User("storyteller", req.game._id) : null;
        }, function(req){
            return checkUserType(req, "storyteller") && checkUserGame(req);
        }, this.sysop.authorize);


    this.player = new CustomAuthStrategy(app, config, passport, "player",
        function(req, password){
            return (req.player && req.player.password === password)?
                new User("player", req.game._id, req.player.name) : null;
        }, function(req){
            return checkUserType(req, "player") && checkUserGame(req) &&
                req.user.playerName &&
                (req.player && req.user.playerName === req.player.name ||
                        req.artifact && req.user.playerName === req.artifact.location);
        }, this.storyteller.authorize);
};