'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

module.exports = server => (quotaRoot, session, callback) => {
    const startTime = Date.now();

    logIMAP('GETQUOTA', session, 'Command initiated', {
        quotaRoot,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'quota',
            cid: session.id
        },
        '[%s] Requested quota info for "%s"',
        session.id,
        quotaRoot
    );

    if (quotaRoot !== '') {
        logIMAP('GETQUOTA', session, 'Command failed - invalid quota root', { quotaRoot });
        logPerformance('GETQUOTA', Date.now() - startTime, { sessionId: session.id, status: 'NONEXISTENT' });
        return callback(null, 'NONEXISTENT');
    }

    logDB('findOne', 'users', { userId: session.user.id }, 'Looking up user quota information');

    db.users.collection('users').findOne(
        {
            _id: session.user.id
        },
        {
            maxTimeMS: consts.DB_MAX_TIME_USERS
        },
        (err, user) => {
            if (err) {
                logError(err, { command: 'GETQUOTA', sessionId: session.id, userId: session.user.id }, 'User lookup failed');
                logPerformance('GETQUOTA', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }
            if (!user) {
                const error = new Error('User data not found');
                logError(error, { command: 'GETQUOTA', sessionId: session.id, userId: session.user.id }, 'User not found');
                logPerformance('GETQUOTA', Date.now() - startTime, { sessionId: session.id, status: 'USER_NOT_FOUND' });
                return callback(error);
            }

            logDB('findOne', 'users', { userId: session.user.id }, 'User data retrieved');

            let getQuota = next => {
                if (user.quota) {
                    return next(null, user.quota);
                }

                if (!server.options.settingsHandler) {
                    return next(null, 0);
                }

                server.options.settingsHandler
                    .get('const:max:storage')
                    .then(maxStorage => next(null, maxStorage))
                    .catch(err => next(err));
            };

            getQuota((err, maxStorage) => {
                if (err) {
                    logError(err, { command: 'GETQUOTA', sessionId: session.id, userId: session.user.id }, 'Failed to get quota settings');
                    logPerformance('GETQUOTA', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                    return callback(err);
                }

                const quotaInfo = {
                    root: '',
                    quota: user.quota || maxStorage || 0,
                    storageUsed: Math.max(user.storageUsed || 0, 0)
                };

                logIMAP('GETQUOTA', session, 'Command completed successfully', {
                    quotaRoot,
                    quotaInfo
                });
                logPerformance('GETQUOTA', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });

                callback(null, quotaInfo);
            });
        }
    );
};
