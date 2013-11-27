/**
 * Controller for the asset entity lifecycle management.
 * User: amira
 * Date: 11/22/13
 * Time: 8:29 PM
 */

/**
 * Module dependencies.
 */
var Busboy = require('busboy');
var utils = require('./utils');


module.exports = function (app, config){
    // define dao for asset files and metadatas
    var files = new (require('../dal/Files'))(app, {
        'collectionName': config.gridfs.bucket,
        'listFields': ['length', 'filename', 'contentType', 'uploadDate', 'metadata']
    });
    var dao = files.getMetadataDao();

    /**
     * Find asset by id,
     */
    this.asset = function(req, res, next, id) {
        var game = req.game;
        var artifact = req.artifact;
        if (!game || !game._id) return next(new Error('No game id ' + game));
        var query = {
            '_id' : dao.id(id),
            'metadata.game' : game._id
        };
        if (artifact && req.method !== 'PUT'){
            // asset expected to be in an artifact
            if (!artifact._id) return next(new Error('No artifact id ' + artifact));
            query['metadata.artifacts'] = artifact._id;
        }
        dao.load(query, function(err, asset) {
            if (err) return next(err);
            if (!asset) return next(new Error('Failed to load asset ' + id));
            if (!asset.metadata.artifacts) return next(new Error('Corrupted asset ' + asset));
            req.asset = asset;
            return next();
        });
    };

    /**
     * Find asset by id,
     * or if in artifact - by filename
     */
    this.assetAsFile = function(req, res, next, id) {
        var game = req.game;
        var artifact = req.artifact;
        if (!game || !game._id) return next(new Error('No game id ' + game));
        if (!artifact || !artifact._id) return next(new Error('No artifact id ' + artifact));
        // Find asset by in artifact by filename
        var query = {
            'filename' : id,
            'metadata.game' : game._id,
            'metadata.artifacts' : artifact._id
        };
        dao.load(query, function(err, asset) {
            if (err) return next(err);
            if (!asset) return next(new Error('Failed to load asset ' + id));
            req.asset = asset;
            return next();
        });
    };

    /**
     * Create an asset
     * This means streaming up the content as files
     */
    this.create = function(req, res, next) {
        // see https://github.com/mscdex/busboy
        var busboy = new Busboy({ headers: req.headers });
        var waitCounter = 1;            // the form itself is 1
        var resVals = [];
        var artifacts = [];
        if (req.artifact) artifacts.push(req.artifact._id);

        busboy.on('file', function(fieldname, stream, filename, encoding, contentType) {
            if (typeof filename === 'undefined') {
                // submitted file field with no file in it.
                // consume stream so busboy will finish
                stream.on('readable', stream.read);
            } else {
                waitCounter++;                   // each file adds 1
                app.logger.debug("file : " + filename);
                var fileOptions = {
                    'filename' : filename,
                    'content_type' : contentType,
                    'metadata' : {
                        'game' : req.game._id,
                        'artifacts' : artifacts
                    }
                };
                files.insert(stream, fileOptions, function(err, file){
                    if (err) return next(err);
                    app.logger.info("asset created " + file);
                    // settings
                    resVals.push(file);
                    endOfFileWriteOrFormInput();
                });
            }
        });
        // at the end of the last file write, or the form's input, send resVals to the client
        function endOfFileWriteOrFormInput() {
            waitCounter--;
            // wait until all files are finished
            if (waitCounter == 0) {
                if(res.finished) return;
                res.statusCode = 201;
                res.jsonp(resVals);
            }
        }

        busboy.on('end', endOfFileWriteOrFormInput);
        app.logger.debug("connecting request to busboy");
        req.pipe(busboy);
    };


    function parseItems(raw) {
        return raw ? raw.split(' ') : [];
    }

    function arrayRemove(array, val) {
        return array.filter(function (e) {
            return ! val.equals(e);
        });
    }

    /**
     * Update an assets
     */
    this.update = function(req, res, next) {
        var asset = req.asset;
        var game = req.game;
        var artifact = req.artifact;
        if (!game || !game._id) return next(new Error('No game id ' + game));
        if (!asset || !asset._id) return next(new Error('No asset id ' + asset));
        if (artifact){
            if (!artifact._id) return next(new Error('No artifact id ' + artifact));
            switch (req.method) {
                case 'DELETE':
                    asset.metadata.artifacts = arrayRemove(asset.metadata.artifacts, artifact._id);
                    break;
                case 'PUT':
                    asset.metadata.artifacts = arrayRemove(asset.metadata.artifacts, artifact._id);
                    asset.metadata.artifacts.push(artifact._id);
                    break;
                default :
                    return next(new Error('Unknown method for artifact update operation : ' + req.method));
                    break;
            }
        } else {
            asset = utils.updateCopyExcept(asset, req.body, ['_id', 'artifacts']);
            asset.game = game._id;
            asset.metadata.artifacts = parseItems(req.body.artifacts);
        }
        dao.update(asset, function(err) {
            if (err) return next(err);
            res.jsonp(asset);
        });
    };

    /**
     * Delete an assets
     */
    this.destroy = function(req, res, next) {
        var asset = req.asset;
        files.remove(asset, function(err) {
            if (err) return next(err);
            res.jsonp(asset);
        });
    };

    /**
     * Show an asset
     */
    this.show = function(req, res, next) {
        var asset = req.asset;
        res.setHeader("Content-Type", asset.contentType);
        res.setHeader("Content-Length", asset.length);
        res.setHeader("Content-MD5", asset.md5);
        files.load(req.asset, res, function(err){
            if (err) return next(err);
            if(!res.finished) return next(err);
        });
    };
    /**
     * List of assets
     * may be filtered by game or artifact if present in the request context
     */
    this.list = function(req, res, next) {
        var game = req.game;
        var artifact = req.artifact;
        var query = {};
        if (game) query['metadata.game'] = game._id;
        if (artifact) query['metadata.artifacts'] = artifact._id;
        dao.list(query, function(err, assets) {
            if (err) return next(err);
            res.jsonp(assets);
        });
    };
};
