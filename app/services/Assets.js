/**
 * Service for the asset entity lifecycle management.
 * User: amira
 * Date: 11/22/13
 * Time: 8:29 PM
 */

module.exports = function (app, config){

    /**
     * Module dependencies.
     */
    var errors = require('./errors');
    var _ = require('underscore');

    // define dao for asset files and metadatas
    var files = new (require('../dal/Files'))(app, {
        'collectionName': config.gridfs.bucket,
        'listFields': ['length', 'filename', 'contentType', 'uploadDate', 'metadata']
    });
    var dao = files.getMetadataDao();

    /**
     * Find asset by id,
     */
    this.asset = function(game, artifact, id, asFile, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        var query = asFile ? {'filename' : id} : dao.getSelectorById(id, true);
        query['metadata.game'] = game._id;
        if (artifact){
            if (!artifact._id) return callback(new Error('No artifact id ' + artifact));
            query['metadata.artifacts'] = artifact._id;
        }
        app.logger.debug("query : " + query);
        dao.load(query, function(err, asset) {
            if (err) return callback(err);
            if (!asset) return callback(new errors.NotFound('Failed to load asset ' + id));
            if (!asset.metadata.artifacts) return callback(new Error('Corrupted asset ' + asset));
            return callback( null, asset);
        });
    };

    /**
     * Create an asset
     * This means streaming up the content as files
     */
    this.create = function(game, artifacts, filename, contentType, stream, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        if (!filename) return callback(new Error('No filename'));
        if (!contentType) return callback(new Error('No contentType'));
        if (!artifacts) return callback(new Error('No artifacts'));
        if (!stream) return callback(new Error('No stream'));
        var fileOptions = {
            'filename' : filename,
            'content_type' : contentType,
            'metadata' : {
                'game' : game._id,
                'artifacts' : artifacts
            }
        };
        files.insert(stream, fileOptions, function(err, file) {
            if (err) return callback(err);
            if (!file) return callback(new Error('Failed to create asset ' + filename));
            return callback( null, file);
        });
    }

    this.changeArtifact = function(asset, artifact, add, callback){
        if (!asset || !asset._id) return callback(new Error('No asset id ' + asset));
        if (!artifact || !artifact._id) return callback(new Error('No artifact id ' + artifact));
        var operation = add ? '$push' : '$pull';
        dao.updateFields({'_id': asset._id, 'metadata.artifacts': artifact._id}, {'metadata.artifacts' : operation}, callback);
    };

    this.update = function(asset, newFields, callback){
        if (!asset || !asset._id) return callback(new Error('No asset id ' + asset));
        newFields = _.clone(newFields);
        newFields._id = asset._id;
        // does not allow edit of content-bound fields (like length, md5 etc)
        dao.updateFields(newFields, ['filename', 'contentType', 'aliases', 'metadata.artifacts'], callback);

    };

    /**
     * Delete an asset
     */
    this.destroy = function(asset, callback) {
        if (!asset || !asset._id) return callback(new Error('No asset id ' + asset));
        files.remove(asset, callback);
    };

    /**
     * Show an asset
     */
    this.readContent = function(asset, stream, callback) {
        if (!asset || !asset._id) return callback(new Error('No asset id ' + asset));
        if (!stream || stream.finished) return callback(new Error('No readable stream'));
        files.load(asset, stream, callback);
    };

    /**
     * List of assets
     * may be filtered by game or artifact if present in the request context
     */
    this.list = function(game, artifact, callback) {
        if (!game || !game._id) return callback(new Error('No game id ' + game));
        var query = {'metadata.game' : game._id};
        if (artifact) query['metadata.artifacts'] = artifact._id;
        dao.list(query, callback);
    };
};
