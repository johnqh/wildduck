'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// SUBSCRIBE "path/to/mailbox"
module.exports = server => (path, session, callback) => {
    const startTime = Date.now();

    logIMAP('SUBSCRIBE', session, 'Command initiated', {
        path,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'subscribe',
            cid: session.id
        },
        '[%s] SUBSCRIBE to "%s"',
        session.id,
        path
    );
    logDB('findOneAndUpdate', 'mailboxes', { userId: session.user.id, path }, 'Subscribing to mailbox');

    db.database.collection('mailboxes').findOneAndUpdate(
        {
            user: session.user.id,
            path
        },
        {
            $set: {
                subscribed: true
            }
        },
        {
            maxTimeMS: consts.DB_MAX_TIME_MAILBOXES
        },
        (err, item) => {
            if (err) {
                logError(err, { command: 'SUBSCRIBE', sessionId: session.id, userId: session.user.id, path }, 'Subscription failed');
                logPerformance('SUBSCRIBE', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }

            if (!item || !item.value) {
                // was not able to acquire a lock
                logIMAP('SUBSCRIBE', session, 'Command failed - mailbox not found', { path });
                logPerformance('SUBSCRIBE', Date.now() - startTime, { sessionId: session.id, status: 'NONEXISTENT' });
                return callback(null, 'NONEXISTENT');
            }

            logIMAP('SUBSCRIBE', session, 'Command completed successfully', {
                path,
                mailboxId: item.value._id
            });
            logPerformance('SUBSCRIBE', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });
            callback(null, true);
        }
    );
};
