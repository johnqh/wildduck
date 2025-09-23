'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

module.exports = server => (path, session, callback) => {
    const startTime = Date.now();

    logIMAP('GETQUOTAROOT', session, 'Command initiated', {
        path,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'quota',
            cid: session.id
        },
        '[%s] Requested quota root info for "%s"',
        session.id,
        path
    );

    logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Looking up mailbox for quota info');

    db.database.collection('mailboxes').findOne(
        {
            user: session.user.id,
            path
        },
        {
            maxTimeMS: consts.DB_MAX_TIME_MAILBOXES
        },
        (err, mailbox) => {
            if (err) {
                logError(err, { command: 'GETQUOTAROOT', sessionId: session.id, userId: session.user.id, path }, 'Mailbox lookup failed');
                logPerformance('GETQUOTAROOT', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }
            if (!mailbox) {
                logIMAP('GETQUOTAROOT', session, 'Command failed - mailbox not found', { path });
                logPerformance('GETQUOTAROOT', Date.now() - startTime, { sessionId: session.id, status: 'NONEXISTENT' });
                return callback(null, 'NONEXISTENT');
            }

            logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Mailbox found, looking up user data');

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
                        logError(err, { command: 'GETQUOTAROOT', sessionId: session.id, userId: session.user.id }, 'User lookup failed');
                        logPerformance('GETQUOTAROOT', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                        return callback(err);
                    }
                    if (!user) {
                        const error = new Error('User data not found');
                        logError(error, { command: 'GETQUOTAROOT', sessionId: session.id, userId: session.user.id }, 'User not found');
                        logPerformance('GETQUOTAROOT', Date.now() - startTime, { sessionId: session.id, status: 'USER_NOT_FOUND' });
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
                            logError(err, { command: 'GETQUOTAROOT', sessionId: session.id, userId: session.user.id }, 'Failed to get quota settings');
                            logPerformance('GETQUOTAROOT', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                            return callback(err);
                        }

                        const quotaInfo = {
                            root: '',
                            quota: user.quota || maxStorage || 0,
                            storageUsed: Math.max(user.storageUsed || 0, 0)
                        };

                        logIMAP('GETQUOTAROOT', session, 'Command completed successfully', {
                            path,
                            quotaInfo
                        });
                        logPerformance('GETQUOTAROOT', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });

                        callback(null, quotaInfo);
                    });
                }
            );
        }
    );
};
