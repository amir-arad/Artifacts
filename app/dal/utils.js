/**
 * common utilities for the mongo DAL
 * User: amira
 * Date: 11/23/13
 * Time: 12:57 PM
 */

var ObjectId = require("mongodb").ObjectID;

function formatListFields(listFields) {
    if (typeof listFields === 'array') {
        // format list fields from array to projection object
        var formatted = {};
        for (var i = 0; i < listFields.length; ++i) {
            formatted[listFields[i]] = true;
        }
        return formatted;
    }
    return listFields;
}

module.exports.getListFunction = function getListFunction(listFields, collection) {
    if (listFields){
        listFields = formatListFields(listFields);
        return function(query){
            return collection.find(query, listFields);
        }
    } else {
        return collection.find;
    }
}

module.exports.getSelectorById = function getSelectorById(options, id, wrapWithObj) {
    var res = {};
    res[options.id] = (wrapWithObj ? new ObjectId(id) : id);
    return res;
}


module.exports.popAttr = function popAttr(options, attrName) {
    var res = options[attrName];
    delete options[attrName];
    return res;
}
module.exports.endsWith = function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}