/**
 * Controller for the game entity lifecycle management.
 * User: amira
 * Date: 11/21/13
 * Time: 9:27 PM
 */

module.exports = function (app, config){
    /**
     * Module dependencies.
     */
    var _ = require('underscore'),
        // define dao for games
        dao = new (require('../dal/Dao'))(app, {
            'collectionName':'games',
            'listFields':['name', 'description']
        });

    /**
     * Find game by id
     */
    this.game = function(req, res, next, id) {
        dao.load(id, function(err, game) {
            if (err) return next(err);
            if (!game) return next(new Error('Failed to load game ' + id));
            req.game = game;
            return next();
        });
    };

    /**
     * Create a game
     */
    this.create = function(req, res, next) {
        var game = {
            name : req.body.name,
            password : req.body.password,
            players : {}
        };

        dao.insert(game, function(err) {
            if (err) return next(err);
            res.statusCode = 201;
            res.jsonp(game);
        });
    };

    /**
     * Update a game
     */
    this.update = function(req, res, next) {
        var game = utils.updateCopyExcept(req.game, req.body, '_id');

        dao.update(game, function(err) {
            if (err) return next(err);
            res.jsonp(game);
        });
    };

    /**
     * Delete a game
     */
    this.destroy = function(req, res, next) {
        var game = req.game;
        // TODO remove all related assets
        dao.remove(game, function(err) {
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
        dao.list(function(err, games) {
            if (err) return next(err);
            res.jsonp(games);
        });
    };
};
