'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// DELETE "path/to/mailbox"
module.exports = (server, mailboxHandler) => (path, session, callback) => {
    const startTime = Date.now();

    logIMAP('DELETE', session, 'Command initiated', {
        path,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'delete',
            cid: session.id
        },
        '[%s] DELETE "%s"',
        session.id,
        path
    );

    logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Looking up mailbox to delete');

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
                logError(err, { command: 'DELETE', sessionId: session.id, userId: session.user.id, path }, 'Mailbox lookup failed');
                logPerformance('DELETE', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }
            if (!mailbox) {
                logIMAP('DELETE', session, 'Command failed - mailbox not found', {
                    path,
                    userId: session.user.id
                });
                logPerformance('DELETE', Date.now() - startTime, { sessionId: session.id, status: 'NONEXISTENT' });
                return callback(null, 'NONEXISTENT');
            }

            logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Mailbox found, proceeding with deletion');

            mailboxHandler.del(session.user.id, mailbox._id, (err, result) => {
                if (err) {
                    logError(
                        err,
                        { command: 'DELETE', sessionId: session.id, userId: session.user.id, path, mailboxId: mailbox._id },
                        'Mailbox deletion failed'
                    );
                    logPerformance('DELETE', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                    return callback(err);
                }

                logIMAP('DELETE', session, 'Command completed successfully', {
                    path,
                    userId: session.user.id,
                    mailboxId: mailbox._id
                });
                logPerformance('DELETE', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });
                callback(null, result);
            });
        }
    );
};
