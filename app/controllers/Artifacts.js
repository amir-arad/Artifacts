/**
 * Controller for the artifact entity lifecycle management.
 * User: amira
 * Date: 11/22/13
 * Time: 4:48 PM
 */

module.exports = function (app, config){
    /**
     * Module dependencies.
     */
    var service = new (require('../services/artifacts'))(app, config);

    /**
     * Find artifact by id
     */
    this.artifact = function(req, res, next, id) {
        service.artifact(req.game, id, function(err, artifact){
            if (err) return next(err);
            req.artifact = artifact;
            return next();
        });
    };

    /**
     * Create an artifact
     */
    this.create = function(req, res, next) {
        service.create(req.game, req.body, function(err, artifact){
            if (err) return next(err);
            res.statusCode = 201;
            res.jsonp(artifact);
        });
    };

    /**
     * Update an artifact
     */
    this.update = function(req, res, next) {
        service.update(req.artifact, req.body, function(err, artifact) {
            if (err) return next(err);
            res.jsonp(artifact);
        });
    };

    /**
     * Delete an artifact
     */
    this.destroy = function(req, res, next) {
        service.destroy(req.artifact, function(err, artifact) {
            if (err) return next(err);
            res.jsonp(artifact);
        });
    };

    /**
     * Show an artifact
     */
    this.show = function(req, res) {
        res.jsonp(req.artifact);
    };

    /**
     * List of artifacts in a game
     */
    this.listByGame = function(req, res, next) {
        service.listByGame(req.game, function(err, artifacts) {
            if (err) return next(err);
            res.jsonp(artifacts);
        });
    };

    /**
     * List of artifacts in a game
     */
    this.listByPlayer = function(req, res, next) {
        service.listByPlayer(req.game, req.player, function(err, artifacts) {
            if (err) return next(err);
            res.jsonp(artifacts);
        });
    };
};
