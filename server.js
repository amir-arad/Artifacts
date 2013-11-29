/**
 * Module dependencies.
 */
var express = require('express');
var fs = require('fs');
var mongodb = require('mongodb');
var passport = require('passport');

/**
 * Main application entry file.
 * Please note that the order of loading is important.
 */
var config = require('./config/config');

// mongoose.connect(config.db);

//Bootstrap models
/*var models_path = __dirname + '/app/models';
var walk = function(path) {
    fs.readdirSync(path).forEach(function(file) {
        var newPath = path + '/' + file;
        var stat = fs.statSync(newPath);
        if (stat.isFile()) {
            if (/(.*)\.(js$|coffee$)/.test(file)) {
                require(newPath);
            }
        } else if (stat.isDirectory()) {
            walk(newPath);
        }
    });
};
walk(models_path);*/

// TODO bootstrap passport config
// require('./config/passport')(passport);

var app = express();
app.logger = require('./config/logger');

// first connect to DB
require('./config/mongo')(app, config, function(err, db){
    if(err){
        throw err;
    }
    app.db = db;
    app.logger.info("DB is connected");

    //express settings
    require('./config/express')(app, config, passport, db);

    //Bootstrap routes
    require('./config/routes')(app, config, passport);

    if (config.bootstrapSampleGame){
        //Bootstrap sample game
        require('./sampleGame')(app, config);
    }

    //Start the app by listening on <port>
    var port = process.env.PORT || config.port;
    app.listen(port);
    app.logger.info('Express app started on port ' + port);

    //expose app
    exports = module.exports = app;
});
