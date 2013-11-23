/**
 * module for simple async CRUD operations logic
 * User: amira
 * Date: 11/22/13
 * Time: 12:06 AM
 */

var utils = require('./utils');

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

    // functionality will be added to the dao only after there is a collection
    app.db.collection(options.collectionName, function(err, collection) {
        if (err) throw err;

        _this.collection = collection;

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
         * Load an entity by id
         */
        _this.load = function(id, callback){
            collection.findOne(utils.getSelectorById(options, id, true),callback);
        }

        /**
         * Create an entity
         */
        _this.insert = function(entity, callback){
            collection.insert(entity, {'safe':true}, callback);
        };

        /**
         * Change an entity
         */
        _this.update = function(entity, callback){
            collection.update(utils.getSelectorById(options, entity[options.id]), entity, {'safe':true}, callback);
        };

        /**
         * Delete an entity
         */
        _this.remove = function(entity, callback){
            collection.remove(utils.getSelectorById(options, entity[options.id]), callback);
        };
    });
}