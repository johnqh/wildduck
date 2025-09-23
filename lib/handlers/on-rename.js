'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// RENAME "path/to/mailbox" "new/path"
// NB! RENAME affects child and hierarchy mailboxes as well, this example does not do this
module.exports = (server, mailboxHandler) => (path, newname, session, callback) => {
    const startTime = Date.now();

    logIMAP('RENAME', session, 'Command initiated', {
        path,
        newname,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'rename',
            cid: session.id
        },
        '[%s] RENAME "%s" to "%s"',
        session.id,
        path,
        newname
    );

    logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Looking up mailbox for rename');

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
                logError(err, { command: 'RENAME', sessionId: session.id, userId: session.user.id, path, newname }, 'Mailbox lookup failed');
                logPerformance('RENAME', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }
            if (!mailbox) {
                logIMAP('RENAME', session, 'Command failed - mailbox not found', { path, newname });
                logPerformance('RENAME', Date.now() - startTime, { sessionId: session.id, status: 'NONEXISTENT' });
                return callback(null, 'NONEXISTENT');
            }

            logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Mailbox found, proceeding with rename');

            mailboxHandler.rename(session.user.id, mailbox._id, newname, false, (err, result) => {
                if (err) {
                    logError(
                        err,
                        { command: 'RENAME', sessionId: session.id, userId: session.user.id, path, newname, mailboxId: mailbox._id },
                        'Mailbox rename failed'
                    );
                    logPerformance('RENAME', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                    return callback(err);
                }

                logIMAP('RENAME', session, 'Command completed successfully', {
                    path,
                    newname,
                    mailboxId: mailbox._id
                });
                logPerformance('RENAME', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });
                callback(null, result);
            });
        }
    );
};
