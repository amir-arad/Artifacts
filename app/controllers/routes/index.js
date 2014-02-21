
var http = require('./http.js');
var socket = require('./socket.js');

module.exports = function(app, config, passport) {
    http(app, config, passport);
    socket(app, config);
};