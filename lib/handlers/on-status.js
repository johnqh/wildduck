'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// STATUS (X Y X)
module.exports = server => (path, session, callback) => {
    const startTime = Date.now();

    logIMAP('STATUS', session, 'Command initiated', {
        path,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'status',
            cid: session.id
        },
        '[%s] Requested status for "%s"',
        session.id,
        path
    );
    logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Looking up mailbox for status');

    db.database.collection('mailboxes').findOne(
        {
            user: session.user.id,
            path
        },
        {
            maxTimeMS: consts.DB_MAX_TIME_MAILBOXES
        },
        (err, mailboxData) => {
            if (err) {
                logError(err, { command: 'STATUS', sessionId: session.id, userId: session.user.id, path }, 'Mailbox lookup failed');
                logPerformance('STATUS', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }
            if (!mailboxData) {
                logIMAP('STATUS', session, 'Command failed - mailbox not found', { path });
                logPerformance('STATUS', Date.now() - startTime, { sessionId: session.id, status: 'NONEXISTENT' });
                return callback(null, 'NONEXISTENT');
            }

            logDB('findOne', 'mailboxes', { userId: session.user.id, path }, 'Mailbox found, counting messages');

            logDB('countDocuments', 'messages', { mailboxId: mailboxData._id }, 'Counting total messages');

            db.database.collection('messages').countDocuments(
                {
                    mailbox: mailboxData._id
                },
                {
                    maxTimeMS: consts.DB_MAX_TIME_MESSAGES
                },
                (err, total) => {
                    if (err) {
                        logError(err, { command: 'STATUS', sessionId: session.id, path, mailboxId: mailboxData._id }, 'Failed to count total messages');
                        logPerformance('STATUS', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                        return callback(err);
                    }

                    logDB('countDocuments', 'messages', { mailboxId: mailboxData._id, unseen: true }, 'Counting unseen messages');

                    db.database.collection('messages').countDocuments(
                        {
                            mailbox: mailboxData._id,
                            unseen: true
                        },
                        {
                            maxTimeMS: consts.DB_MAX_TIME_MESSAGES
                        },
                        (err, unseen) => {
                            if (err) {
                                logError(
                                    err,
                                    { command: 'STATUS', sessionId: session.id, path, mailboxId: mailboxData._id },
                                    'Failed to count unseen messages'
                                );
                                logPerformance('STATUS', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                                return callback(err);
                            }

                            const statusInfo = {
                                messages: total,
                                uidNext: mailboxData.uidNext,
                                uidValidity: mailboxData.uidValidity,
                                unseen,
                                highestModseq: Number(mailboxData.modifyIndex) || 0
                            };

                            logIMAP('STATUS', session, 'Command completed successfully', {
                                path,
                                statusInfo
                            });
                            logPerformance('STATUS', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });

                            return callback(null, statusInfo);
                        }
                    );
                }
            );
        }
    );
};
