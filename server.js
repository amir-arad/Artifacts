/**
 * Module dependencies.
 */
var express = require('express.io');
var mongodb = require('mongodb');
var passport = require('passport');
var http = require('http')
var fs = require('fs');
var _ = require('underscore');

/**
 * Main application entry file.
 * Please note that the order of loading is important.
 */
var config = require('./config/config');

var app = express();
app.logger = require('./config/logger');
process.on('exit', function () {
    app.logger.info("Exit detected");
});
var keypath = require("keypath");

// first connect to DB
require('./config/mongo')(app, config, function(err, db){
    if(err) throw err;
    app.db = db;
    app.logger.info("DB is connected");

    //express settings
    require('./config/express')(app, config, passport, db);

    // errors
    require('./config/errors')(app, config);
    // load services from the app/services folder
    app.services = {};
    fs.readdir('./app/services', function (err, files) {
        if(err) throw err;
        _.each(files, function(fileName){
            var service = require('./app/services/' + fileName);
            var serviceName = fileName.split('.')[0].toLowerCase();
            app.services[serviceName] = new service(app, config);
            app.logger.info('loaded service ' + fileName);
        });

        // bootstrap routes
        require('./app/controllers/routes')(app, config, passport);

        function startServer(err){
            if(err) throw err;
            // start the app by listening on <port>
            var port = process.env.PORT || config.port;
            app.listen(port);
            app.logger.info('Artifacts server started on port ' + port);
            // expose app
            exports = module.exports = app;
        }

        if (config.bootstrapSampleGame){
            // bootstrap sample game
            require('./sampleGame')(app, config, startServer);
        } else {
            startServer();
        }

    });
});
