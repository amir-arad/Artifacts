
/**
 * Created with IntelliJ IDEA.
 * User: amira
 * Date: 11/23/13
 * Time: 5:09 PM
 * To change this template use File | Settings | File Templates.
 */


var _ = require('underscore');

module.exports.writeJsonToRes = function writeJsonPToRes(app, req, res, obj) {
    var replacer = app.get('json replacer');
    var spaces = app.get('json spaces');
    var partOfResponse = JSON.stringify(obj, replacer, spaces)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    res.write(partOfResponse);
};

module.exports.updateCopyExcept = function updateCopyExcept(src, updates, except) {
    var originals = {};
    if (typeof except === 'string'){
        originals[except] = src[except];
    } else if (except instanceof Array){
        for (var i = 0; i < except.length; ++i) {
            originals[except[i]] = src[except[i]];
        }
    }
    return _.extend(_.clone(src), updates, originals);
};

module.exports.nullStream = function(){
    var result = new stream.WriteStream({'decodeStrings': false});
    result._write = function(c, e, cb){cb(null);};
    return result;
};

