/**
 * User: amira
 * Date: 11/23/13
 * Time: 12:35 PM
 */

var mongodb = require('mongodb');

module.exports = function(app, config, callback) {
    // Bootstrap db connection
    mongodb.MongoClient.connect(config.db, function(err, db) {
        if(err) return callback(err, null);
        // hook on exit event to gracefully close the DB
        process.on('exit', function () {
            app.logger.info("closing DB...");
            db.close();
        });
        if (config.gridfs.initTest){
            return testFiles(app, db, config, callback);
        } else {
            return callback(null, db);
        }
    });
};

function testFiles(app, db, config, callback) {
    app.logger.info("testing write-read-delete operations on gridFS");
    var grid = new mongodb.Grid(db, config.gridfs.bucket);
    var buffer = new Buffer("Test buffer");
    grid.put(buffer, {metadata: {category: 'text'}, content_type: 'text', fileName: 'startup.test'}, function (err, fileInfo) {
        if (err) return callback(err, null);
        app.logger.debug("Finished writing file to Mongo");
        grid.get(fileInfo._id, function (err, data) {
            if (err) return callback(err, null);
            app.logger.debug("Finished reading file from Mongo");
            grid.delete(fileInfo._id, function (err, result) {
                if (err) return callback(err, null);
                app.logger.debug("Finished deleting file from Mongo");
                app.logger.info("successful write-read-delete operations on gridFS");
                return callback(null, db);
            });
        });
    });
}
