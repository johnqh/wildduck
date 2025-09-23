'use strict';

const { logIMAP, logError, logPerformance } = require('../logger');

// CREATE "path/to/mailbox"
module.exports = (server, mailboxHandler) => (path, session, callback) => {
    const startTime = Date.now();

    logIMAP('CREATE', session, 'Command initiated', {
        path,
        userId: session.user.id
    });

    server.logger.debug(
        {
            tnx: 'create',
            cid: session.id
        },
        '[%s] CREATE "%s"',
        session.id,
        path
    );

    mailboxHandler.create(session.user.id, path, { subscribed: true }, (err, result) => {
        if (err) {
            logError(err, { command: 'CREATE', sessionId: session.id, userId: session.user.id, path }, 'Mailbox creation failed');
            logPerformance('CREATE', Date.now() - startTime, { sessionId: session.id, status: 'ERROR' });
            return callback(err);
        }

        logIMAP('CREATE', session, 'Command completed successfully', {
            path,
            userId: session.user.id,
            mailboxId: result && result.mailboxId
        });
        logPerformance('CREATE', Date.now() - startTime, { sessionId: session.id, status: 'SUCCESS' });
        callback(null, result);
    });
};
