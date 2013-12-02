/**
 * Middleware for forms parsing
 * Fix for a security issue with the default (Formidable) connect forms parser.
 * allows fields only (no files), up to 128  bytes long each.
 * puts all fields data in the body
 *
 * User: amira
 * Date: 11/29/13
 * Time: 1:50 PM
 */

var busboy = require('connect-busboy');

/**
 * busboy initialized and if relevant, attaches to req
 */
var setup = busboy({limit : {files : 0, fieldSize : 512}});   // 512 bytes per field

/**
 * all form fields will be attached to req.body just like in connect bodyParser
 */
var fieldsToBody = function(req, res, next) {
    if (!req.body) req.body = {};    // here just in case
    if (req.busboy){
        req.busboy.on('field', function(fieldname, val) {
            req.body[fieldname] = val;
        });
    }
    next();
};

/**
 * start parsing.
 * when form parsing is done, call next middleware
 */
var init  = function(req, res, next) {
    if (req.busboy){
        req.busboy.on('end', next);
        req.pipe(req.busboy);
    } else {
        next();
    }
}

// middleware chain
module.exports = [setup, fieldsToBody, init];
