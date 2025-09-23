'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// UNSUBSCRIBE "path/to/mailbox"
module.exports = server => (path, session, callback) => {
    const startTime = Date.now();

    logIMAP('UNSUBSCRIBE', session, 'Command initiated', {
        path,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'unsubscribe',
            cid: session.id
        },
        '[%s] UNSUBSCRIBE from "%s"',
        session.id,
        path
    );
    logDB('findOneAndUpdate', 'mailboxes', { userId: session.user.id, path }, 'Unsubscribing from mailbox');

    db.database.collection('mailboxes').findOneAndUpdate(
        {
            user: session.user.id,
            path
        },
        {
            $set: {
                subscribed: false
            }
        },
        {
            maxTimeMS: consts.DB_MAX_TIME_MAILBOXES
        },
        (err, item) => {
            if (err) {
                logError(err, { command: 'UNSUBSCRIBE', sessionId: session.id, userId: session.user.id, path }, 'Unsubscription failed');
                logPerformance('UNSUBSCRIBE', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }

            if (!item || !item.value) {
                // was not able to acquire a lock
                logIMAP('UNSUBSCRIBE', session, 'Command failed - mailbox not found', { path });
                logPerformance('UNSUBSCRIBE', Date.now() - startTime, { sessionId: session.id, status: 'NONEXISTENT' });
                return callback(null, 'NONEXISTENT');
            }

            logIMAP('UNSUBSCRIBE', session, 'Command completed successfully', {
                path,
                mailboxId: item.value._id
            });
            logPerformance('UNSUBSCRIBE', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });
            callback(null, true);
        }
    );
};
