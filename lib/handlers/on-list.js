'use strict';

const db = require('../db');
const consts = require('../consts');
const { logIMAP, logError, logPerformance, logDB } = require('../logger');

// LIST "" "*"
// Returns all folders, query is informational
// folders is either an Array or a Map
module.exports = server =>
    (server.onList = function (query, session, callback) {
        const startTime = Date.now();

        logIMAP('LIST', session, 'Command initiated', {
            query,
            userId: session.user.id
        });

        server.logger.debug(
            {
                tnx: 'list',
                cid: session.id
            },
            '[%s] LIST for "%s"',
            session.id,
            query
        );

        logDB('find', 'mailboxes', { userId: session.user.id }, 'Querying mailboxes for LIST');

        db.database
            .collection('mailboxes')
            .find({
                user: session.user.id,
                hidden: { $ne: true }
            })
            .maxTimeMS(consts.DB_MAX_TIME_MAILBOXES)
            .toArray((err, mailboxes) => {
                if (err) {
                    logError(err, { command: 'LIST', sessionId: session.id, userId: session.user.id, query }, 'Mailbox query failed');
                    logPerformance('LIST', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
                    return callback(err);
                }

                logIMAP('LIST', session, 'Command completed successfully', {
                    query,
                    mailboxCount: mailboxes ? mailboxes.length : 0
                });
                logPerformance('LIST', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS', mailboxCount: mailboxes ? mailboxes.length : 0 });
                callback(null, mailboxes);
            });
    });
