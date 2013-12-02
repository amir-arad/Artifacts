/**
 * Service for the player entity lifecycle management.
 * player resides inside a game entity.
 * using the replacement approach with no locking (functionality first)
 * TODO switch to findAndModify or add optimistic locking
 *
 * User: amira
 * Date: 11/22/13
 * Time: 3:27 PM
 */

var _ = require('underscore');
var util = require('util');

module.exports = function (app, config){
    /**
     * Module dependencies.
     */
    var dao = new (require('../dal/Dao'))(app, {'collectionName':'games'});

    /**
     * Find player by id
     */
    this.player = function(game, playerName, callback) {
        if (!game) return new Error('Must specify game');
        var player = game.players[playerName];
        if (!player) return callback(new app.errors.NotFound('Failed to load player ' + playerName));
        return callback(null, player);
    };

    function validateGameAndName(game, player){
        if (!game || !game._id) return new Error('Must specify game id');
        if (!player || !player.name) return new Error('Must specify player name');
        return null;
    }

    function wrapCallback(player, callback){
        return function(err, game){
            if (err) return callback(err);
            return callback(null, (player.name && game.players[player.name]) || player);
        };
    }
    /**
     * Create a player
     */
    this.create = function(game, player, callback) {
        var err;
        // validation
        if (err = validateGameAndName(game, player)) return callback(err);
        if (game.players[player.name]) return callback(new Error('Player name already exists ' + player.name));

        // the creation itself
        game.players[player.name] = player;
        dao.updateFields(game, getPlayerFields(player.name), wrapCallback(player, callback));
    };

    function getPlayerFields(name) {
        return ['players.' + name + '.name',
            'players.' + name + '.password',
            'players.' + name + '.description'];
    }

    /**
     * Update a player
     */
    this.update = function(game, player, newFields, callback) {
        var err;
        // validation
        if (err = validateGameAndName(game, player)) return next(err);
        newFields = _.clone(newFields);
        newFields.name = player.name;

        // the creation itself
        game.players[player.name] = newFields;
        dao.updateFields(game, getPlayerFields(player.name), wrapCallback(player, callback));
    };

    /**
     * Delete an game
     */
    this.destroy = function(game, player, callback) {
        var err;
        // validation
        if (err = validateGameAndName(game, player)) return callback(err);

        // the deletion itself
        delete game.players[player.name];      // just in case
        var fields = {};
        fields['players.' + player.name] = '$unset';
        dao.updateFields(game, fields, wrapCallback(player, callback));
    };

    /**
     * List of games
     */
    this.list = function(game, callback) {
        if (!game || !game.players) return callback(new Error('Corrupted game'));
        return callback(null, _.values(game.players));
    };
};

