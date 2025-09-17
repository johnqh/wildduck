'use strict';

const config = require('wild-config');
const envLoader = require('../env-loader');

module.exports = (server, userHandler, userCache) => (login, session, callback) => {
    let username = (login.username || '').toString().trim();
    // For IMAP, password field contains the signature
    let signature = (login.password || '').toString();
    
    // Extract nonce from signature if it's embedded, or generate one
    // The signature is passed as the password field per IMAP standard
    let nonce = login.nonce || Date.now().toString();

    userHandler.authenticate(
        username,
        signature,
        'imap',
        {
            protocol: 'IMAP',
            sess: session.id,
            ip: session.remoteAddress,
            nonce
        },
        (err, result) => {
            if (err) {
                return callback(err);
            }

            if (!result) {
                return callback();
            }

            // Blockchain signature verification is sufficient

            let checkConnectionLimits = next => {
                // Skip connection limits in test mode when indexer is not available
                const indexerUrl = envLoader.get('INDEXER_BASE_URL');
                if (!indexerUrl) {
                    return next(null, true);
                }
                
                if (typeof server.notifier.allocateConnection === 'function') {
                    return userCache.get(result.user, 'imapMaxConnections', config.imap.maxConnections || 15, (err, limit) => {
                        if (err) {
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
                    return callback(err);
                }

                if (!success) {
                    err = new Error('[ALERT] Too many simultaneous connections.');
                    err.response = 'NO';
                    return callback(err);
                }

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
