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
     * Find asset by id
     */
    this.asset = function(req, res, next, id) {
        var game = req.game;
        if (!game || !game._id) return next(new Error('No game id ' + game));
        dao.load(id, function(err, asset) {
            if (err) return next(err);
            if (!asset) return next(new Error('Failed to load asset ' + id));
            if (!asset.metadata || !asset.metadata.game) return next(new Error('Corrupted asset ' + asset));
            if (!asset.metadata.game.equals(game._id)) return next(new Error('Asset does not match game ' + asset));
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
        var items = [];

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
                        'items' : items
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

        busboy.on('field', function(fieldname, val, valTruncated, keyTruncated) {
            if (fieldname == 'items'){
                items = parseItems(val);
                if (resVals.length > 0 && items.length > 0){
                    // TODO implement
                    app.logger.error("need to handle items : " + items);
                }
            }
        });

        // at the end of the last file write, or the form's input, send resVals to the client
        function endOfFileWriteOrFormInput() {
            waitCounter--;
            // wait until all files are finished
            if (waitCounter == 0) {
                if(res.finished) return;
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

    /**
     * Update an assets
     */
    this.update = function(req, res, next) {
        var asset = utils.updateCopyExcept(req.asset, req.body, ['_id', 'items']);
        asset.game = game._id;
        asset.metaData.items = parseItems(req.body.items);
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
     * List of assets in a game
     */
    this.listByGame = function(req, res, next) {
        var game = req.game;
        dao.list({'metadata.game' : game._id}, function(err, assets) {
            if (err) return next(err);
            res.jsonp(assets);
        });
    };
};
