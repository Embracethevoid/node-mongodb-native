'use strict';

var toError = require('./utils').toError,
  Define = require('./metadata'),
  shallowClone = require('./utils').shallowClone,
  assign = require('./utils').assign,
  executeOperation = require('./utils').executeOperation;

/**
 * @fileOverview The **Admin** class is an internal class that allows convenient access to
 * the admin functionality and commands for MongoDB.
 *
 * **ADMIN Cannot directly be instantiated**
 * @example
 * var MongoClient = require('mongodb').MongoClient,
 *   test = require('assert');
 * // Connection url
 * var url = 'mongodb://localhost:27017/test';
 * // Connect using MongoClient
 * MongoClient.connect(url, function(err, db) {
 *   // Use the admin database for the operation
 *   var adminDb = db.admin();
 *
 *   // List all the available databases
 *   adminDb.listDatabases(function(err, dbs) {
 *     test.equal(null, err);
 *     test.ok(dbs.databases.length > 0);
 *     db.close();
 *   });
 * });
 */

/**
 * Create a new Admin instance (INTERNAL TYPE, do not instantiate directly)
 * @class
 * @return {Admin} a collection instance.
 */
var Admin = function(db, topology, promiseLibrary) {
  if (!(this instanceof Admin)) return new Admin(db, topology);

  // Internal state
  this.s = {
    db: db,
    topology: topology,
    promiseLibrary: promiseLibrary
  };
};

var define = (Admin.define = new Define('Admin', Admin, false));

/**
 * The callback format for results
 * @callback Admin~resultCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {object} result The result object if the command was executed successfully.
 */

