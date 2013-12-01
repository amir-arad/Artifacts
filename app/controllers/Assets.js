/**
 * Controller for the asset entity lifecycle management.
 * User: amira
 * Date: 11/22/13
 * Time: 8:29 PM
 */

module.exports = function (app, config){

    /**
     * Module dependencies.
     */
    var busboy = require('connect-busboy');
    var _ = require('underscore');

    /**
     * Find asset by id,
     */
    this.asset = function(req, res, next, id) {
        // constraint on artifact unless adding to artifact
        var artifact = req.method === 'PUT' ? null : req.artifact;
        app.services.assets.asset(req.game, artifact, id, false, function (err, asset) {
            if (err) return next(err);
            req.asset = asset;
            return next();
        });
    };

    /**
     * Find asset in artifact - by filename
     */
    this.assetAsFile = function(req, res, next, fileName) {
        var game = req.game;
        var artifact = req.artifact;
        app.services.assets.asset(req.game, artifact, fileName, true, function(err, asset) {
            if (err) return next(err);
            req.asset = asset;
            return next();
        });
    };

    /**
     * Create an asset
     * This means streaming up the content as files
     */
    this.create = [busboy({limit : {fields : 0, files : 5, fileSize : config.gridfs.fileSizeLimit}}),        // use busboy middleware see https://github.com/mscdex/connect-busboy
        function(req, res, next) {
            if (!req.busboy) return next(new Error('busboy not initialized'));
            var waitCounter = 1;            // the form itself is 1
            var resVals = [];
            var artifacts = [];
            if (req.artifact) artifacts.push(req.artifact._id);

            req.busboy.on('file', function(fieldname, stream, filename, encoding, contentType) {
                if (!filename) {
                    // submitted file field with no file in it.
                    // consume stream so busboy will finish
                    stream.on('readable', stream.read);
                } else {
                    waitCounter++;                   // each file adds 1
                    app.logger.debug("file : " + filename);
                    app.services.assets.create(req.game, artifacts, filename, contentType, stream, function(err, file){
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

            req.busboy.on('end', endOfFileWriteOrFormInput);
            app.logger.debug("connecting request to busboy");
            req.pipe(req.busboy);
        }];


    function parseItems(raw) {
        return raw ? ( typeof raw === 'string' ? raw.split(' ') : raw ) : [];
    }

    /**
     * Update an asset's affiliation to artifact
     */
    this.changeArtifact = function(req, res, next) {
        app.services.assets.changeArtifact(req.asset, req.artifact, req.method !== 'DELETE', function(err, asset) {
            if (err) return next(err);
            res.jsonp(asset);
        });
    };

    /**
     * Update an asset
     */
    this.update = function(req, res, next) {
        var newAsset =  _.clone(req.body);
        newAsset['metadata.artifacts'] = parseItems(req.body['metadata.artifacts']);
        app.services.assets.update(req.asset, newAsset, function(err, asset) {
            if (err) return next(err);
            res.jsonp(asset);
        });
    };

    /**
     * Delete an asset
     */
    this.destroy = function(req, res, next) {
        app.services.assets.destroy(req.asset, function(err, asset) {
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
        app.services.assets.readContent(asset, res, function(err){
            if (err) return next(err);
            if(!res.finished) return next(err);
        });
    };

    /**
     * List of assets
     * may be filtered by game or artifact if present in the request context
     */
    this.list = function(req, res, next) {
        app.services.assets.list(req.game, req.artifact, function(err, assets) {
            if (err) return next(err);
            res.jsonp(assets);
        });
    };
};
