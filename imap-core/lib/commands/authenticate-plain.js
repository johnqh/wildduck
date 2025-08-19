'use strict';

const imapTools = require('../imap-tools');

module.exports = {
    state: 'Not Authenticated',

    schema: [
        {
            name: 'token',
            type: 'string',
            optional: true
        }
    ],

    handler(command, callback, next) {
        let token = ((command.attributes && command.attributes[0] && command.attributes[0].value) || '').toString().trim();

        let requireClientToken = (command.command || '').toString().toUpperCase() === 'AUTHENTICATE PLAIN-CLIENTTOKEN' ? true : false;

        if (!this.secure && !this._server.options.disableSTARTTLS && !this._server.options.ignoreSTARTTLS) {
            // Only allow authentication using TLS
            return callback(null, {
                response: 'BAD',
                message: 'Run STARTTLS first'
            });
        }

        // Check if authentication method is set
        if (typeof this._server.onAuth !== 'function') {
            return callback(null, {
                response: 'NO',
                message: 'Authentication not implemented'
            });
        }

        if (!token) {
            this._nextHandler = (token, next) => {
                this._nextHandler = false;
                next(); // keep the parser flowing
                authenticate(this, token, requireClientToken, callback);
            };
            this.send('+');
            return next(); // resume input parser. Normally this is done by callback() but we need the next input sooner
        }

        authenticate(this, token, requireClientToken, callback);
    }
};

function authenticate(connection, token, requireClientToken, callback) {
    let data = Buffer.from(token, 'base64').toString().split('\x00');

    // For blockchain authentication, we support both legacy (3 fields) and new format (5 fields)
    // Legacy: [authzid, username, password]
    // New blockchain format: [authzid, username, signature, message, signerAddress]
    // With client token: [authzid, username, signature, message, signerAddress, clientToken]
    
    let isBlockchainAuth = false;
    if ((!requireClientToken && data.length === 5) || (requireClientToken && data.length === 6)) {
        isBlockchainAuth = true;
    } else if ((!requireClientToken && data.length !== 3) || (requireClientToken && data.length !== 4)) {
        return callback(null, {
            response: 'BAD',
            message: 'Invalid SASL argument'
        });
    }

    let username = (data[1] || '').toString().trim();
    let signature, message, signerAddress, clientToken;
    
    if (isBlockchainAuth) {
        signature = (data[2] || '').toString().trim();
        message = (data[3] || '').toString().trim();
        signerAddress = (data[4] || '').toString().trim() || undefined;
        clientToken = requireClientToken ? ((data[5] || '').toString().trim() || false) : false;
    } else {
        // Standard RFC format - third field contains signature
        signature = (data[2] || '').toString().trim(); // password field contains signature per RFC
        message = ''; // empty message for standard auth
        signerAddress = undefined;
        clientToken = requireClientToken ? ((data[3] || '').toString().trim() || false) : false;
    }

    // Do auth
    connection._server.onAuth(
        {
            method: 'PLAIN',
            username,
            signature,
            message,
            signerAddress,
            clientToken,
            connection
        },
        connection.session,
        (err, response) => {
            if (err) {
                connection._server.logger.info(
                    {
                        err,
                        tnx: 'auth',
                        username,
                        method: 'PLAIN',
                        action: 'fail',
                        cid: connection.id
                    },
                    '[%s] Authentication error for %s using %s\n%s',
                    connection.id,
                    username,
                    'PLAIN',
                    err.message
                );
                return callback(err);
            }

            if (!response || !response.user) {
                connection._server.logger.info(
                    {
                        tnx: 'auth',
                        username,
                        method: 'PLAIN',
                        action: 'fail',
                        cid: connection.id
                    },
                    '[%s] Authentication failed for %s using %s',
                    connection.id,
                    username,
                    'PLAIN'
                );
                return callback(null, {
                    response: 'NO',
                    code: 'AUTHENTICATIONFAILED',
                    message: 'Invalid credentials'
                });
            }

            connection._server.logger.info(
                {
                    tnx: 'auth',
                    username,
                    method: 'PLAIN',
                    action: 'success',
                    cid: connection.id,
                    clientToken
                },
                '[%s] %s authenticated using %s%s',
                connection.id,
                username,
                'PLAIN' + (requireClientToken ? '-CLIENTTOKEN' : ''),
                clientToken ? ' with token "' + clientToken + '"' : ''
            );

            connection.setUser(response.user);
            connection.state = 'Authenticated';
            connection.setupNotificationListener();

            imapTools.sendCapabilityResponse(connection);
            imapTools.logClientId(connection);

            callback(null, {
                response: 'OK',
                message: Buffer.from(username + ' authenticated').toString('binary')
            });
        }
    );
}
