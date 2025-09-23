'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// SELECT/EXAMINE
module.exports = server => (path, session, callback) => {
    const startTime = Date.now();

    logIMAP('OPEN', session, 'Command initiated', {
        path,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'open',
            cid: session.id
        },
        '[%s] Opening "%s"',
        session.id,
        path
    );
    logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Looking up mailbox for open');

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
                logError(err, { command: 'OPEN', sessionId: session.id, userId: session.user.id, path }, 'Mailbox lookup failed');
                logPerformance('OPEN', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }
            if (!mailbox) {
                logIMAP('OPEN', session, 'Command failed - mailbox not found', { path });
                logPerformance('OPEN', Date.now() - startTime, { sessionId: session.id, status: 'NONEXISTENT' });
                return callback(null, 'NONEXISTENT');
            }

            if (mailbox.hidden) {
                logIMAP('OPEN', session, 'Command failed - mailbox hidden', { path, mailboxId: mailbox._id });
                logPerformance('OPEN', Date.now() - startTime, { sessionId: session.id, status: 'CANNOT' });
                return callback(null, 'CANNOT');
            }

            logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Mailbox found, loading messages');

            logDB('find', 'messages', { mailboxId: mailbox._id }, 'Loading message UIDs for mailbox');

            db.database
                .collection('messages')
                .find({
                    mailbox: mailbox._id
                })
                .project({
                    uid: true
                })
                //.sort({ uid: 1 })
                .maxTimeMS(consts.DB_MAX_TIME_MESSAGES)
                .toArray((err, messages) => {
                    if (err) {
                        logError(err, { command: 'OPEN', sessionId: session.id, userId: session.user.id, path, mailboxId: mailbox._id }, 'Message query failed');
                        logPerformance('OPEN', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                        return callback(err);
                    }
                    // sort and ensure unique UIDs
                    mailbox.uidList = Array.from(new Set(messages.map(message => message.uid))).sort((a, b) => a - b);

                    logIMAP('OPEN', session, 'Command completed successfully', {
                        path,
                        mailboxId: mailbox._id,
                        messageCount: mailbox.uidList.length
                    });
                    logPerformance('OPEN', Date.now() - startTime, {
                        sessionId: session.id,
                        status: 'SUCCESS',
                        messageCount: mailbox.uidList.length
                    });
                    callback(null, mailbox);
                });
        }
    );
};
