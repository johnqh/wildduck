'use strict';

const config = require('wild-config');
const mongodb = require('mongodb');
const Redis = require('ioredis');
const redisUrl = require('./redis-url');
const log = require('npmlog');
const packageData = require('../package.json');

const MongoClient = mongodb.MongoClient;

module.exports.database = false;
module.exports.gridfs = false;
module.exports.users = false;
module.exports.senderDb = false;

let getDBConnection = async (main, config, callback) => {
    try {
        if (main) {
            if (!config) {
                return callback(null, false);
            }
            if (config && !/[:/]/.test(config)) {
                return callback(null, main.db(config));
            }
        }
        
        // Use promise-based connection for Mac compatibility
        const client = await MongoClient.connect(config, {});
        let db = client;
        
        if (main && client.s && client.s.options && client.s.options.dbName) {
            db = client.db(client.s.options.dbName);
        }
        
        return callback(null, db);
    } catch (err) {
        return callback(err);
    }
};

module.exports.connect = async callback => {
    try {
        const REDIS_CONF = Object.assign(
            {
                // some defaults
                maxRetriesPerRequest: null,
                showFriendlyErrorStack: true,
                retryStrategy(times) {
                    const delay = !times ? 1000 : Math.min(2 ** times * 500, 15 * 1000);
                    log.info('Redis', 'Connection retry times=%s delay=%s', times, delay);
                    return delay;
                },
                connectionName: `${packageData.name}@${packageData.version}[${process.pid}]`
            },
            typeof config.dbs.redis === 'string' ? redisUrl(config.dbs.redis) : config.dbs.redis || {}
        );

        module.exports.redisConfig = REDIS_CONF;
        module.exports.queueConf = {
            connection: Object.assign({ connectionName: `${REDIS_CONF.connectionName}[notify]` }, REDIS_CONF),
            prefix: `wd:bull`
        };
        module.exports.redis = new Redis(REDIS_CONF);

        await new Promise((resolve, reject) => {
            getDBConnection(false, config.dbs.mongo, (err, db) => {
                if (err) {
                    return reject(err);
                }

                if (db.s && db.s.options && db.s.options.dbName) {
                    module.exports.database = db.db(db.s.options.dbName);
                } else {
                    module.exports.database = db;
                }

                getDBConnection(db, config.dbs.gridfs, (err, gdb) => {
                    if (err) {
                        return reject(err);
                    }
                    module.exports.gridfs = gdb || module.exports.database;

                    getDBConnection(db, config.dbs.users, (err, udb) => {
                        if (err) {
                            return reject(err);
                        }
                        module.exports.users = udb || module.exports.database;

                        getDBConnection(db, config.dbs.sender, (err, sdb) => {
                            if (err) {
                                return reject(err);
                            }
                            module.exports.senderDb = sdb || module.exports.database;

                            resolve();
                        });
                    });
                });
            });
        });

        return callback();
    } catch (err) {
        return callback(err);
    }
};
