/**
 * Controller for the game entity lifecycle management.
 * User: amira
 * Date: 11/21/13
 * Time: 9:27 PM
 */
var utils = require('./utils');

module.exports = function (app, config){

    /**
     * Module dependencies.
     */
    var _ = require('underscore');

    /**
     * Find game by id
     */
    this.game = function(req, res, next, id) {
        app.services.games.game(id, function(err, game){
            if (err) return next(err);
            req.game = game;
            return next();
        });
    };

    /**
     * Create a game
     */
    this.create = function(req, res, next) {
        app.services.games.create(req.body.name, req.body.password, function(err, game) {
            if (err) return next(err);
            res.statusCode = 201;
            res.jsonp(game);
        });
    };

    /**
     * Update a game
     */
    this.update = function(req, res, next) {
        app.services.games.update(req.game, req.body, function(err, game) {
            if (err) return next(err);
            res.jsonp(game);
        });
    };

    /**
     * Delete a game
     */
    this.destroy = function(req, res, next) {
        app.services.games.destroy(req.game, function(err, game) {
            if (err) return next(err);
            res.jsonp(game);
        });
    };

    /**
     * Show a game
     */
    this.show = function(req, res) {
        res.jsonp(req.game);
    };

    /**
     * List of games
     */
    this.list = function(req, res, next) {
        app.services.games.list(function(err, games) {
            if (err) return next(err);
            res.jsonp(games);
        });
    };
};
