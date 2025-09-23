'use strict';

const config = require('wild-config');
const { logIMAP, logError, logPerformance } = require('../logger');

module.exports = (server, userHandler, userCache) => (login, session, callback) => {
    const startTime = Date.now();
    let username = (login.username || '').toString().trim();

    logIMAP('AUTH', session, 'Authentication initiated', {
        username,
        protocol: 'IMAP'
    });

    userHandler.authenticate(
        username,
        login.password,
        'imap',
        {
            protocol: 'IMAP',
            sess: session.id,
            ip: session.remoteAddress
        },
        (err, result) => {
            if (err) {
                logError(err, { command: 'AUTH', sessionId: session.id, username }, 'Authentication error');
                logPerformance('AUTH', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }

            if (!result) {
                logIMAP('AUTH', session, 'Authentication failed - invalid credentials', { username });
                logPerformance('AUTH', Date.now() - startTime, { sessionId: session.id, status: 'FAILED' });
                return callback();
            }

            logIMAP('AUTH', session, 'User authenticated successfully', {
                userId: result.user,
                username: result.username,
                scope: result.scope
            });

            if (result.scope === 'master' && result.require2fa) {
                // master password not allowed if 2fa is enabled!
                logIMAP('AUTH', session, 'Authentication failed - master password not allowed with 2FA', {
                    username,
                    scope: result.scope,
                    require2fa: result.require2fa
                });
                logPerformance('AUTH', Date.now() - startTime, { sessionId: session.id, status: 'REJECTED_2FA' });
                return callback();
            }

            let checkConnectionLimits = next => {
                if (typeof server.notifier.allocateConnection === 'function') {
                    return userCache.get(result.user, 'imapMaxConnections', config.imap.maxConnections || 15, (err, limit) => {
                        if (err) {
                            logError(err, { command: 'AUTH', sessionId: session.id, userId: result.user }, 'Failed to get connection limit');
                            return callback(err);
                        }

                        let connection = login.connection || {};
                        server.notifier.allocateConnection(
                            {
                                service: 'imap',
                                session,
                                user: result.user,
                                limit
                            },
                            (err, success) => {
                                if (!err) {
                                    if (success) {
                                        logIMAP('AUTH', session, 'Connection established', {
                                            userId: result.user,
                                            connectionId: connection.id,
                                            remoteAddress: connection.remoteAddress,
                                            limit
                                        });
                                        server.loggelf({
                                            short_message: '[CONNSTART] Connection established for ' + result.user,
                                            _connection: 'establish',
                                            _service: 'imap',
                                            _sess: session && session.id,
                                            _user: result.user,
                                            _cid: connection.id,
                                            _ip: connection.remoteAddress,
                                            _limit: limit
                                        });
                                    } else {
                                        logIMAP('AUTH', session, 'Connection limit exceeded', {
                                            userId: result.user,
                                            connectionId: connection.id,
                                            remoteAddress: connection.remoteAddress,
                                            limit
                                        });
                                        server.loggelf({
                                            short_message: '[CONNFAILED] Connection failed for ' + result.user,
                                            _connection: 'limited',
                                            _service: 'imap',
                                            _sess: session && session.id,
                                            _user: result.user,
                                            _cid: connection.id,
                                            _ip: connection.remoteAddress,
                                            _limit: limit
                                        });
                                    }
                                } else {
                                    logError(err, { command: 'AUTH', sessionId: session.id, userId: result.user }, 'Connection allocation failed');
                                }
                                next(err, success);
                            }
                        );
                    });
                }

                return next(null, true);
            };

            checkConnectionLimits((err, success) => {
                if (err) {
                    logError(err, { command: 'AUTH', sessionId: session.id, userId: result.user }, 'Connection limit check failed');
                    logPerformance('AUTH', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                    return callback(err);
                }

                if (!success) {
                    err = new Error('[ALERT] Too many simultaneous connections.');
                    err.response = 'NO';
                    logError(err, { command: 'AUTH', sessionId: session.id, userId: result.user }, 'Too many connections');
                    logPerformance('AUTH', Date.now() - startTime, { sessionId: session.id, status: 'CONNECTION_LIMIT' });
                    return callback(err);
                }

                logIMAP('AUTH', session, 'Authentication completed successfully', {
                    userId: result.user,
                    username: result.username
                });
                logPerformance('AUTH', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });

                callback(null, {
                    user: {
                        id: result.user,
                        username: result.username
                    }
                });
            });
        }
    );
};
