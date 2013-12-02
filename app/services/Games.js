/**
 * Service for the game entity lifecycle management.
 * User: amira
 * Date: 11/21/13
 * Time: 9:27 PM
 */

var _ = require('underscore');
var util = require('util');
var async = require('async');

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
            if (!game) return callback(new app.errors.NotFound('Failed to load game ' + id));
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
        async.waterfall([
            // remove the game first so no other artifacts can be added to it
            async.apply(dao.remove, game),
            // get the game's artifacts
            app.services.artifacts.listByGame,
            function(artifacts, cb){
                // remove artifacts
                async.each(artifacts, app.services.artifacts.destroy, cb);
            },
            // TODO remove assets!
            function(cb){cb(null, game);}
        ], callback);
    };

    /**
     * List of games
     */
    this.list = function(callback) {
        dao.list(callback);
    };
};
