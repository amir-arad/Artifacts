/**
 * Controller for the player entity lifecycle management.
 * player resides inside a game entity.
 * using the replacement approach with no locking (functionality first)
 * TODO switch to findAndModify or add optimistic locking
 *
 * User: amira
 * Date: 11/22/13
 * Time: 3:27 PM
 */

var utils = require('./utils');

module.exports = function (app, config){

    /**
     * Find player by id
     */
    this.player = function(req, res, next, playerName) {
        app.services.players.player(req.game, playerName, function (err, player) {
            if (err) return next(err);
            req.player = player;
            return next();
        });
    };

    /**
     * Create a player
     */
    this.create = function(req, res, next) {
        app.services.players.create(req.game, req.body,function (err, player) {
            if (err) return next(err);
            res.statusCode = 201;
            res.jsonp(player);
        });
    };

    /**
     * Update a player
     */
    this.update = function(req, res, next) {
        app.services.players.update(req.game, req.player, req.body, function (err, player) {
            if (err) return next(err);
            res.jsonp(player);
        });
    };

    /**
     * Delete an game
     */
    this.destroy = function(req, res, next) {
        app.services.players.destroy(req.game, req.player, function (err, player) {
            if (err) return next(err);
            res.jsonp(player);
        });
    };

    /**
     * Show an game
     */
    this.show = function(req, res) {
        res.jsonp(req.player);
    };

    /**
     * List of games
     */
    this.list = function(req, res, next) {
        app.services.players.list(req.game, function (err, players) {
            if (err) return next(err);
            res.jsonp(players);
        });
    };
};

