/**
 * Service for the game entity lifecycle management.
 * User: amira
 * Date: 11/21/13
 * Time: 9:27 PM
 */

var _ = require('underscore');
var util = require('util');
var errors = require('./errors');

module.exports = function (app, config){

    /**
     * Module dependencies.
     */
    var dao = new (require('../dal/Dao'))(app, {
            'collectionName':'games',
            'listFields':['name', 'description']
        });

    /**
     * Find game by id
     */
    this.game = function(id, callback) {
        dao.load(id, function(err, game) {
            if (err) return callback(err);
            if (!game) return callback(new errors.NotFound('Failed to load game ' + id));
            return callback(null, game);
        });
    };

    /**
     * Create a game
     */
    this.create = function(name, password, callback) {
        if (!name) return callback(new Error('No game name'));
        if (!password) return callback(new Error('No game password'));

        var game = {
            name : name,
            password : password,
            players : {}
        };

        dao.insert(game, callback);
    };

    /**
     * Update a game
     */
    this.update = function(game, newFields, callback) {
        if (!game || !game._id) return callback(new Error('No game ' + artifact));
        newFields = _.clone(newFields);
        newFields._id = game._id;

        dao.updateFields(newFields, ['name', 'password', 'description'], callback);
    };

    /**
     * Delete a game
     */
    this.destroy = function(game, callback) {
        if (!game || !game._id) return callback(new Error('No game ' + artifact));

        // TODO remove all related assets
        dao.remove(game, callback);
    };

    /**
     * List of games
     */
    this.list = function(callback) {
        dao.list(callback);
    };
};
