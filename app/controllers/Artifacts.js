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
    var _ = require('underscore'),
    // define dao for artifacts
        dao = new (require('../dal/Dao'))(app, {
            'collectionName':'artifacts',
            'listFields':['name', 'location']
        });

    /**
     * Find artifact by id
     */
    this.artifact = function(req, res, next, id) {
        var game = req.game;
        if (!game || !game._id) return next(new Error('No game id ' + game));
        dao.load(id, function(err, artifact) {
            if (err) return next(err);
            if (!artifact) return next(new Error('Failed to load artifact ' + id));
            if (!artifact.game || !artifact.game.equals(game._id)) return next(new Error('Artifact does not match game ' + artifact));
            req.artifact = artifact;
            return next();
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
    this.create = function(req, res, next) {
        var artifact = req.body;
        var game = req.game;
        var err;

        artifact.game = game._id;
        artifact.assets = [];

        // validation
        if (err = validateGameAndLocation(game, artifact)) return next(err);

        dao.insert(artifact, function(err) {
            if (err) return next(err);
            res.jsonp(artifact);
        });
    };

    /**
     * Update an artifact
     */
    this.update = function(req, res, next) {
        var artifact = utils.updateCopyExcept(req.artifact, req.body, ['_id', 'game']);

        // TODO BL to validate location

        dao.update(artifact, function(err) {
            if (err) return next(err);
            res.jsonp(artifact);
        });
    };

    /**
     * Delete an artifact
     */
    this.destroy = function(req, res, next) {
        var artifact = req.artifact;
        // TODO remove all related assets
        dao.remove(artifact, function(err) {
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
        var game = req.game;
        dao.list({'game' : game._id}, function(err, games) {
            if (err) return next(err);
            res.jsonp(games);
        });
    };

    /**
     * List of artifacts in a game
     */
    this.listByPlayer = function(req, res, next) {
        var game = req.game;
        var player = req.player;
        dao.list({'game' : game._id, 'location' : player.name}, function(err, games) {
            if (err) return next(err);
            res.jsonp(games);
        });
    };
};
