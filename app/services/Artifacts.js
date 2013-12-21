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
        'listFields':['name', 'location', 'owner', 'icon'],
        // index by game + location (the most common query in the system)
        'index':{'game' : 1, 'owner': 1, 'location' : '2dsphere'}
    });
    var attributes = ['name', 'location', 'description', 'owner', 'body', 'icon', 'images'];
    var mutableAttributes = _.without(attributes, 'name');

    function id(game, name){
        return game._id.toHexString() + '-' + name.toLowerCase();
    }
    /**
     * Find artifact by name
     */
    this.artifact = function(game, name, callback) {
        if (!game || !game._id) return callback(new Error('No game name ' + game));
        dao.load({_id : id(game, name)}, function(err, artifact) {
            if (err) return callback(err);
            if (!artifact) return callback(new app.errors.NotFound('Failed to load artifact ' + name));
            return callback(null, artifact);
        });
    };

    function validateOwnerOrLocation(game, artifact){
        if (artifact.owner) {
            delete artifact.location;
            // TODO check super locations ('everywhere')
            if (!game.players[artifact.owner] && artifact.owner !== 'everywhere'){
                return new Error('Illegal owner ' + artifact.owner);
            }
        } else {
            delete artifact.owner;
            if (!artifact.location) return new Error('No owner nor location ' + artifact);
        }
        return null;
    }

    /**
     * Create an artifact
     */
    this.create = function(game, artifact, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        if (!artifact || !artifact.name) return callback(new Error('No artifact name ' + artifact));
        artifact = _.pick(artifact, attributes);
        artifact.game = game._id;
        artifact._id = id(game, artifact.name);
        // validation
        var err = validateOwnerOrLocation(game, artifact);
        if (err) return callback(err);
        dao.insert(artifact, callback);
    };

    /**
     * Update an artifact
     */
    this.update = function(artifact, newFields, callback) {
        if (!artifact || !artifact._id || !artifact.game) return callback(new Error('Corrupt artifact ' + artifact));
        newFields = _.defaults(_.pick(newFields, mutableAttributes), artifact);

        // TODO deletes all fields except for ID!!!!
        // validation
        app.services.games.game(newFields.game, function(err, game){
            if (err) return callback(err);
            err = validateOwnerOrLocation(game, newFields);
            if (err) return callback(err);
            // TODO BL to validate location

            dao.updateFields(newFields, mutableAttributes, callback);
        });
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
     * List of artifacts by a owner
     */
    this.listByPlayer = function(game, owner, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        if (!owner || !owner.name) return callback(new Error('No owner name ' + game));
        dao.list({'game' : game._id, 'owner' : owner.name}, callback);
    };
};
