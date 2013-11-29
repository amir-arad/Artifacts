/**
 * User: amira
 * Date: 11/23/13
 * Time: 12:35 PM
 */

var mongodb = require('mongodb');

module.exports = function(app, config, next) {
    // Bootstrap db connection
    mongodb.MongoClient.connect(config.db, function(err, db) {
        if(err) return next(err, null);
        if (config.gridfs.initTest){
            testFiles(db, config, next, app);
        } else {
            return next(null, db);
        }
    });
}

function testFiles(db, config, next, app) {
    app.logger.info("testing write-read-delete operations on gridFS");
    var grid = new mongodb.Grid(db, config.gridfs.bucket);
    var buffer = new Buffer("Test buffer");
    grid.put(buffer, {metadata: {category: 'text'}, content_type: 'text', fileName: 'startup.test'}, function (err, fileInfo) {
        if (err) return next(err, null);
        app.logger.debug("Finished writing file to Mongo");
        grid.get(fileInfo._id, function (err, data) {
            if (err) return next(err, null);
            app.logger.debug("Finished reading file from Mongo");
            grid.delete(fileInfo._id, function (err, result) {
                if (err) return next(err, null);
                app.logger.debug("Finished deleting file from Mongo");
                app.logger.info("successful write-read-delete operations on gridFS");
                return next(null, db);
            });
        });
    });
}