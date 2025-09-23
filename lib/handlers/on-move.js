'use strict';

const { logIMAP, logError, logPerformance } = require('../logger');

// MOVE / UID MOVE sequence mailbox
module.exports = (server, messageHandler) => (mailbox, update, session, callback) => {
    const startTime = Date.now();

    logIMAP('MOVE', session, 'Command initiated', {
        sourceMailbox: mailbox,
        destination: update.destination,
        messages: update.messages,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'move',
            cid: session.id
        },
        '[%s] Moving messages from "%s" to "%s"',
        session.id,
        mailbox,
        update.destination
    );

    let lockKey = ['mbwr', mailbox.toString()].join(':');
    server.lock.waitAcquireLock(lockKey, 5 * 60 * 1000, 1 * 60 * 1000, (err, lock) => {
        if (err) {
            logError(err, { command: 'MOVE', sessionId: session.id, sourceMailbox: mailbox, destination: update.destination }, 'Failed to acquire lock');
            logPerformance('MOVE', Date.now() - startTime, { sessionId: session.id, status: 'LOCK_ERROR' });
            return callback(err);
        }

        if (!lock.success) {
            const lockError = new Error('Failed to get folder write lock');
            logError(lockError, { command: 'MOVE', sessionId: session.id, sourceMailbox: mailbox, destination: update.destination }, 'Lock acquisition failed');
            logPerformance('MOVE', Date.now() - startTime, { sessionId: session.id, status: 'LOCK_FAILED' });
            return callback(null, lockError);
        }

        messageHandler.move(
            {
                user: session.user.id,
                // folder to move messages from
                source: {
                    mailbox
                },
                // folder to move messages to
                destination: {
                    user: session.user.id,
                    path: update.destination
                },
                session,
                // list of UIDs to move
                messages: update.messages,
                showExpunged: true
            },
            (...args) => {
                server.lock.releaseLock(lock, () => {
                    if (args[0]) {
                        logError(
                            args[0],
                            { command: 'MOVE', sessionId: session.id, sourceMailbox: mailbox, destination: update.destination },
                            'Move operation failed'
                        );
                        logPerformance('MOVE', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                        if (args[0].imapResponse) {
                            logIMAP('MOVE', session, 'Command completed with IMAP response', { response: args[0].imapResponse });
                            return callback(null, args[0].imapResponse);
                        }
                        return callback(args[0]);
                    }

                    logIMAP('MOVE', session, 'Command completed successfully', {
                        sourceMailbox: mailbox,
                        destination: update.destination,
                        messages: update.messages
                    });
                    logPerformance('MOVE', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });
                    callback(...args);
                });
            }
        );
    });
};
