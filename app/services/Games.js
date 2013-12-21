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
        'listFields':['name', 'description'],
        // index games uniquely by name
        'index':['name'],
        'indexOptions':['unique']
    });

    /**
     * Find game by name, query, or game entity
     */
    this.game = function(query, callback) {
        query = (typeof query === 'string')? {name : query} : query;
        dao.load(query, function(err, game) {
            if (err) return callback(err);
            if (!game) return callback(new app.errors.NotFound('Failed to load game ' + query));
            return callback(null, game);
        });
    };

    /**
     * Find game by name, query, or game entity
     */
    this.defaultGame = function(callback) {
        var query = {'default' : true};
        dao.load(query, function(err, game) {
            if (err) return callback(err);
            if (!game) return callback(new app.errors.NotFound('Failed to find default game ' + query));
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

        dao.updateFields(newFields, ['name', 'password', 'description', 'default'], callback);
    };

    /**
     * Delete a game and all its entities
     */
    this.destroy = function(game, callback) {
        if (!game || !game._id) return callback(new Error('No game ' + artifact));
        async.waterfall([
            // remove the game first so no other artifacts can be added to it
            async.apply(dao.remove, game),
            // theoretically here should be a players deletion logic
            // but the DB model puts the players inside the game document so it's unnecesarry

            // get the game's artifacts
            app.services.artifacts.listByGame,
            function(artifacts, cb){
                // remove artifacts
                async.each(artifacts, app.services.artifacts.destroy, cb);
            },
            // get the game's assets
            async.apply(app.services.assets.list, game, null),
            function(assets, cb){
                // remove assets
                async.each(assets, app.services.assets.destroy, cb);
            },
            // return game to callback
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
