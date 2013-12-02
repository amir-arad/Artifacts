/**
 * Service for the artifact entity lifecycle management.
 * User: amira
 * Date: 11/22/13
 * Time: 4:48 PM
 */

var _ = require('underscore');
var util = require('util');

module.exports = function (app, config){
    /**
     * Module dependencies.
     */
    var dao = new (require('../dal/Dao'))(app, {
        'collectionName':'artifacts',
        'listFields':['name', 'description', 'location']
    });

    /**
     * Find artifact by id
     */
    this.artifact = function(game, id, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        dao.load(id, function(err, artifact) {
            if (err) return callback(err);
            if (!artifact) return callback(new app.errors.NotFound('Failed to load artifact ' + id));
            if (!artifact.game || !artifact.game.equals(game._id)) return callback(new Error('Artifact does not match game ' + artifact));
            return callback(null, artifact);
        });
    };

    function validateGameAndLocation(game, artifact){
        if (!artifact.location) return new Error('Must specify artifact location ' + artifact);
        if (typeof artifact.location === 'string' && !game.players[artifact.location]) return new Error('Illegal location ' + artifact.location);
        return null;
    }

    /**
     * Create an artifact
     */
    this.create = function(game, artifact, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        artifact.game = game._id;
        artifact.assets = [];
        // validation
        var err;
        if (err = validateGameAndLocation(game, artifact)) return callback(err);
        dao.insert(artifact, callback);
    };

    /**
     * Update an artifact
     */
    this.update = function(artifact, newFields, callback) {
        if (!artifact || !artifact._id) return callback(new Error('No artifact id ' + artifact));
        newFields = _.clone(newFields);
        newFields._id = artifact._id;

        // TODO BL to validate location

        dao.updateFields(newFields, ['name', 'location', 'description'], callback);
    };

    /**
     * Delete an artifact
     */
    this.destroy = function(artifact, callback) {
        if (!artifact || !artifact._id) return callback(new Error('No artifact id ' + artifact));
        dao.remove(artifact, callback);
    };

    /**
     * List of artifacts in a game
     */
    this.listByGame = function(game, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        dao.list({'game' : game._id}, callback);
    };

    /**
     * List of artifacts owned by a player
     */
    this.listByPlayer = function(game, player, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        if (!player || !player.name) return callback(new Error('No player name ' + game));
        dao.list({'game' : game._id, 'location' : player.name}, callback);
    };
};
