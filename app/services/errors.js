/**
 * User: amira
 * Date: 11/30/13
 * Time: 3:03 AM
 */

/**
 * nodules dependencies
 */
var util = require('util');


function NotFound(message){
    NotFound.super_.call(this, message);
    this.name = 'not found';
    this.message = message;
    Error.captureStackTrace(this, arguments.callee);
}
util.inherits(NotFound, Error);
module.exports.NotFound = NotFound;