/**
 * Execute a command
 * @method
 * @param {object} command The command hash
 * @param {object} [options=null] Optional settings.
 * @param {(ReadPreference|string)} [options.readPreference=null] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 * @param {number} [options.maxTimeMS=null] Number of milliseconds to wait before aborting the query.
 * @param {Admin~resultCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.command = function(command, options, callback) {
  var args = Array.prototype.slice.call(arguments, 1);
  callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
  options = args.length ? args.shift() : {};

  return executeOperation(this, this.s.db.executeDbAdminCommand.bind(this.s.db), [
    command,
    options,
    callback
  ]);
};

define.classMethod('command', { callback: true, promise: true });

/**
 * Retrieve the server information for the current
 * instance of the db client
 *
 * @param {Admin~resultCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.buildInfo = function(callback) {
  return executeOperation(this, this.serverInfo.bind(this), [callback]);
};

define.classMethod('buildInfo', { callback: true, promise: true });

/**
 * Retrieve the server information for the current
 * instance of the db client
 *
 * @param {Admin~resultCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.serverInfo = function(callback) {
  const cmd = { buildinfo: 1 };
  return executeOperation(this, this.s.db.executeDbAdminCommand.bind(this.s.db), [cmd, callback]);
};

define.classMethod('serverInfo', { callback: true, promise: true });

/**
 * Retrieve this db's server status.
 *
 * @param {Admin~resultCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.serverStatus = function(callback) {
  return executeOperation(this, serverStatus, [this, callback]);
};

var serverStatus = function(self, callback) {
  self.s.db.executeDbAdminCommand({ serverStatus: 1 }, function(err, doc) {
    if (err == null && doc.ok === 1) {
      callback(null, doc);
    } else {
      if (err) return callback(err, false);
      return callback(toError(doc), false);
    }
  });
};

define.classMethod('serverStatus', { callback: true, promise: true });

/**
 * Ping the MongoDB server and retrieve results
 *
 * @param {Admin~resultCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.ping = function(options, callback) {
  var args = Array.prototype.slice.call(arguments, 0);
  callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
  const cmd = { ping: 1 };
  return executeOperation(this, this.s.db.executeDbAdminCommand.bind(this.s.db), [cmd, callback]);
};

define.classMethod('ping', { callback: true, promise: true });

// Get write concern
var writeConcern = function(options, db) {
  options = shallowClone(options);

  // If options already contain write concerns return it
  if (options.w || options.wtimeout || options.j || options.fsync) {
    return options;
  }

  // Set db write concern if available
  if (db.writeConcern) {
    if (options.w) options.w = db.writeConcern.w;
    if (options.wtimeout) options.wtimeout = db.writeConcern.wtimeout;
    if (options.j) options.j = db.writeConcern.j;
    if (options.fsync) options.fsync = db.writeConcern.fsync;
  }

  // Return modified options
  return options;
};

/**
 * Add a user to the database.
 * @method
 * @param {string} username The username.
 * @param {string} password The password.
 * @param {object} [options=null] Optional settings.
 * @param {(number|string)} [options.w=null] The write concern.
 * @param {number} [options.wtimeout=null] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {boolean} [options.fsync=false] Specify a file sync write concern.
 * @param {object} [options.customData=null] Custom data associated with the user (only Mongodb 2.6 or higher)
 * @param {object[]} [options.roles=null] Roles associated with the created user (only Mongodb 2.6 or higher)
 * @param {Admin~resultCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.addUser = function(username, password, options, callback) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 2);
  callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;

  options = args.length ? args.shift() : {};
  options = options || {};
  // Get the options
  options = writeConcern(options, self.s.db);
  // Set the db name to admin
  options.dbName = 'admin';

  return executeOperation(this, this.s.db.addUser.bind(this.s.db), [
    username,
    password,
    options,
    callback
  ]);
};

define.classMethod('addUser', { callback: true, promise: true });

/**
 * Remove a user from a database
 * @method
 * @param {string} username The username.
 * @param {object} [options=null] Optional settings.
 * @param {(number|string)} [options.w=null] The write concern.
 * @param {number} [options.wtimeout=null] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {boolean} [options.fsync=false] Specify a file sync write concern.
 * @param {Admin~resultCallback} [callback] The command result callback
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.removeUser = function(username, options, callback) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 1);
  callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;

  options = args.length ? args.shift() : {};
  options = options || {};
  // Get the options
  options = writeConcern(options, self.s.db);
  // Set the db name
  options.dbName = 'admin';

  return executeOperation(this, this.s.db.removeUser.bind(this.s.db), [
    username,
    options,
    callback
  ]);
};

define.classMethod('removeUser', { callback: true, promise: true });

/**
 * Validate an existing collection
 *
 * @param {string} collectionName The name of the collection to validate.
 * @param {object} [options=null] Optional settings.
 * @param {Admin~resultCallback} [callback] The command result callback.
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.validateCollection = function(collectionName, options, callback) {
  var args = Array.prototype.slice.call(arguments, 1);
  callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;

  options = args.length ? args.shift() : {};
  options = options || {};

  return executeOperation(this, validateCollection, [this, collectionName, options, callback]);
};

var validateCollection = function(self, collectionName, options, callback) {
  var command = { validate: collectionName };
  var keys = Object.keys(options);

  // Decorate command with extra options
  for (var i = 0; i < keys.length; i++) {
    if (options.hasOwnProperty(keys[i])) {
      command[keys[i]] = options[keys[i]];
    }
  }

  self.s.db.command(command, function(err, doc) {
    if (err != null) return callback(err, null);

    if (doc.ok === 0) return callback(new Error('Error with validate command'), null);
    if (doc.result != null && doc.result.constructor !== String)
      return callback(new Error('Error with validation data'), null);
    if (doc.result != null && doc.result.match(/exception|corrupt/) != null)
      return callback(new Error('Error: invalid collection ' + collectionName), null);
    if (doc.valid != null && !doc.valid)
      return callback(new Error('Error: invalid collection ' + collectionName), null);

    return callback(null, doc);
  });
};

define.classMethod('validateCollection', { callback: true, promise: true });

/**
 * List the available databases
 *
 * @param {object} [options=null] Optional settings.
 * @param {boolean} [options.nameOnly=false] Whether the command should return only db names, or names and size info.
 * @param {Admin~resultCallback} [callback] The command result callback.
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.listDatabases = function(options, callback) {
  var self = this;

  var cmd = { listDatabases: 1 };

  // no options were passed in, only a callback
  if (typeof options === 'function') return self.s.db.executeDbAdminCommand(cmd, {}, options);

  // if we did get options, use them
  cmd = assign(cmd, options);

  // cast boolean to 1 or 0
  if (cmd.nameOnly) cmd.nameOnly = Number(cmd.nameOnly);

  return executeOperation(this, this.s.db.executeDbAdminCommand.bind(this.s.db), [
    cmd,
    {},
    callback
  ]);
};

define.classMethod('listDatabases', { callback: true, promise: true });

/**
 * Get ReplicaSet status
 *
 * @param {Admin~resultCallback} [callback] The command result callback.
 * @return {Promise} returns Promise if no callback passed
 */
Admin.prototype.replSetGetStatus = function(callback) {
  return executeOperation(this, replSetGetStatus, [this, callback]);
};

var replSetGetStatus = function(self, callback) {
  self.s.db.executeDbAdminCommand({ replSetGetStatus: 1 }, function(err, doc) {
    if (err == null && doc.ok === 1) return callback(null, doc);
    if (err) return callback(err, false);
    callback(toError(doc), false);
  });
};

define.classMethod('replSetGetStatus', { callback: true, promise: true });

module.exports = Admin;