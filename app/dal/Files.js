/**
 * module for streams-based CRD operations on files
 * User: amira
 * Date: 11/23/13
 * Time: 2:35 PM
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

    options.collectionName = options.collectionName + '.files';
    var metadataDao = new (require('../dal/Dao'))(app, options);


    /**
     * get a Dao object for the metadata entity
     */
    this.getMetadataDao = function(){
        return metadataDao;
    }

    /**
     * Create a file
     *
     * Options, mainly:
     *  - **filename** {String}, filename for this file, no unique constrain on the field.
     *  - **content_type** {String}, mime type of the file. Defaults to **{GridStore.DEFAULT_CONTENT_TYPE}**.
     *  - **metadata** {Object}, arbitrary data the user wants to store.
     *
     * @param readableStream  input stream of the file
     * @param options filename + <a href="http://mongodb.github.io/node-mongodb-native/api-generated/gridstore.html">GridStore c'tor options</a>
     * @param callback function(err, data) to call.
     */
    this.insert = function(readableStream, options, callback){
        // use pause stream to close the pipe until its connected to an open mongo file
        var pStream = pauseStream();
        readableStream.pipe(pStream.pause());
        app.logger.debug('inserting file: '+ filename);
        var id = null;
        var filename = utils.popAttr(options, 'filename');
        options.root = root;
        new GridStore(app.db, id, filename , 'w', options)
            .open(function(err, gridFile) {
                if(err) return callback(err);
                // connect paused pipe to the open mongo file (it's a writable stream)
                pStream.pipe(gridFile);
                app.logger.debug("Opened mongo gridFs file " + filename);
                // listen for file end
                gridFile.on('close', function() {
                    app.logger.debug("Written mongo gridFs file " + filename);
                    gridFile.close(callback);
                });
                // open the pipe and let the data flow
                pStream.resume();
            });
    };

    /**
     * removes a file
     */
    this.remove = function(fileMetaData, callback){
        new GridStore(app.db, fileMetaData._id, 'r', {'root' : root})
            .open(function(err, gridFile) {
                if(err) return callback(err);
                app.logger.debug("Opened mongo gridFs file " + fileMetaData._id);
                gridFile.unlink(function(err, gridFile) {
                    if(err) return callback(err);
                    app.logger.debug("Deleted mongo gridFs file " + fileMetaData._id);
                    gridFile.close(callback);
                });
            });
    };


    /**
     * reads a file
     */
    this.load = function(fileMetaData, writeableStream, callback){
        new GridStore(app.db, fileMetaData._id, null, 'r', {'root' : root})
            .open(function(err, gridFile) {
                if(err) return callback(err);
                app.logger.debug("Opened mongo gridFs file " + fileMetaData._id);
                gridFile.on('close', function() {
                    app.logger.debug("Read mongo gridFs file " + fileMetaData._id);
                    gridFile.close(callback);
                });
                // open the pipe and let the data flow
                gridFile.stream().pipe(writeableStream);
            });
    };
}