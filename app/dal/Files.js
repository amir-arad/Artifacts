/**
 * module for streams-based CRUD operations
 * User: amira
 * Date: 11/23/13
 * Time: 2:35 PM
 * To change this template use File | Settings | File Templates.
 */

var utils = require('./utils');
var pauseStream = require('pause-stream');
var GridStore = require('mongodb').GridStore;
/**
 * Options
 *  - **collectionName**, {String} the name of the collection this dao addresses
 *  - **listFields**, {Object | array, default:[]} the fields to populate when reading a list. empty means all fields should be fetched
 *  - **id**, (String, default:'_id') the id field of the entity
 *
 * @param app
 * @param options
 */
module.exports = function (app, options){
    var root = options.collectionName;
    if (utils.endsWith(root, '.files')){
        root = root.substring(0, root.lastIndexOf('.files'));
    }

    /**
     * Create a file
     *
     * Options, mainly:
     *  - **filename** {String}, filename for this file, no unique constrain on the field.
     *  - **content_type** {String}, mime type of the file. Defaults to **{GridStore.DEFAULT_CONTENT_TYPE}**.
     *  - **metadata** {Object}, arbitrary data the user wants to store.
     *
     * @param stream  input stream of the file
     * @param options filename + <a href="http://mongodb.github.io/node-mongodb-native/api-generated/gridstore.html">GridStore c'tor options</a>
     * @param callback function(err, data) to call.
     */
    this.insert = function(stream, options, callback){
        var pStream = pauseStream();            // use pause stream to close the pipe until its connected to an open mongo file
        stream.pipe(pStream.pause());
        app.logger.debug('inserting file: '+ filename);
        var id = null;
        var filename = utils.popAttr(options, 'filename');
        options.root = root;
        new GridStore(app.db, id, filename , 'w', options)
            .open(function(err, gridFile) {
                if(err) return callback(err);
                pStream.pipe(gridFile);         // connect paused pipe to the open mongo file
                app.logger.debug("Opened mongo gridFs file " + filename);
                // listen for file end
                gridFile.on('close', function() {
                    app.logger.debug("Written mongo gridFs file " + filename);
                    gridFile.close(callback);
                });
                pStream.resume();               // open the pipe and let the data flow
            });
    };

    /**
     * Updates a file
     *
     * Options, mainly:
     *  - **filename** {String}, filename for this file, no unique constrain on the field.
     *  - **content_type** {String}, mime type of the file. Defaults to **{GridStore.DEFAULT_CONTENT_TYPE}**.
     *  - **metadata** {Object}, arbitrary data the user wants to store.
     *
     * @param stream  input stream of the file
     * @param options filename + <a href="http://mongodb.github.io/node-mongodb-native/api-generated/gridstore.html">GridStore c'tor options</a>
     * @param callback function(err, data) to call.
     */
    this.insert = function(stream, options, callback){
        var pStream = pauseStream();            // use pause stream to close the pipe until its connected to an open mongo file
        stream.pipe(pStream.pause());
        app.logger.debug('inserting file: '+ filename);
        var id = null;
        var filename = utils.popAttr(options, 'filename');
        options.root = root;
        new GridStore(app.db, id, filename , 'w', options)
            .open(function(err, gridFile) {
                if(err) return callback(err);
                pStream.pipe(gridFile);         // connect paused pipe to the open mongo file
                app.logger.debug("Opened mongo gridFs file " + filename);
                // listen for file end
                gridFile.on('close', function() {
                    app.logger.debug("Written mongo gridFs file " + filename);
                    gridFile.close(callback);
                });
                pStream.resume();               // open the pipe and let the data flow
            });
    };

    // TODO continue. old stuff for reference :


    var _this = this;
    if (!options.id) options.id = '_id';

// functionality will be added to the dao only after there is a collection
    app.db.collection(options.collectionName, function(err, collection) {
        if (err) throw err;

        _this.collection = collection;

        var list = utils.getListFunction(options.listFields, collection);

        /**
         * Load list of entities
         */
        _this.list = function(query, callback){
            if (typeof query === 'function'){
                callback = query;
                query = {};
            }
            list(query).toArray(callback);
        };

        /**
         * Load an entity by id
         */
        _this.load = function(id, callback){
            collection.findOne(utils.getSelectorById(options, id, true),callback);
        }

        /**
         * Change an entity
         */
        _this.update = function(entity, callback){
            collection.update(utils.getSelectorById(options, entity[options.id]), entity, {'safe':true}, callback);
        };

        /**
         * Delete an entity
         */
        _this.remove = function(entity, callback){
            collection.remove(utils.getSelectorById(options, entity[options.id]), callback);
        };
    });
}