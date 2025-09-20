'use strict';

const config = require('wild-config');
const log = require('npmlog');
const imap = require('./imap');
const pop3 = require('./pop3');
const lmtp = require('./lmtp');
const api = require('./api');
const acme = require('./acme');
const tasks = require('./tasks');
const webhooks = require('./webhooks');
const indexer = require('./indexer');
const plugins = require('./lib/plugins');
const db = require('./lib/db');
const errors = require('./lib/errors');

// preload certificate files
require('./lib/certs');

console.log('Worker: Starting database connection...');
// Initialize database connection
db.connect(err => {
    if (err) {
        console.log('Worker: Database connection failed:', err.message);
        log.error('Db', 'Failed to setup database connection');
        errors.notify(err);
        return setTimeout(() => process.exit(1), 3000);
    }
    console.log('Worker: Database connection successful');

    console.log('Worker: Starting tasks...');
    tasks.start(err => {
        if (err) {
            console.log('Worker: Tasks start failed:', err.message);
            log.error('App', 'Failed to start task runner. %s', err.message);
            errors.notify(err);
            return setTimeout(() => process.exit(1), 3000);
        }
        console.log('Worker: Tasks started successfully');

        console.log('Worker: Starting webhooks...');
        webhooks.start(err => {
            if (err) {
                console.log('Worker: Webhooks start failed:', err.message);
                log.error('App', 'Failed to start webhook runner. %s', err.message);
                errors.notify(err);
                return setTimeout(() => process.exit(1), 3000);
            }
            console.log('Worker: Webhooks started successfully');

            console.log('Worker: Starting indexer...');
            indexer.start(err => {
                if (err) {
                    console.log('Worker: Indexer start failed:', err.message);
                    log.error('App', 'Failed to start indexer process. %s', err.message);
                    errors.notify(err);
                    return setTimeout(() => process.exit(1), 3000);
                }
                console.log('Worker: Indexer started successfully');

                // Start IMAP server
                console.log('Worker: Starting IMAP server...');
                imap(err => {
                    if (err) {
                        console.log('Worker: IMAP server start failed:', err.message);
                        log.error('App', 'Failed to start IMAP server. %s', err.message);
                        errors.notify(err);
                        return setTimeout(() => process.exit(1), 3000);
                    }
                    console.log('Worker: IMAP server started successfully');
                    // Start POP3 server
                    console.log('Worker: Starting POP3 server...');
                    pop3(err => {
                        if (err) {
                            console.log('Worker: POP3 server start failed:', err.message);
                            log.error('App', 'Failed to start POP3 server');
                            errors.notify(err);
                            return setTimeout(() => process.exit(1), 3000);
                        }
                        console.log('Worker: POP3 server started successfully');
                        // Start LMTP maildrop server
                        console.log('Worker: Starting LMTP server...');
                        lmtp(err => {
                            if (err) {
                                console.log('Worker: LMTP server start failed:', err.message);
                                log.error('App', 'Failed to start LMTP server');
                                errors.notify(err);
                                return setTimeout(() => process.exit(1), 3000);
                            }
                            console.log('Worker: LMTP server started successfully');

                            // Start HTTP API server
                            console.log('Worker: Starting API server...');
                            api(err => {
                                if (err) {
                                    console.log('Worker: API server start failed:', err.message);
                                    log.error('App', 'Failed to start API server');
                                    errors.notify(err);
                                    return setTimeout(() => process.exit(1), 3000);
                                }
                                console.log('Worker: API server started successfully');

                                // Start HTTP ACME server
                                console.log('Worker: Starting ACME server...');
                                acme(err => {
                                    if (err) {
                                        console.log('Worker: ACME server start failed:', err.message);
                                        log.error('App', 'Failed to start ACME server');
                                        errors.notify(err);
                                        return setTimeout(() => process.exit(1), 3000);
                                    }
                                    console.log('Worker: ACME server started successfully');

                                    // downgrade user and group if needed
                                    if (config.group) {
                                        try {
                                            process.setgid(config.group);
                                            log.info('App', 'Changed group to "%s" (%s)', config.group, process.getgid());
                                        } catch (E) {
                                            log.error('App', 'Failed to change group to "%s" (%s)', config.group, E.message);
                                            errors.notify(E);
                                            return setTimeout(() => process.exit(1), 3000);
                                        }
                                    }
                                    if (config.user) {
                                        try {
                                            process.setuid(config.user);
                                            log.info('App', 'Changed user to "%s" (%s)', config.user, process.getuid());
                                        } catch (E) {
                                            log.error('App', 'Failed to change user to "%s" (%s)', config.user, E.message);
                                            errors.notify(E);
                                            return setTimeout(() => process.exit(1), 3000);
                                        }
                                    }

                                    plugins.init('receiver');
                                    plugins.handler.load(() => {
                                        log.verbose('Plugins', 'Plugins loaded');
                                        plugins.handler.runHooks('init', [], () => {
                                            log.info('App', 'All servers started, ready to process some mail');
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
