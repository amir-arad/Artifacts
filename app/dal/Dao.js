/**
 * module for simple async CRUD operations logic
 * User: amira
 * Date: 11/22/13
 * Time: 12:06 AM
 */

var _ = require('underscore');
var utils = require('./utils');
var ObjectId = require("mongodb").ObjectID;
/**
 * Options
 *  - **collectionName**, {String} the name of the collection this dao addresses
 *  - **listFields**, {Object | array, default:[]} the fields to populate when reading a list. empty means all fields should be fetched
 *  - **id**, (String, default:'_id') the id field of the entity
 *
 * @param app
 * @param options
 */
module.exports = function (app, options){
    var _this = this;
    if (!options.id) options.id = '_id';

    this.id = utils.id;

    this.getSelectorById = function(id, wrapWithObj) {
        return utils.getSelectorById(options, id, wrapWithObj);
    }

    // functionality will be added to the dao only after there is a collection
    app.db.collection(options.collectionName, function(err, collection) {
        if (err) throw err;

        _this.collection = collection;

        if (options.index){
            options.index = utils.formatListFields(options.index);
            options.indexOptions = utils.formatListFields(options.indexOptions);
            options.indexOptions.background = true;
            options.indexOptions.dropDups = options.indexOptions.unique;
            collection.ensureIndex(options.index, options.indexOptions, function(err){if (err) throw err;});
        }

        var list = utils.getListFunction(options.listFields, collection);

        /**
         * Load list of entities
         */
        _this.list = function(query, callback){
            if (typeof query === 'function'){
                callback = query;
                query = {};
            }
            list(query).toArray(callback);
        };

        /**
         * Load an entity by id or query
         */
        _this.load = function(query, callback){
            if (typeof query === 'object'){
                if (query instanceof ObjectId){
                    collection.findOne(utils.getSelectorById(options, query, false),callback);
                } else {
                    collection.findOne(query, callback);
                }
            } else {
                collection.findOne(utils.getSelectorById(options, query, true),callback);
            }
        }

        /**
         * Create an entity
         */
        _this.insert = function(entity, callback){
            collection.insert(entity, {'safe':true}, function(err, resArr) {
                return callback(err, err? null : resArr[0]);
            });
        };

        /**
         * Update an entity
         * @deprecated  use only updateFields
         */
        // TODO delete
        _this.update = function(entity, callback){
            var query = utils.getSelectorById(options, entity[options.id]);
            collection.update(query, entity, {'safe':true}, callback);
        };

        /**
         * Update fields in an entity
         */
        _this.updateFields = function(entity, fields, callback){
            utils.removeField(fields, options.id);   // safety
            var update = utils.getUpdate(entity, fields);
            if (!_.size(update)) return callback(new Error('update called with no updatable fields'));
            var query = utils.getSelectorById(options, entity[options.id]);
            var sort = [['_id', 'asc']];
            app.logger.debug("findAndModify : " + JSON.stringify(update));
            collection.findAndModify(query, sort, update, {'safe':true, 'new':true},
                // findAndModify adds a result argument after the entity
                // that, combined with functional construction logic can produce unintended behaviors
                // the details document is defined here : http://docs.mongodb.org/manual/reference/command/findAndModify/
                function(err, entity, details){
                    app.logger.debug("result : " + JSON.stringify(details));
                    return callback(err, entity);
                });
        };

        /**
         * Delete an entity
         */
        _this.remove = function(entity, callback){
            collection.remove(utils.getSelectorById(options, entity[options.id]), function(err) {
                return callback(err, err? null : entity);
            });
        };
    });
}