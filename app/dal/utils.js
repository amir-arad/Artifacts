/**
 * common utilities for the mongo DAL
 * User: amira
 * Date: 11/23/13
 * Time: 12:57 PM
 */

var ObjectId = require("mongodb").ObjectID;
var keypath = require("keypath");
/**
 * turn array into object with 'true' values
 */
function formatListFields(listFields) {
    if (isArray(listFields)) {
        // format list fields from array to projection object
        var formatted = {};
        for (var i = 0; i < listFields.length; ++i) {
            formatted[listFields[i]] = true;
        }
        return formatted;
    }
    return listFields;
}

/**
 * format update argument
 */
function formatUpdateFields(updateFields) {
    updateFields = formatListFields(updateFields);
    for (var field in updateFields) {
        if (updateFields.hasOwnProperty(field) && updateFields[field] == true) {
            updateFields[field] = '$set';
        }
    }
    return updateFields;
}

module.exports.id = function id(id){
    return new ObjectId(id);
};

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
    res[options.id] = (wrapWithObj ? module.exports.id(id) : id);
    return res;
}

// according to ECMAScript standard
function isArray(entity) {
    return Object.prototype.toString.call(entity) === '[object Array]';
}

module.exports.removeField = function removeField(entity, field) {
    if (isArray(entity)){
        for (var i = entity.length; --i >= 0;) {
            if (entity[i] === field) entity.splice(i, 1);
        }
    } else {
        delete entity[field];
    }
}

function addFieldToUpdate(result, method, field, value) {
    if (!result[method]) result[method] = {};
    result[method][field] = value;
}

/**
 * formats an entity + fields configuration into an update statement to use with mongo's findAndModify.
 *  support all mongoDb <a href="http://docs.mongodb.org/manual/reference/operator/update/"> update methods </a> with addition of:
 *  $addAllToSet - value must be array. arry elements are each added as <a href="http://docs.mongodb.org/manual/reference/operator/update/addToSet/">$addToSet</a>
 *  $pushAll - supported even after deprecation in mongoDb
 * @param entity
 * @param fields fields from entity to $set. may contain method override as value (array of field names or key : value of field and boolean / method name)
 */
module.exports.getUpdate = function getUpdate(entity, fields) {
    fields = formatUpdateFields(fields);
    var result = {};
    for (var path in fields) {
        if (fields[path] && fields.hasOwnProperty(path)) {
            var value = keypath(path, entity);
            switch(fields[path]){
                case '$addAllToSet' :
                    if (!isArray(value))
                        throw new Error('$addAllToSet called on field : ' +
                            path + ' containing ' + (typeof value) + ' : ' + value);
                    addFieldToUpdate(result, '$addToSet', path, {'$each' : value});
                    break;
                case '$pushAll' :
                    if (!isArray(value))
                        throw new Error('$pushAll called on field : ' +
                            path + ' containing ' + (typeof value)+ ' : '  + value);
                    addFieldToUpdate(result, '$push', path, {'$each' : value});
                    break;
                case '$unset' :
                    addFieldToUpdate(result, '$unset', path, '');
                    break;
                default :
                    // assuming the value of fields is a valid mongo method
                    addFieldToUpdate(result, fields[path], path, value);
            }
        }
    }
    return result;
}

module.exports.popAttr = function popAttr(options, attrName) {
    var res = options[attrName];
    delete options[attrName];
    return res;
}
module.exports.endsWith = function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}