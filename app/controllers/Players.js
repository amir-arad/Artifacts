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


module.exports = function (app, config){
    /**
     * Module dependencies.
     */
    var _ = require('underscore'),
    // define dao for **games**
        dao = new (require('../dal/Dao'))(app, {'collectionName':'games'});

    /**
     * Find player by id
     */
    this.player = function(req, res, next, id) {
        var player = req.game.players[id];
        if (!player) return next(new Error('Failed to load player ' + id));
        req.player = player;
        return next();
    };

    function validateGameAndName(game, player){
        if (!game) return new Error('Must specify game');
        if (!player.name) return new Error('Must specify player name ' + player);
        return null;
    }

    function updateGameReturnPlayer(game, next, res, player) {
        dao.update(game, function (err) {
            if (err) return next(err);
            res.jsonp(player);
        });
    }

    /**
     * Create a player
     */
    this.create = function(req, res, next) {
        var player = req.body;
        var game = req.game;
        var err;

        // validation
        if (err = validateGameAndName(game, player)) return next(err);
        if (game.players[player.name]) return next(new Error('Player name already exists ' + player.name));

        // the creation itself
        game.players[player.name] = player;
        res.statusCode = 201;
        updateGameReturnPlayer(game, next, res, player);
    };

    /**
     * Update a player
     */
    this.update = function(req, res, next) {
        var player = utils.updateCopyExcept(req.player, req.body, 'name');
        var game = req.game;
        var err;

        // validation
        if (err = validateGameAndName(game, player)) return next(err);

        // the creation itself
        game.players[player.name] = player;
        updateGameReturnPlayer(game, next, res, player);
    };

    /**
     * Delete an game
     */
    this.destroy = function(req, res, next) {
        var player = req.player;
        var game = req.game;
        var err;

        // validation
        if (err = validateGameAndName(game, player)) return next(err);

        // the creation itself
        delete game.players[player.name];
        updateGameReturnPlayer(game, next, res, player);
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
        res.jsonp(req.game.players);
    };
};

