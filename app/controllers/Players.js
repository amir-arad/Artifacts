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
     * Module dependencies.
     */
    var service = new (require('../services/Players'))(app, config);
    var dao = new (require('../dal/Dao'))(app, {'collectionName':'games'});

    /**
     * Find player by id
     */
    this.player = function(req, res, next, playerName) {
        service.player(req.game, playerName, function (err, player) {
            if (err) return next(err);
            req.player = player;
            return next();
        });
    };

    /**
     * Create a player
     */
    this.create = function(req, res, next) {
        service.create(req.game, req.body,function (err, player) {
            if (err) return next(err);
            res.statusCode = 201;
            res.jsonp(player);
        });
    };

    /**
     * Update a player
     */
    this.update = function(req, res, next) {
        service.update(req.game, req.player, req.body, function (err, player) {
            if (err) return next(err);
            res.jsonp(player);
        });
    };

    /**
     * Delete an game
     */
    this.destroy = function(req, res, next) {
        service.destroy(req.game, req.player, function (err, player) {
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
        service.list(req.game, function (err, players) {
            if (err) return next(err);
            res.jsonp(players);
        });
    };
};

