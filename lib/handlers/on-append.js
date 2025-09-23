'use strict';

const db = require('../db');
const consts = require('../consts');
const tools = require('../tools');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// APPEND mailbox (flags) date message
module.exports = (server, messageHandler, userCache) => (path, flags, date, raw, session, callback) => {
    const startTime = Date.now();

    logIMAP('APPEND', session, 'Command initiated', {
        path,
        flags: Array.isArray(flags) ? flags : [].concat(flags || []),
        date,
        rawSize: raw ? raw.length : 0
    });

    server.logger.debug(
        {
            tnx: 'append',
            cid: session.id
        },
        '[%s] Appending message to "%s"',
        session.id,
        path
    );

    logDB('findOne', 'users', { userId: session.user.id }, 'Looking up user data');

    db.users.collection('users').findOne(
        {
            _id: session.user.id
        },
        {
            maxTimeMS: consts.DB_MAX_TIME_USERS
        },
        (err, userData) => {
            if (err) {
                logError(err, { command: 'APPEND', sessionId: session.id, userId: session.user.id }, 'User lookup failed');
                return callback(err);
            }
            if (!userData) {
                const error = new Error('User not found');
                logError(error, { command: 'APPEND', sessionId: session.id, userId: session.user.id }, 'User not found in database');
                return callback(error);
            }

            logDB('findOne', 'users', { userId: session.user.id }, 'User data retrieved successfully');

            userCache.get(session.user.id, 'quota', { setting: 'const:max:storage' }, (err, quota) => {
                if (err) {
                    logError(err, { command: 'APPEND', sessionId: session.id, userId: session.user.id }, 'Failed to get user quota');
                    return callback(err);
                }

                if (quota && userData.storageUsed > quota) {
                    logIMAP('APPEND', session, 'Command failed - over quota', {
                        quota,
                        storageUsed: userData.storageUsed,
                        path
                    });
                    logPerformance('APPEND', Date.now() - startTime, { sessionId: session.id, status: 'OVERQUOTA' });
                    return callback(false, 'OVERQUOTA');
                }

                userCache.get(session.user.id, 'imapMaxUpload', { setting: 'const:max:imap:upload' }, (err, limit) => {
                    if (err) {
                        logError(err, { command: 'APPEND', sessionId: session.id, userId: session.user.id }, 'Failed to get upload limit');
                        return callback(err);
                    }

                    messageHandler.counters.ttlcounter('iup:' + session.user.id, 0, limit, false, (err, res) => {
                        if (err) {
                            logError(err, { command: 'APPEND', sessionId: session.id, userId: session.user.id }, 'Failed to check rate limit');
                            return callback(err);
                        }
                        if (!res.success) {
                            let err = new Error('Upload was rate limited');
                            err.response = 'NO';
                            err.code = 'UploadRateLimited';
                            err.ttl = res.ttl;
                            err.responseMessage = `Upload was rate limited. Try again in ${tools.roundTime(res.ttl)}.`;

                            logError(err, { command: 'APPEND', sessionId: session.id, userId: session.user.id }, 'Upload rate limited');
                            logPerformance('APPEND', Date.now() - startTime, { sessionId: session.id, status: 'RATE_LIMITED' });
                            return callback(err);
                        }

                        messageHandler.counters.ttlcounter('iup:' + session.user.id, raw.length, limit, false, () => {
                            flags = Array.isArray(flags) ? flags : [].concat(flags || []);

                            messageHandler.encryptMessage(
                                userData.encryptMessages && !flags.includes('\\Draft') ? userData.pubKey : false,
                                raw,
                                (err, encrypted) => {
                                    if (!err && encrypted) {
                                        raw = encrypted;
                                    }
                                    messageHandler.add(
                                        {
                                            user: session.user.id,
                                            path,
                                            meta: {
                                                source: 'IMAP',
                                                from: '',
                                                to: [session.user.address || session.user.username],
                                                origin: session.remoteAddress,
                                                transtype: 'APPEND',
                                                time: new Date()
                                            },
                                            session,
                                            date,
                                            flags,
                                            raw
                                        },
                                        (err, status, data) => {
                                            if (err) {
                                                logError(err, { command: 'APPEND', sessionId: session.id, userId: session.user.id, path }, 'Message append failed');
                                                logPerformance('APPEND', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });

                                                if (err.imapResponse) {
                                                    logIMAP('APPEND', session, 'Command completed with IMAP response', { response: err.imapResponse });
                                                    return callback(null, err.imapResponse);
                                                }

                                                return callback(err);
                                            }

                                            logIMAP('APPEND', session, 'Command completed successfully', {
                                                status,
                                                messageId: data && data.message,
                                                uid: data && data.uid,
                                                path
                                            });
                                            logPerformance('APPEND', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });
                                            callback(null, status, data);
                                        }
                                    );
                                }
                            );
                        });
                    });
                });
            });
        }
    );
};
