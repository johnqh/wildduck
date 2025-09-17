'use strict';

const config = require('wild-config');

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
            console.log('=== AUTHENTICATION CALLBACK ===');
            console.log('Error:', err);
            console.log('Result:', result);
            console.log('Result type:', typeof result);
            console.log('Is array:', Array.isArray(result));
            
            if (err) {
                console.log('Authentication error, calling callback with error');
                return callback(err);
            }

            if (!result) {
                console.log('No result, calling callback with no result');
                return callback();
            }

            // Blockchain signature verification is sufficient

            let checkConnectionLimits = next => {
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
