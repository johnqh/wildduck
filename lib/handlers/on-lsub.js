'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// LSUB "" "*"
// Returns all subscribed folders, query is informational
// folders is either an Array or a Map
module.exports = server => (query, session, callback) => {
    const startTime = Date.now();

    logIMAP('LSUB', session, 'Command initiated', {
        query,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'lsub',
            cid: session.id
        },
        '[%s] LSUB for "%s"',
        session.id,
        query
    );

    logDB('find', 'mailboxes', { userId: session.user.id }, 'Querying subscribed mailboxes for LSUB');

    db.database
        .collection('mailboxes')
        .find({
            user: session.user.id,
            subscribed: true,
            hidden: { $ne: true }
        })
        .maxTimeMS(consts.DB_MAX_TIME_MAILBOXES)
        .toArray((err, mailboxes) => {
            if (err) {
                logError(err, { command: 'LSUB', sessionId: session.id, userId: session.user.id, query }, 'Subscribed mailbox query failed');
                logPerformance('LSUB', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }

            logIMAP('LSUB', session, 'Command completed successfully', {
                query,
                subscribedMailboxCount: mailboxes ? mailboxes.length : 0
            });
            logPerformance('LSUB', Date.now() - startTime, {
                sessionId: session.id,
                status: 'SUCCESS',
                subscribedMailboxCount: mailboxes ? mailboxes.length : 0
            });
            callback(null, mailboxes);
        });
};
