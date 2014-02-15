/**
 * Service for the artifact entity lifecycle management.
 * User: amira
 * Date: 11/22/13
 * Time: 4:48 PM
 */

var _ = require('underscore');
var util = require('util');
var async = require('async');
var Messaging = require('./Messaging');

module.exports = function (app, config){
    /**
     * Module dependencies.
     */
    var dao = new (require('../dal/Dao'))(app, {
        'collectionName':'artifacts',
        'useObjectId':false,
        'listFields':['name', 'location', 'owner', 'icon'],
        // index by game + location (the most common query in the system)
        'index':{'game' : 1, 'owner': 1, 'location' : '2dsphere'}
    });
    var attributes = ['name', 'location', 'description', 'owner', 'body', 'icon', 'images'];
    var mutableAttributes = _.without(attributes, 'name');
    var _this = this;

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
            artifact.location = null;
            // TODO check super locations ('everywhere')
            if (!game.players[artifact.owner] && artifact.owner !== 'everywhere'){
                return new Error('Illegal owner ' + artifact.owner);
            }
        } else {
            artifact.owner = null;
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

        dao.insert(artifact, function(err, artifact){
            if (err) return callback(err);
            if (artifact.owner) {
                app.services.messaging.emit([game.name, artifact.owner, 'add'], artifact);   // someone has gained an artifact
            }
            return callback(null, artifact);
        });
    };

    /**
     * Update an artifact
     */
    this.update = function(artifact, newFields, callback) {
        if (!artifact || !artifact._id || !artifact.game) return callback(new Error('Corrupt artifact ' + artifact));
        var newArtifact = _.defaults(_.pick(newFields, mutableAttributes), artifact);
        // validation
        app.services.games.game(newArtifact.game, function(err, game){
            if (err) return callback(err);
            err = validateOwnerOrLocation(game, newArtifact);
            if (err) return callback(err);
            // TODO BL to validate location

            dao.updateFields(newArtifact, mutableAttributes, function(err, newArtifact){
                if (err) return callback(err);
                if (artifact.owner !== newArtifact.owner) {
                    if (artifact.owner){     // someone has lost an artifact
                        app.services.messaging.emit([game.name, 'artifacts', artifact.owner, 'remove'], artifact);
                    } else {
                        app.services.messaging.emit([game.name, 'artifacts', 'nearby', 'remove'], newArtifact);
                    }
                    if (newArtifact.owner){     // someone has gained an artifact
                        app.services.messaging.emit([game.name, 'artifacts', newArtifact.owner, 'add'], newArtifact);
                    } else {
                        app.services.messaging.emit([game.name, 'artifacts', 'nearby', 'add'], newArtifact);
                    }
                }
                return callback(null, newArtifact);
            });
        });
    };

    this.transfer = function(game, src, artifact, dst, callback){
        if (!artifact || !artifact._id || !artifact.game) return callback(new Error('Corrupt artifact ' + artifact));
        if (artifact.owner === dst) return callback(null, artifact);   // meaningless action, no need for noise
        if (artifact.owner !== src) return callback(new Error('Artifact '+artifact.name+' does not belong to ' + src));

        dao.selectAndUpdateFields({_id:artifact._id, game:game._id, owner:src}, {owner:dst}, ['owner'],
            function(err, newArtifact){
                if (err) return callback(err);
                app.services.messaging.emit([game.name, 'artifacts', src, 'remove'], artifact);  // someone has lost an artifact
                app.services.messaging.emit([game.name, 'artifacts', dst, 'add'], newArtifact);  // someone has gained an artifact
                return callback(null, newArtifact);
            });
    }

    this.give = function(game, from, artifact, to, callback) {
        if ('everywhere' !== to) return callback(new Error('Artifact '+artifact.name+' cannot be given to ' + to));
        // TODO add location query, should be ok to give to nearby players
        return this.transfer(game, from, artifact, to, callback);
    };

    this.take = function(game, to, artifact, from, callback) {
        if ('everywhere' !== from) return callback(new Error('Artifact '+artifact.name+' cannot be taken from ' + from));
        return this.transfer(game, from, artifact, to, callback);
    };

    this.drop = function(player, artifact, callback) {
        if (artifact.owner !== player.name) return callback(new Error('Artifact '+artifact.name+' cannot be dropped by ' + player.name));
        if (!player.location) return callback(new Error('Player '+player.name+' has no registered location'));
        this.update(artifact, {location : player.location, owner : null}, callback);
    };

    this.pickup = function(game, player, artifact, callback) {
        if (artifact.owner !== null) return callback(new Error('Artifact '+artifact.name+' cannot be picked up as it is owned by ' + artifact.owner));
        dao.selectAndUpdateFields(
            {_id:artifact._id, 'game' : game._id, owner : null, 'location' : {'$near' : {'$geometry' : player.location , '$maxDistance' : 20}}},
            {owner : player.name},
            {'location' : '$unset', 'owner' : '$set'},
            function(err, artifact){
                if (err) return callback(err);
                app.services.messaging.emit([game.name, 'artifacts', artifact.owner, 'add'], artifact);
                app.services.messaging.emit([game.name, 'artifacts', 'nearby', 'remove'], artifact);
                return callback(null, artifact);
            });
    };

    /**
     * List of artifacts near a location
     * for now, simply query the everywhere context
     * @param game
     * @param location [optional]
     * @param callback
     * @returns {*}
     */
    this.listNearLocation = function(location, game, callback) {
        if (!callback) callback = location; // todo improve using "is function" on location. no location supplied
        dao.list({'location' : {'$near' : {'$geometry' : location , '$maxDistance' : 20}}}, callback);
    };

    /**
     * Delete an artifact
     */
    this.destroy = function(artifact, callback) {
        if (!artifact || !artifact._id) return callback(new Error('No artifact id ' + artifact));
        dao.remove(artifact, function(err, artifact){
            if (err) return callback(err);
            if (artifact.owner){     // someone has lost an artifact
                app.services.messaging.emit([game.name, 'artifacts', artifact.owner, 'remove'], artifact);
            }
            return callback(null, artifact);
        });
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
    this.listByOwner = function(owner, game, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        if (!owner) return callback(new Error('No owner ' + game));
        var ownerName =  typeof owner === 'string' ? owner : owner.name;
        if (!ownerName) return callback(new Error('No owner name ' + owner));
        dao.list({'game' : game._id, 'owner' : ownerName}, callback);
    };
};
