/**
 * Created with IntelliJ IDEA.
 * User: amira
 * Date: 2/8/14
 * Time: 9:36 PM
 * To change this template use File | Settings | File Templates.
 */

var util = require('util');
var events2 = require('eventemitter2');

function Messaging() {
    events2.EventEmitter2.call(this,
        {
            wildcard: true,
            delimiter: '.',
            newListener: false,
            maxListeners: -1
        });
}

util.inherits(Messaging, events2.EventEmitter2);


module.exports = Messaging;