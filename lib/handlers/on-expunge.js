/* eslint no-invalid-this:0 */

'use strict';

const db = require('../db');
const tools = require('../tools');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// EXPUNGE deletes all messages in selected mailbox marked with \Delete
module.exports = (server, messageHandler) => (mailbox, update, session, callback) => {
    const startTime = Date.now();

    logIMAP('EXPUNGE', session, 'Command initiated', {
        mailbox,
        isUid: update.isUid,
        messages: update.messages,
        silent: update.silent
    });

    server.logger.debug(
        {
            tnx: 'expunge',
            cid: session.id
        },
        '[%s] Deleting messages from "%s"',
        session.id,
        mailbox
    );
    logDB('findOne', 'mailboxes', { mailboxId: mailbox }, 'Looking up mailbox for expunge');

    db.database.collection('mailboxes').findOne(
        {
            _id: mailbox
        },
        {
            maxTimeMS: consts.DB_MAX_TIME_MAILBOXES
        },
        (err, mailboxData) => {
            if (err) {
                logError(err, { command: 'EXPUNGE', sessionId: session.id, mailboxId: mailbox }, 'Mailbox lookup failed');
                logPerformance('EXPUNGE', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                return callback(err);
            }
            if (!mailboxData) {
                logIMAP('EXPUNGE', session, 'Command failed - mailbox not found', { mailbox });
                logPerformance('EXPUNGE', Date.now() - startTime, { sessionId: session.id, status: 'NONEXISTENT' });
                return callback(null, 'NONEXISTENT');
            }

            if (!mailboxData.user.equals(session.user.id)) {
                logIMAP('EXPUNGE', session, 'Command failed - access denied', {
                    mailbox,
                    userId: session.user.id,
                    mailboxOwner: mailboxData.user
                });
                logPerformance('EXPUNGE', Date.now() - startTime, { sessionId: session.id, status: 'ACCESS_DENIED' });
                return callback(null, 'NONEXISTENT');
            }

            logDB('findOne', 'mailboxes', { mailboxId: mailbox }, 'Mailbox verified, proceeding with expunge');

            let query = {
                mailbox: mailboxData._id,
                undeleted: false
            };

            if (update.isUid) {
                query.uid = tools.checkRangeQuery(update.messages);
            }

            let logdata = {
                short_message: '[EXPUNGE]',
                _mail_action: 'expunge',
                _user: session.user.id.toString(),
                _mailbox: mailboxData._id.toString(),
                _sess: session.id,
                _deleted: 0
            };

            let deletedSize = 0;
            let updateQuota = done => {
                if (!deletedSize) {
                    return done();
                }

                // try to update quota
                messageHandler.updateQuota(
                    session.user.id,
                    {
                        storageUsed: -deletedSize,
                        mailbox: mailboxData._id
                    },
                    {
                        session
                    },
                    () => done()
                );
            };

            const LOCK_TTL = 2 * 60 * 1000;
            let lockKey = ['mbwr', mailboxData._id.toString()].join(':');
            server.lock.waitAcquireLock(lockKey, LOCK_TTL, 1 * 60 * 1000, (err, lock) => {
                if (err) {
                    logError(err, { command: 'EXPUNGE', sessionId: session.id, mailboxId: mailbox }, 'Failed to acquire lock');
                    logPerformance('EXPUNGE', Date.now() - startTime, { sessionId: session.id, status: 'LOCK_ERROR' });
                    return callback(err);
                }

                if (!lock.success) {
                    const lockError = new Error('Failed to get folder write lock');
                    logError(lockError, { command: 'EXPUNGE', sessionId: session.id, mailboxId: mailbox }, 'Lock acquisition failed');
                    logPerformance('EXPUNGE', Date.now() - startTime, { sessionId: session.id, status: 'LOCK_FAILED' });
                    return callback(null, lockError);
                }

                server.logger.debug(
                    {
                        tnx: 'MOVE'
                    },
                    'Acquired lock for deleting messages user=%s mailbox=%s message=%s lock=%s',
                    session.user.id.toString(),
                    mailbox.toString(),
                    mailboxData._id.toString(),
                    lock.id
                );

                let extendLockIntervalTimer = setInterval(
                    () => {
                        server.lock
                            .extendLock(lock, LOCK_TTL)
                            .then(info => {
                                server.logger.debug(
                                    {
                                        tnx: 'MOVE'
                                    },
                                    `Lock extended lock=${info.id} result=${info.success ? 'yes' : 'no'}`
                                );
                            })
                            .catch(err => {
                                server.logger.debug(
                                    {
                                        tnx: 'MOVE',
                                        err
                                    },
                                    'Failed to extend lock lock=%s error=%s',
                                    lock?.id,
                                    err.message
                                );
                            });
                    },
                    Math.round(LOCK_TTL * 0.8)
                );

                // fetch entire messages as these need to be copied to the archive
                logDB('find', 'messages', { mailboxId: mailboxData._id, query }, 'Querying messages to expunge');
                let cursor = db.database.collection('messages').find(query).sort({ uid: 1 }).maxTimeMS(consts.DB_MAX_TIME_MESSAGES);

                let processNext = () => {
                    cursor.next((err, messageData) => {
                        if (err) {
                            logError(err, { command: 'EXPUNGE', sessionId: session.id, mailboxId: mailbox }, 'Error processing messages');
                            clearInterval(extendLockIntervalTimer);
                            return server.lock.releaseLock(lock, () => {
                                updateQuota(() => {
                                    logPerformance('EXPUNGE', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                                    callback(err);
                                });
                            });
                        }
                        if (!messageData) {
                            //server.loggelf(logdata);

                            return cursor.close(() => {
                                server.notifier.fire(session.user.id);
                                if (!update.silent && session && session.selected && session.selected.uidList) {
                                    session.writeStream.write({
                                        tag: '*',
                                        command: String(session.selected.uidList.length),
                                        attributes: [
                                            {
                                                type: 'atom',
                                                value: 'EXISTS'
                                            }
                                        ]
                                    });
                                }
                                clearInterval(extendLockIntervalTimer);
                                return server.lock.releaseLock(lock, () => {
                                    updateQuota(() => {
                                        logIMAP('EXPUNGE', session, 'Command completed successfully', {
                                            mailbox,
                                            deletedMessages: logdata._deleted,
                                            deletedSize
                                        });
                                        logPerformance('EXPUNGE', Date.now() - startTime, {
                                            sessionId: session.id,
                                            status: 'SUCCESS',
                                            deletedMessages: logdata._deleted
                                        });
                                        callback(null, true);
                                    });
                                });
                            });
                        }

                        messageHandler.del(
                            {
                                messageData,
                                session,
                                // do not archive drafts nor copied messages
                                archive: !messageData.flags.includes('\\Draft') && !messageData.copied,
                                delayNotifications: true
                            },
                            (err, deleted) => {
                                if (err) {
                                    server.logger.error(
                                        {
                                            tnx: 'EXPUNGE',
                                            err
                                        },
                                        'Failed to delete message id=%s. %s',
                                        messageData._id,
                                        err.message
                                    );
                                    logdata._error = err.message;
                                    logdata._code = err.code;
                                    logdata._response = err.response;
                                    server.loggelf(logdata);
                                    clearInterval(extendLockIntervalTimer);
                                    return cursor.close(() => server.lock.releaseLock(lock, () => updateQuota(() => callback(err))));
                                }

                                if (!deleted) {
                                    // nothing was deleted, so skip
                                    return setImmediate(processNext);
                                }

                                logdata._deleted++;
                                deletedSize += messageData.size;

                                server.logger.debug(
                                    {
                                        tnx: 'EXPUNGE',
                                        err
                                    },
                                    'Deleted message id=%s',
                                    messageData._id
                                );

                                if (!update.silent) {
                                    session.writeStream.write(session.formatResponse('EXPUNGE', messageData.uid));
                                }

                                setImmediate(processNext);
                            }
                        );
                    });
                };

                processNext();
            });
        }
    );
};
