
/**
 * Module dependencies.
 */
var _ = require('underscore');

/**
 * Controller for the artifact entity lifecycle management.
 * User: amira
 * Date: 11/22/13
 * Time: 4:48 PM
 */

module.exports = function (app, config){

    /**
     * Find artifact by id
     */
    this.artifact = function(req, res, next, id) {
        app.services.artifacts.artifact(req.game, id, function(err, artifact){
            if (err) return next(err);
            req.artifact = artifact;
            return next();
        });
    };

    /**
     * Create an artifact
     */
    this.create = function(req, res, next) {
        app.services.artifacts.create(req.game, req.body, function(err, artifact){
            if (err) return next(err);
            res.statusCode = 201;
            res.jsonp(artifact);
        });
    };

    /**
     * Update an artifact
     */
    this.update = function(req, res, next) {
        app.services.artifacts.update(req.artifact, req.body, function(err, artifact) {
            if (err) return next(err);
            res.jsonp(artifact);
        });
    };

    /**
     * Delete an artifact
     */
    this.destroy = function(req, res, next) {
        app.services.artifacts.destroy(req.artifact, function(err, artifact) {
            if (err) return next(err);
            res.jsonp(artifact);
        });
    };

    /**
     * Show an artifact
     */
    this.show = function(req, res, next) {
        // add all its assets
        app.services.assets.list(req.game, req.artifact, function(err, assets) {
            if (err) return next(err);
            req.artifact.assets = _.pluck(assets, 'filename');
            res.jsonp(req.artifact);
        });
    };

    /**
     * Drop an item from the inventory
     */
    this.drop  = function(req, res, next) {
        app.services.artifacts.give(req.game, req.player.name, req.artifact, 'everywhere', function(err, artifact) {
            if (err) return next(err);
            res.jsonp(artifact);
        });
    };

    /**
     * Pick up an item from the nearby context
     */
    this.pickup  = function(req, res, next) {
        app.services.artifacts.take(req.game, req.player.name, req.artifact, 'everywhere', function(err, artifact) {
            if (err) return next(err);
            res.jsonp(artifact);
        });
    };

    /**
     * List of artifacts in the nearby context
     */
    this.nearby  = function(req, res, next) {
        app.services.artifacts.listNearLocation(req.game, req.player.location, function(err, artifacts) {
            if (err) return next(err);
            res.jsonp(artifacts);
        });
    };

    /**
     * List of artifacts in a game context
     */
    this.listByGame = function(req, res, next) {
        app.services.artifacts.listByGame(req.game, function(err, artifacts) {
            if (err) return next(err);
            res.jsonp(artifacts);
        });
    };

    /**
     * List of artifacts in the inventory context
     */
    this.listByPlayer = function(req, res, next) {
        app.services.artifacts.listByOwner(req.game, req.player, function(err, artifacts) {
            if (err) return next(err);
            res.jsonp(artifacts);
        });
    };
};
