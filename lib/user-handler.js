'use strict';

const config = require('wild-config');
const log = require('npmlog');
const tools = require('./tools');
const consts = require('./consts');
const counters = require('./counters');
const ObjectId = require('mongodb').ObjectId;
const crypto = require('crypto');
const mailboxTranslations = require('./translations');
const UserCache = require('./user-cache');
const isemail = require('isemail');
const util = require('util');
const TaskHandler = require('./task-handler');
const { SettingsHandler } = require('./settings-handler');
const { isValidBlockchainIdentifier } = require('./blockchain-validator');
const { getAuthenticationAddress } = require('./name-resolver');
const { verifySignature } = require('./signature-verifier');

const {
    publish,
    USER_CREATED,
    USER_DELETE_STARTED,
    USER_DELETE_CANCELLED
} = require('./events');


class UserHandler {
    constructor(options) {
        this.database = options.database;
        this.users = options.users || options.database;
        this.redis = options.redis;

        this.loggelf = options.loggelf || (() => false);

        this.messageHandler = options.messageHandler;
        this.counters = this.messageHandler ? this.messageHandler.counters : counters(this.redis);

        this.settingsHandler = new SettingsHandler({ db: this.database });

        this.userCache = new UserCache({
            users: this.users,
            redis: this.redis,
            settingsHandler: this.settingsHandler
        });

        this.flushUserCache = util.promisify(this.userCache.flush.bind(this.userCache));

        this.taskHandler = new TaskHandler({ database: this.database });
    }

    resolveAddress(address, options, callback) {
        if (!callback) {
            return this.asyncResolveAddress(address, options);
        }
        this.asyncResolveAddress(address, options)
            .catch(err => callback(err))
            .then(result => callback(null, result));
    }

    async asyncResolveAddress(address, options) {
        options = options || {};
        let wildcard = !!options.wildcard;

        address = tools.normalizeAddress(address, false, {
            removeLabel: true,
            removeDots: true
        });

        let atPos = address.indexOf('@');
        let username = address.substr(0, atPos);
        let domain = address.substr(atPos + 1);

        let projection = {
            user: true,
            targets: true
        };

        Object.keys(options.projection || {}).forEach(key => {
            projection[key] = true;
        });

        if (options.projection === false) {
            // do not use projection
            projection = false;
        }

        try {
            let addressData;
            // try exact match
            addressData = await this.users.collection('addresses').findOne(
                {
                    addrview: username + '@' + domain
                },
                {
                    projection,
                    maxTimeMS: consts.DB_MAX_TIME_USERS
                }
            );

            if (addressData) {
                return addressData;
            }

            // try an alias
            let aliasDomain;
            let aliasData = await this.users.collection('domainaliases').findOne(
                { alias: domain },
                {
                    maxTimeMS: consts.DB_MAX_TIME_USERS
                }
            );

            if (aliasData) {
                aliasDomain = aliasData.domain;

                addressData = await this.users.collection('addresses').findOne(
                    {
                        addrview: username + '@' + aliasDomain
                    },
                    {
                        projection,
                        maxTimeMS: consts.DB_MAX_TIME_USERS
                    }
                );

                if (addressData) {
                    return addressData;
                }
            }

            if (!wildcard) {
                // wildcard not allowed, so there is nothing else to check for
                return false;
            }

            // Add addrview to projection as we will need it down further for
            // matching the right wildcard partial address.
            projection.addrview = true;
            let partialWildcards = tools.getWildcardAddresses(username, domain);

            let query = {
                addrview: { $in: partialWildcards }
            };

            let sortedDomainPartials = partialWildcards.map(addr => addr.replace(/^\*/, '')).sort((a, b) => b.length - a.length);
            let sortedAliasPartials = [];

            if (aliasDomain) {
                // search for alias domain as well
                let aliasWildcards = tools.getWildcardAddresses(username, aliasDomain);
                query.addrview.$in = query.addrview.$in.concat(aliasWildcards);
                sortedAliasPartials = aliasWildcards.map(addr => addr.replace(/^\*/, '')).sort((a, b) => a.length - b.length);
            }

            let sortedPartials = sortedDomainPartials.concat(sortedAliasPartials);

            // try to find a catch-all address while preferring the longest match
            let addressMatches = await this.users
                .collection('addresses')
                .find(query, {
                    projection,
                    maxTimeMS: consts.DB_MAX_TIME_USERS
                })
                .toArray();

            if (addressMatches && addressMatches.length) {
                let matchingPartials = new WeakMap();

                addressMatches.forEach(addressData => {
                    let partialMatch = sortedPartials.find(partial => addressData.addrview.indexOf(partial) >= 0);
                    if (partialMatch) {
                        matchingPartials.set(addressData, sortedPartials.indexOf(partialMatch));
                    }
                });

                addressData = addressMatches.sort((a, b) => {
                    let aPos = matchingPartials.has(a) ? matchingPartials.get(a) : Infinity;
                    let bPos = matchingPartials.has(b) ? matchingPartials.get(b) : Infinity;
                    return aPos - bPos;
                })[0];
            }

            if (addressData) {
                return addressData;
            }

            // try to find a catch-all user (eg. "postmaster@*")
            addressData = await this.users.collection('addresses').findOne(
                {
                    addrview: username + '@*'
                },
                {
                    projection,
                    maxTimeMS: consts.DB_MAX_TIME_USERS
                }
            );

            if (addressData) {
                return addressData;
            }
        } catch (err) {
            err.responseCode = 500;
            err.code = 'InternalDatabaseError';
            throw err;
        }

        if (options.create) {
            // create addresss and user id required for this address
            // Validate blockchain identifier format
            if (!isValidBlockchainIdentifier(username)) {
                let err = new Error(`Invalid blockchain identifier format: "${username}" is not a valid EVM address, Solana address, ENS name, or SNS name`);
                err.responseCode = 400;
                err.code = 'InvalidBlockchainIdentifier';
                err.provided_username = username;
                err.expected_formats = ['EVM address (0x...)', 'Base64 EVM address', 'Solana address', 'ENS name (.eth)', 'SNS name (.sol)'];
                throw err;
            }

            const authDetails = await getAuthenticationAddress(username);
            if (!authDetails) {
                let err = new Error(`Unable to resolve blockchain authentication address for "${username}". This could be due to network issues, invalid ENS/SNS name, or unsupported blockchain identifier.`);
                err.responseCode = 404;
                err.code = 'BlockchainAddressNotFound';
                err.provided_username = username;
                err.attempted_resolution = 'ENS/SNS name resolution or direct address validation';
                throw err;
            }

            // Create user with blockchain authentication
            let userData = await this.create({
                username,
                address: username + '@' + domain,
                name: options.name || username,
                blockchainAuth: {
                    type: authDetails.type,
                    address: authDetails.address
                },
                emptyAddress: true
            });

            return {
                user: userData,
                targets: [{ user: userData, type: 'user' }]
            };
        }

        return false;
    }

    get(username, extraFields, callback) {
        if (!callback && typeof extraFields === 'function') {
            callback = extraFields;
            extraFields = false;
        }
        if (!callback) {
            return this.asyncGet(username, extraFields);
        }
        this.asyncGet(username, extraFields)
            .catch(err => callback(err))
            .then(result => callback(null, result));
    }

    async asyncGet(username, extraFields) {
        let fields = {
            _id: true,
            username: true,
            name: true,
            language: true,
            storageUsed: true,
            disabled: true,
            suspended: true,
            blockchainAuth: true // Include blockchain auth details
        };

        Object.keys(extraFields || {}).forEach(field => {
            fields[field] = true;
        });

        let query, addressData;
        if (tools.isId(username)) {
            query = {
                _id: new ObjectId(username)
            };
        } else {
            addressData = await this.resolveAddress(username, { projection: { name: true, user: true } });
            if (addressData.user) {
                query = {
                    _id: addressData.user
                };
            }
        }

        if (!query) {
            return false;
        }

        try {
            let userData = await this.users.collection('users').findOne(query, { maxTimeMS: consts.DB_MAX_TIME_USERS, projection: fields });
            if (userData && fields.name && addressData && addressData.name) {
                userData.name = addressData.name;
            }
            return userData;
        } catch (err) {
            err.responseCode = 500;
            err.code = 'InternalDatabaseError';
            throw err;
        }
    }

    async rateLimitIP(meta, count) {
        if (!meta || !meta.ip || !consts.IP_AUTH_FAILURES) {
            return { success: true };
        }

        let key = 'rlauth:' + meta.ip;

        try {
            let res = await this.redis.multi().incr(key).expire(key, consts.IP_AUTH_WINDOW).exec();
            let isMember = res && res[0] && res[0][1];

            if (count) {
                return { success: isMember <= consts.IP_AUTH_FAILURES };
            }

            let success = isMember <= consts.IP_AUTH_FAILURES;
            let ttl = !success ? await this.redis.ttl(key) : 0;

            if (!success && ttl <= 0) {
                await this.redis.del(key);
                success = true;
            }

            return {
                success,
                ttl
            };
        } catch (err) {
            // redis connection issues
            log.error('Redis', err);
            return { success: true };
        }
    }

    async rateLimitUser(tokenID, meta, count) {
        if (meta && meta.ip) {
            try {
                let key = 'rlauth:user:' + tokenID.toString();
                
                // Increment the counter and set expiry in one transaction
                let pipeline = this.redis.multi();
                pipeline.incr(key);
                pipeline.expire(key, consts.USER_AUTH_WINDOW);
                let res = await pipeline.exec();
                
                // Extract the count from the incr result
                let currentCount = res && res[0] && res[0][1] ? res[0][1] : 0;

                if (count) {
                    return { success: currentCount <= consts.USER_AUTH_FAILURES };
                }

                let success = currentCount <= consts.USER_AUTH_FAILURES;
                let ttl = !success ? await this.redis.ttl(key) : 0;

                if (!success && ttl <= 0) {
                    await this.redis.del(key);
                    success = true;
                }

                return {
                    success,
                    ttl
                };
            } catch (err) {
                // redis connection issues - allow authentication to proceed
                log.error('Redis', err);
                return { success: true };
            }
        }

        return { success: true };
    }

    async rateLimitReleaseUser(tokenID) {
        if (!tokenID) {
            return false;
        }

        try {
            let key = 'rlauth:user:' + tokenID.toString();
            return await this.redis.del(key);
        } catch (err) {
            // redis connection issues
            log.error('Redis', err);
        }

        return false;
    }

    async rateLimit(tokenID, meta, count) {
        // Check if rate limiting is disabled via environment variable
        if (process.env.ENABLE_RATE_LIMITING !== 'true') {
            return { success: true };
        }

        let ipRes = await this.rateLimitIP(meta, count);
        let userRes = await this.rateLimitUser(tokenID, meta, count);

        if (!ipRes.success) {
            return ipRes;
        }

        if (!userRes.success) {
            return userRes;
        }

        return { success: true };
    }

    /**
     * Blockchain-based authentication method
     * @param {String} username Username of the user (blockchain identifier)
     * @param {String} signature Blockchain signature for authentication
     * @param {String} [requiredScope="master"] Which scope to use
     * @param {Object} meta Authentication request metadata
     * @param {Function} callback Optional callback
     * @returns {Array} Returns [authResponse, userId] or [false, false] for failed authentication
     */
    authenticate(username, signature, requiredScope, meta, callback) {
        if (!callback) {
            return this.asyncAuthenticate(username, signature, requiredScope, meta);
        }
        this.asyncAuthenticate(username, signature, requiredScope, meta)
            .catch(err => callback(err))
            .then(result => {
                if (!Array.isArray(result)) {
                    return callback(null, result);
                }
                callback(null, ...result);
            });
    }

    async asyncAuthenticate(username, signature, requiredScope, meta) {
        meta = meta || {};
        requiredScope = requiredScope || 'master';

        let userQuery;
        let rateLimitRes;

        // Signature is required for blockchain authentication
        if (!signature) {
            try {
                let authlogTime = await this.users.collection('users').findOne(
                    {
                        $or: [{ unameview: tools.uview(username) }, { address: tools.normalizeAddress(username) }]
                    },
                    {
                        projection: { _id: true },
                        maxTimeMS: consts.DB_MAX_TIME_USERS
                    }
                );

                meta.requiredScope = requiredScope;

                await this.logAuthEvent(authlogTime && authlogTime._id, {
                    action: 'authentication',
                    requiredScope,
                    result: 'fail',
                    source: 'api',
                    ip: meta.ip,
                    protocol: meta.protocol || 'API',
                    sess: meta.sess,
                    username,
                    _scope: requiredScope,
                    _message: 'Missing signature'
                });
            } catch (err) {
                log.error('DB', 'AUTHFAIL username=%s error=%s', username, err.message);
            }

            return [false, false];
        }

        // Nonce is required for signature verification
        if (!meta.nonce) {
            try {
                let authlogTime = await this.users.collection('users').findOne(
                    {
                        $or: [{ unameview: tools.uview(username) }, { address: tools.normalizeAddress(username) }]
                    },
                    {
                        projection: { _id: true },
                        maxTimeMS: consts.DB_MAX_TIME_USERS
                    }
                );

                meta.requiredScope = requiredScope;

                await this.logAuthEvent(authlogTime && authlogTime._id, {
                    action: 'authentication',
                    requiredScope,
                    result: 'fail',
                    source: 'api',
                    ip: meta.ip,
                    protocol: meta.protocol || 'API',
                    sess: meta.sess,
                    username,
                    _scope: requiredScope,
                    _message: 'Missing nonce'
                });
            } catch (err) {
                log.error('DB', 'AUTHFAIL username=%s error=%s', username, err.message);
            }

            return [false, false];
        }

        // Check rate limiting
        rateLimitRes = await this.rateLimit(username, meta, true);
        if (!rateLimitRes.success) {
            try {
                let authlogTime = await this.users.collection('users').findOne(
                    {
                        $or: [{ unameview: tools.uview(username) }, { address: tools.normalizeAddress(username) }]
                    },
                    {
                        projection: { _id: true },
                        maxTimeMS: consts.DB_MAX_TIME_USERS
                    }
                );

                meta.requiredScope = requiredScope;

                await this.logAuthEvent(authlogTime && authlogTime._id, {
                    action: 'authentication',
                    requiredScope,
                    result: 'fail',
                    source: 'api',
                    ip: meta.ip,
                    protocol: meta.protocol || 'API',
                    sess: meta.sess,
                    username,
                    _scope: requiredScope,
                    _message: 'Rate limited'
                });
            } catch (err) {
                log.error('DB', 'AUTHFAIL username=%s error=%s', username, err.message);
            }

            throw rateLimitResponse(rateLimitRes);
        }

        // Check if user exists
        if (tools.isId(username)) {
            userQuery = {
                _id: new ObjectId(username)
            };
        } else {
            userQuery = {
                $or: [{ unameview: tools.uview(username) }, { address: tools.normalizeAddress(username) }]
            };
        }

        let userData;
        try {
            userData = await this.users.collection('users').findOne(
                userQuery,
                {
                    maxTimeMS: consts.DB_MAX_TIME_USERS
                }
            );
        } catch (err) {
            err.responseCode = 500;
            err.code = 'InternalDatabaseError';

            try {
                meta.requiredScope = requiredScope;

                await this.logAuthEvent(false, {
                    action: 'authentication',
                    requiredScope,
                    result: 'error',
                    source: 'api',
                    ip: meta.ip,
                    protocol: meta.protocol || 'API',
                    sess: meta.sess,
                    username,
                    _scope: requiredScope,
                    _message: err.message
                });
            } catch (err) {
                log.error('DB', 'AUTHFAIL username=%s error=%s', username, err.message);
            }

            throw err;
        }

        if (!userData) {
            // Try to verify signature first and create user if signature is valid
            try {
                // Check if this is a valid blockchain identifier
                if (isValidBlockchainIdentifier(username)) {
                    // Extract username and domain parts for address creation
                    let address = username;
                    let atPos = address.indexOf('@');
                    let actualUsername, domain;
                    
                    if (atPos !== -1) {
                        actualUsername = address.substr(0, atPos);
                        domain = address.substr(atPos + 1);
                    } else {
                        // If no domain specified, use a default or treat as blockchain address
                        actualUsername = username;
                        domain = 'localhost'; // or some default domain
                        address = actualUsername + '@' + domain;
                    }

                    const authDetails = await getAuthenticationAddress(actualUsername);
                    if (authDetails) {
                        // Verify signature BEFORE creating user
                        // No specific message required - just verify signature is from the address
                        const signatureValid = await verifySignature(
                            actualUsername,
                            signature,
                            null // No message required
                        );

                        if (signatureValid) {
                            // Only create user if signature is valid
                            let newUserData = await this.create({
                                username: actualUsername,
                                address,
                                name: actualUsername,
                                blockchainAuth: {
                                    type: authDetails.type,
                                    address: authDetails.address,
                                    lastNonce: meta.nonce,
                                    lastAuth: new Date()
                                },
                                emptyAddress: true
                            });

                            // Re-query for the newly created user
                            userData = await this.users.collection('users').findOne(
                                { _id: newUserData },
                                {
                                    maxTimeMS: consts.DB_MAX_TIME_USERS
                                }
                            );

                            log.info('USER', 'Auto-created user for blockchain authentication: %s', actualUsername);
                        }
                    }
                }
            } catch (createErr) {
                log.error('DB', 'AUTOCREATE failed for username=%s error=%s', username, createErr.message);
            }

            // If still no user data after auto-creation attempt
            if (!userData) {
                rateLimitRes = await this.rateLimit(username, meta);
                if (!rateLimitRes.success) {
                    meta.requiredScope = requiredScope;

                    try {
                        await this.logAuthEvent(false, {
                            action: 'authentication',
                            requiredScope,
                            result: 'fail',
                            source: 'api',
                            ip: meta.ip,
                            protocol: meta.protocol || 'API',
                            sess: meta.sess,
                            username,
                            _scope: requiredScope,
                            _message: 'Unknown user, rate limited'
                        });
                    } catch (err) {
                        log.error('DB', 'AUTHFAIL username=%s error=%s', username, err.message);
                    }

                    throw rateLimitResponse(rateLimitRes);
                }

                meta.requiredScope = requiredScope;

                try {
                    await this.logAuthEvent(false, {
                        action: 'authentication',
                        requiredScope,
                        result: 'fail',
                        source: 'api',
                        ip: meta.ip,
                        protocol: meta.protocol || 'API',
                        sess: meta.sess,
                        username,
                        _scope: requiredScope,
                        _message: 'Unknown user'
                    });
                } catch (err) {
                    log.error('DB', 'AUTHFAIL username=%s error=%s', username, err.message);
                }

                return [false, false];
            }
        }

        // Check if user account is disabled
        if (userData.disabled) {
            rateLimitRes = await this.rateLimit(userData._id, meta);
            if (!rateLimitRes.success) {
                try {
                    meta.requiredScope = requiredScope;

                    await this.logAuthEvent(userData._id, {
                        action: 'authentication',
                        requiredScope,
                        result: 'fail',
                        source: 'api',
                        ip: meta.ip,
                        protocol: meta.protocol || 'API',
                        sess: meta.sess,
                        username,
                        _scope: requiredScope,
                        _message: 'User disabled, rate limited'
                    });
                } catch (err) {
                    log.error('DB', 'AUTHFAIL id=%s error=%s', userData._id, err.message);
                }

                throw rateLimitResponse(rateLimitRes);
            }

            try {
                meta.requiredScope = requiredScope;

                await this.logAuthEvent(userData._id, {
                    action: 'authentication',
                    requiredScope,
                    result: 'fail',
                    source: 'api',
                    ip: meta.ip,
                    protocol: meta.protocol || 'API',
                    sess: meta.sess,
                    username,
                    _scope: requiredScope,
                    _message: 'User disabled'
                });
            } catch (err) {
                log.error('DB', 'AUTHFAIL id=%s error=%s', userData._id, err.message);
            }

            return [false, false];
        }

        // Check if user account is suspended
        if (userData.suspended) {
            rateLimitRes = await this.rateLimit(userData._id, meta);
            if (!rateLimitRes.success) {
                try {
                    meta.requiredScope = requiredScope;

                    await this.logAuthEvent(userData._id, {
                        action: 'authentication',
                        requiredScope,
                        result: 'fail',
                        source: 'api',
                        ip: meta.ip,
                        protocol: meta.protocol || 'API',
                        sess: meta.sess,
                        username,
                        _scope: requiredScope,
                        _message: 'User suspended, rate limited'
                    });
                } catch (err) {
                    log.error('DB', 'AUTHFAIL id=%s error=%s', userData._id, err.message);
                }

                throw rateLimitResponse(rateLimitRes);
            }

            try {
                meta.requiredScope = requiredScope;

                await this.logAuthEvent(userData._id, {
                    action: 'authentication',
                    requiredScope,
                    result: 'fail',
                    source: 'api',
                    ip: meta.ip,
                    protocol: meta.protocol || 'API',
                    sess: meta.sess,
                    username,
                    _scope: requiredScope,
                    _message: 'User suspended'
                });
            } catch (err) {
                log.error('DB', 'AUTHFAIL id=%s error=%s', userData._id, err.message);
            }

            return [false, false];
        }

        let disabledScopes = userData.disabledScopes || [];
        if (disabledScopes.includes(requiredScope)) {
            let err = new Error('Access to requested service disabled');
            err.response = 'NO';
            err.responseCode = 403;
            err.code = 'InvalidAuthScope';
            err.user = userData._id;
            throw err;
        }


        // Blockchain signature verification
        try {
            // Verify blockchain authentication is configured
            if (!userData.blockchainAuth || !userData.blockchainAuth.address || !userData.blockchainAuth.type) {
                throw new Error('Blockchain authentication not configured for user');
            }

            // Check if this user was just created (nonce already matches)
            let signatureAlreadyVerified = userData.blockchainAuth.lastNonce === meta.nonce;
            let success = false;

            if (signatureAlreadyVerified) {
                // User was just auto-created with valid signature, skip re-verification
                success = true;
            } else {
                // Prevent nonce reuse for existing users
                if (userData.blockchainAuth.lastNonce === meta.nonce) {
                    let err = new Error(`Nonce "${meta.nonce}" already used for user "${username}"`);
                    err.code = 'NonceReused';
                    err.username = username;
                    err.nonce = meta.nonce;
                    err.lastUsedNonce = userData.blockchainAuth.lastNonce;
                    throw err;
                }

                // Verify the signature using the blockchain authentication address
                // No specific message required - just verify signature is from the address
                try {
                    success = await verifySignature(
                        username,
                        signature,
                        null // No message required
                    );
                } catch (verifyErr) {
                    // Signature verification threw an error (malformed signature, etc.)
                    let err = new Error(`Signature verification failed for user "${username}": ${verifyErr.message}`);
                    err.code = 'SignatureVerificationError';
                    err.username = username;
                    err.signature = signature?.substring(0, 20) + '...';
                    err.nonce = meta.nonce;
                    err.message_signed = 'Any valid signature from the wallet address';
                    err.expected_address = userData.blockchainAuth.address;
                    err.verification_error = verifyErr.message;
                    throw err;
                }
            }

            if (success) {
                // Update the last used nonce to prevent replay attacks (only if not already set)
                if (!signatureAlreadyVerified) {
                    await this.users.collection('users').updateOne(
                        { _id: userData._id },
                        {
                            $set: {
                                'blockchainAuth.lastNonce': meta.nonce,
                                'blockchainAuth.lastAuth': new Date()
                            }
                        }
                    );
                }

                // Release rate limiting
                await this.rateLimitReleaseUser(userData._id);
            } else {
                // Signature verification failed - signature doesn't match
                let err = new Error(`Signature verification failed: signature does not match for user "${username}"`);
                err.code = 'SignatureMismatch';
                err.username = username;
                err.signature = signature?.substring(0, 20) + '...';
                err.nonce = meta.nonce;
                err.message_signed = 'Any valid signature from the wallet address';
                err.expected_address = userData.blockchainAuth.address;
                err.verification_result = 'FAILED';
                throw err;
            }

            meta.requiredScope = requiredScope;

            try {
                await this.logAuthEvent(userData._id, {
                    action: 'authentication',
                    requiredScope,
                    result: 'success',
                    source: 'api',
                    ip: meta.ip,
                    protocol: meta.protocol || 'API',
                    sess: meta.sess,
                    username,
                    _scope: requiredScope,
                    _message: 'Blockchain authentication successful'
                });
            } catch (err) {
                log.error('DB', 'AUTHFAIL id=%s error=%s', userData._id, err.message);
            }

            let authResponse = {
                user: userData._id,
                username: userData.username,
                scope: meta.requiredScope
            };

            return [authResponse, userData._id];
        } catch (err) {
            // Blockchain signature verification failed
            rateLimitRes = await this.rateLimit(userData._id, meta);
            if (!rateLimitRes.success) {
                try {
                    meta.requiredScope = requiredScope;

                    await this.logAuthEvent(userData._id, {
                        action: 'authentication',
                        requiredScope,
                        result: 'fail',
                        source: 'api',
                        ip: meta.ip,
                        protocol: meta.protocol || 'API',
                        sess: meta.sess,
                        username,
                        _scope: requiredScope,
                        _message: 'Invalid blockchain signature, rate limited'
                    });
                } catch (err) {
                    log.error('DB', 'AUTHFAIL id=%s error=%s', userData._id, err.message);
                }

                throw rateLimitResponse(rateLimitRes);
            }

            try {
                meta.requiredScope = requiredScope;

                await this.logAuthEvent(userData._id, {
                    action: 'authentication',
                    requiredScope,
                    result: 'fail',
                    source: 'api',
                    ip: meta.ip,
                    protocol: meta.protocol || 'API',
                    sess: meta.sess,
                    username,
                    _scope: requiredScope,
                    _message: 'Invalid blockchain signature'
                });
            } catch (err) {
                log.error('DB', 'AUTHFAIL id=%s error=%s', userData._id, err.message);
            }

            // return as failed auth
            return [false, false];
        }
    }

    async preAuth(username, requiredScope) {
        let userData, userQuery;

        if (tools.isId(username)) {
            userQuery = {
                _id: new ObjectId(username)
            };
        } else {
            userQuery = {
                $or: [{ unameview: tools.uview(username) }, { address: tools.normalizeAddress(username) }]
            };
        }

        try {
            userData = await this.users.collection('users').findOne(
                userQuery,
                {
                    projection: {
                        _id: true,
                        username: true,
                        disabled: true,
                        suspended: true,
                        disabledScopes: true,
                        blockchainAuth: true // Include blockchain auth details
                    },
                    maxTimeMS: consts.DB_MAX_TIME_USERS
                }
            );
        } catch (err) {
            err.responseCode = 500;
            err.code = 'InternalDatabaseError';
            throw err;
        }

        if (!userData || userData.disabled || userData.suspended) {
            // return as failed auth
            return [false, false];
        }

        let disabledScopes = userData.disabledScopes || [];
        if (disabledScopes.includes(requiredScope)) {
            let err = new Error('Access to requested service disabled');
            err.response = 'NO';
            err.responseCode = 403;
            err.code = 'InvalidAuthScope';
            err.user = userData._id;
            throw err;
        }


        let authResponse = {
            user: userData._id,
            username: userData.username,
            scope: requiredScope,
            // Include blockchain auth status for UI
            hasBlockchainAuth: !!(userData.blockchainAuth && userData.blockchainAuth.address),
            blockchainType: userData.blockchainAuth?.type
        };

        return [authResponse, userData._id];
    }


    async create(data) {
        let userData = {
            username: data.username, // blockchain address/ENS/SNS name
            name: data.name || data.username,

            language: data.language || config.api.defaultLanguage || 'en',

            // default quota
            storageUsed: 0,
            quota: data.quota || config.maxStorage * 1024 * 1024,
            recipients: data.recipients || config.maxRecipients,

            // default settings
            forwards: data.forwards || config.maxForwards,
            imapMaxUpload: data.imapMaxUpload || config.imap.maxUpload,
            imapMaxDownload: data.imapMaxDownload || config.imap.maxDownload,
            popMaxDownload: data.popMaxDownload || config.pop3.maxDownload,
            imapMaxConnections: data.imapMaxConnections || config.imap.maxConnections,
            receivedMax: data.receivedMax || config.maxReceivedCounters,

            targets: data.targets,

            created: new Date()
        };

        if (data.blockchainAuth) {
            userData.blockchainAuth = data.blockchainAuth;
        }

        let existingUserData;
        try {
            existingUserData = await this.users.collection('users').findOne(
                {
                    unameview: tools.uview(userData.username)
                },
                {
                    projection: { _id: true },
                    maxTimeMS: consts.DB_MAX_TIME_USERS
                }
            );
        } catch (err) {
            log.error('DB', 'CREATEFAIL username=%s error=%s', userData.username, err.message);
            err.responseCode = 500;
            err.code = 'InternalDatabaseError';
            throw err;
        }

        if (existingUserData) {
            let err = new Error(`Username "${data.username}" already exists`);
            err.responseCode = 400;
            err.code = 'UserExistsError';
            throw err;
        }

        if (data.tags && data.tags.length) {
            userData.tags = data.tags;

            let tagSeen = new Set();
            let tags = userData.tags
                .map(tag => tag.trim())
                .filter(tag => {
                    if (tag && !tagSeen.has(tag.toLowerCase())) {
                        tagSeen.add(tag.toLowerCase());
                        return true;
                    }
                    return false;
                })
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            userData.tags = tags;
            userData.tagsview = tags.map(tag => tag.toLowerCase().trim());
        }

        userData.unameview = tools.uview(userData.username);

        let address;
        if (!data.emptyAddress) {
            if (!address) {
                address = userData.address;
                if (isemail.validate(data.username)) {
                    address = data.username;
                }
            }

            if (!address) {
                let err = new Error('Address not set');
                err.responseCode = 400;
                err.code = 'AddressNotSet';
                throw err;
            }
        }

        let allowedScopes = [...consts.SCOPES];
        let disabledScopes = data.disabledScopes || [];

        if (disabledScopes.length) {
            disabledScopes.forEach(scope => {
                if (allowedScopes.includes(scope)) {
                    userData.disabledScopes = userData.disabledScopes || [];
                    userData.disabledScopes.push(scope);
                }
            });
        }

        let addrview;
        if (address) {
            addrview = tools.normalizeAddress(address, false, {
                removeLabel: true,
                removeDots: true
            });

            let existingAddressData;
            try {
                existingAddressData = await this.users.collection('addresses').findOne(
                    {
                        addrview
                    },
                    {
                        projection: { _id: true },
                        maxTimeMS: consts.DB_MAX_TIME_USERS
                    }
                );
            } catch (err) {
                log.error('DB', 'CREATEFAIL username=%s error=%s', userData.username, err.message);
                err.responseCode = 500;
                err.code = 'InternalDatabaseError';
                throw err;
            }

            if (existingAddressData) {
                let err = new Error(`Email address "${data.address}" already exists`);
                err.responseCode = 400;
                err.code = 'AddressExistsError';
                throw err;
            }
        }

        let spamLevel = 'spamLevel' in data ? Number(data.spamLevel) || 0 : 50;
        if (spamLevel < 0) {
            spamLevel = 0;
        }
        if (spamLevel > 100) {
            spamLevel = 100;
        }
        userData.spamLevel = spamLevel;

        // Insert user data - blockchain authentication enabled
        userData.activated = false;
        userData.disabled = data.disabled || false;
        userData.suspended = data.suspended || false;

        if (data.metaData) {
            userData.metaData = tools.formatMetaData(data.metaData);
        }

        if (data.internalData) {
            userData.internalData = tools.formatMetaData(data.internalData);
        }

        // Insert blockchain authentication configuration
        if (data.blockchainAuth) {
            userData.blockchainAuth = {
                type: data.blockchainAuth.type,
                address: data.blockchainAuth.address,
                lastAuth: null,
                lastNonce: null
            };
        }

        userData.sess = 0;
        userData.sessStorage = {};
        userData.encryptMessages = true;
        userData.encryptForwarded = false;
        userData.encryptDrafts = false;
        userData.pubKey = '';
        userData.spamLevel = spamLevel;

        if (data.fromWhitelist && data.fromWhitelist.length) {
            userData.fromWhitelist = data.fromWhitelist;
        }

        let r;
        try {
            r = await this.users.collection('users').insertOne(userData);
        } catch (err) {
            log.error('DB', 'CREATEFAIL username=%s error=%s', userData.username, err.message);

            if (r && r.insertedId) {
                try {
                    await this.users.collection('users').deleteOne({ _id: r.insertedId });
                } catch (cleanupErr) {
                    // ignore cleanup errors
                }
            }

            switch (err.code) {
                case 11000:
                    err.responseCode = 400;
                    err.code = 'UserExistsError';
                    err.message = `Username "${data.username}" already exists`;
                    break;
            }

            err.responseCode = err.responseCode || 500;
            err.code = err.code || 'InternalDatabaseError';

            throw err;
        }

        let mailboxes = this.getMailboxes(userData.language, data.mailboxes).map((mailbox) => {
            mailbox.user = r.insertedId;

            if (['\\Trash', '\\Junk'].includes(mailbox.specialUse)) {
                mailbox.subscribed = false;
            }

            mailbox.modifyIndex = 0;
            mailbox.uidValidity = Math.floor(Date.now() / 1000);
            mailbox.uidNext = 1;
            mailbox.subscribed = mailbox.subscribed !== false;

            return mailbox;
        });

        try {
            if (mailboxes.length) {
                await this.database.collection('mailboxes').insertMany(mailboxes);
            }
        } catch (err) {
            // try to rollback
            await this.users.collection('users').deleteOne({ _id: r.insertedId });

            log.error('DB', 'CREATEFAIL username=%s error=%s', userData.username, err.message);
            err.responseCode = 500;
            err.code = 'InternalDatabaseError';
            throw err;
        }

        // Create address record for the user
        if (!data.emptyAddress) {
            let addressData = {
                user: r.insertedId,
                address,
                addrview,
                created: new Date()
            };

            if (data.tags && data.tags.length && data.addTagsToAddress) {
                addressData.tags = userData.tags;
                addressData.tagsview = userData.tagsview;
            }

            try {
                await this.users.collection('addresses').insertOne(addressData);
            } catch (err) {
                // try to rollback
                await this.users.collection('users').deleteOne({ _id: r.insertedId });
                await this.database.collection('mailboxes').deleteMany({ user: r.insertedId });

                log.error('DB', 'CREATEFAIL username=%s error=%s', userData.username, err.message);

                switch (err.code) {
                    case 11000:
                        err.responseCode = 400;
                        err.code = 'AddressExistsError';
                        err.message = `Email address "${data.address}" already exists`;
                        break;
                    default:
                        err.responseCode = 500;
                        err.code = 'InternalDatabaseError';
                        break;
                }

                throw err;
            }
        }

        if (this.messageHandler && !data.emptyAddress) {
            try {
                await this.messageHandler.updateUser(r.insertedId);
            } catch (err) {
                log.error('DB', 'UPDATEUSER id=%s error=%s', r.insertedId, err.message);
            }
        }

        if (data.featureFlags && Object.keys(data.featureFlags).length) {
            for (let featureFlag of Object.keys(data.featureFlags)) {
                if (data.featureFlags[featureFlag]) {
                    let res = await this.users.collection('users').updateOne(
                        { _id: r.insertedId },
                        { $inc: { [`featureFlags.${featureFlag}`]: 1 } }
                    );
                    if (res) {
                        // nothing
                    }
                }
            }
        }

        try {
            await publish(this.database, USER_CREATED, {
                user: r.insertedId,
                username: userData.username,
                address: userData.address
            });
        } catch (err) {
            log.error('Events', 'Failed to publish user creation event: %s', err.message);
        }

        return r.insertedId;
    }


    async update(user, data) {
        let $set = {};
        let $push = {};
        let $unset = {};

        let updates = false;

        let flushKeys = [];
        let flushHKeys = [];

        // if some of the counter keys are modified, then reset the according value in Redis
        let resetKeys = new Map([
            ['recipients', 'wdr'],
            ['forwards', 'wdf'],
            ['imapMaxConnections', 'imc'],
            ['imapMaxUpload', 'iup'],
            ['imapMaxDownload', 'idw'],
            ['popMaxDownload', 'pdw'],
            ['receivedMax', 'rl:rcpt']
        ]);

        Object.keys(data).forEach(key => {
            if (['user', 'ip', 'sess'].includes(key)) {
                return;
            }

            if (resetKeys.has(key)) {
                flushKeys.push(resetKeys.get(key) + ':' + user);
            }

            if (key === 'imapMaxConnections') {
                flushHKeys.push({ key: 'lim:imap', value: user.toString() });
            }

            if (key === 'suspended' && data.suspended) {
                $set.suspended = true;
            }


            if (key === 'spamLevel') {
                let spamLevel = Number(data.spamLevel) || 0;

                if (spamLevel < 0) {
                    spamLevel = 0;
                }
                if (spamLevel > 100) {
                    spamLevel = 100;
                }

                $set.spamLevel = spamLevel;
                updates = true;
                return;
            }

            if (key === 'disabledScopes') {
                let allowedScopes = [...consts.SCOPES];
                let disabledScopes = [];

                [].concat(data.disabledScopes || []).forEach(scope => {
                    if (allowedScopes.includes(scope)) {
                        disabledScopes.push(scope);
                    }
                });

                if (disabledScopes.length) {
                    $set.disabledScopes = disabledScopes;
                } else {
                    $unset.disabledScopes = true;
                }
                updates = true;
                return;
            }

            if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
                $set[key] = data[key];
                updates = true;
            }
        });

        if ($set.username) {
            $set.unameview = tools.uview($set.username);
        }

        if (!updates) {
            let err = new Error('Nothing was updated');
            err.responseCode = 400;
            err.code = 'NoUpdates';
            throw err;
        }

        let userData;
        try {
            userData = await this.users.collection('users').findOne(
                { _id: user },
                {
                    projection: {
                        username: true,
                        disabled: true,
                        suspended: true
                    },
                    maxTimeMS: consts.DB_MAX_TIME_USERS
                }
            );
        } catch (err) {
            err.responseCode = 500;
            err.code = 'InternalDatabaseError';
            throw err;
        }

        if (!userData) {
            let err = new Error('This user does not exist');
            err.responseCode = 404;
            err.code = 'UserNotFound';
            throw err;
        }


        let updateQuery = {};

        if (Object.keys($set).length) {
            updateQuery.$set = $set;
        }

        if (Object.keys($push).length) {
            updateQuery.$push = $push;
        }

        if (Object.keys($unset).length) {
            updateQuery.$unset = $unset;
        }

        if (data.featureFlags && Object.keys(data.featureFlags).length) {
            for (let featureFlag of Object.keys(data.featureFlags)) {
                try {
                    if (data.featureFlags[featureFlag]) {
                        let res = await this.users.collection('users').updateOne(
                            { _id: user },
                            { $inc: { [`featureFlags.${featureFlag}`]: 1 } }
                        );
                        if (res) {
                            switch (featureFlag) {
                                // Add any specific feature flag handling here
                                default:
                                    // No special handling for this feature flag
                                    break;
                            }
                        }
                    }
                } catch (err) {
                    log.error('DB', 'UPDATEFAIL id=%s error=%s', user, err.message);
                }
            }
        }

        let result;
        try {
            result = await this.users.collection('users').findOneAndUpdate({ _id: user }, updateQuery, {
                returnDocument: 'after',
                maxTimeMS: consts.DB_MAX_TIME_USERS
            });
        } catch (err) {
            log.error('DB', 'UPDATEFAIL id=%s error=%s', user, err.message);
            err.responseCode = 500;
            err.code = 'InternalDatabaseError';
            throw err;
        }

        if (!result || !result.value) {
            let err = new Error('User was not found');
            err.responseCode = 404;
            err.code = 'UserNotFound';
            throw err;
        }

        if (flushKeys.length || flushHKeys.length) {
            try {
                let flushreq = this.redis.multi();

                flushKeys.forEach(key => {
                    flushreq = flushreq.del(key);
                });

                flushHKeys.forEach(entry => {
                    flushreq = flushreq.hdel(entry.key, entry.value);
                });

                await flushreq.exec();
            } catch (err) {
                // ignore
            }
        }

        // check if we need to reset any ttl counters
        if (result.value && result.value.username !== userData.username) {
            try {
                await this.flushUserCache(user);
            } catch (err) {
                log.error('DB', 'UPDATEFAIL id=%s error=%s', user, err.message);
            }
        }

        return { success: true };
    }

    getMailboxes(language, defaults) {
        defaults = defaults || {};

        let defaultMailboxes = [
            {
                path: 'INBOX',
                specialUse: '\\Inbox',
                type: 'Inbox',
                noInferiors: false,
                subscribed: true,
                name: defaults.name || ((mailboxTranslations.names[language] && mailboxTranslations.names[language].INBOX) || 'Inbox')
            },
            {
                path: 'Sent Mail',
                specialUse: '\\Sent',
                type: 'Sent',
                noInferiors: false,
                subscribed: true,
                name: defaults.sent || ((mailboxTranslations.names[language] && mailboxTranslations.names[language].SENT) || 'Sent Mail')
            },
            {
                path: 'Trash',
                specialUse: '\\Trash',
                type: 'Trash',
                noInferiors: false,
                subscribed: true,
                name: defaults.trash || ((mailboxTranslations.names[language] && mailboxTranslations.names[language].TRASH) || 'Trash')
            },
            {
                path: 'Drafts',
                specialUse: '\\Drafts',
                type: 'Drafts',
                noInferiors: false,
                subscribed: true,
                name: defaults.drafts || ((mailboxTranslations.names[language] && mailboxTranslations.names[language].DRAFTS) || 'Drafts')
            },
            {
                path: 'Junk',
                specialUse: '\\Junk',
                type: 'Junk',
                noInferiors: false,
                subscribed: false,
                name: defaults.junk || ((mailboxTranslations.names[language] && mailboxTranslations.names[language].JUNK) || 'Junk')
            }
        ];

        return defaultMailboxes;
    }

    async logAuthEvent(user, entry) {
        // only log auth events if authlogTime is set in settings
        let authlogTime = await this.settingsHandler.get('const:authlog:time');
        if (!user || !tools.isId(user) || !authlogTime) {
            return false;
        }

        // structure log entry
        let logEntry = {
            _id: new ObjectId(),
            user,
            action: entry.action,
            result: entry.result,
            sess: entry.sess,
            ip: entry.ip,
            created: new Date(),
            expires: new Date(Date.now() + authlogTime)
        };

        Object.keys(entry || {}).forEach(key => {
            if (!['action', 'result', 'sess', 'ip'].includes(key) && typeof entry[key] === 'string') {
                logEntry[key] = entry[key];
            }
        });

        if (this.loggelf && typeof this.loggelf === 'function') {
            this.loggelf({
                short_message: '[AUTHLOG]',
                _component: 'auth-server',
                _user: user,
                _sess: entry.sess,
                _ip: entry.ip,
                _action: entry.action,
                _result: entry.result,
                _message: entry._message,
                _scope: entry._scope,
                _protocol: entry._protocol
            });
        }

        try {
            let r = await this.users.collection('authlog').insertOne(logEntry);
            return r.insertedId;
        } catch (err) {
            log.error('DB', 'AUTHLOGFAIL user=%s error=%s', user, err.message);
        }

        return false;
    }

    async logout(user, reason) { // eslint-disable-line no-unused-vars
        // reason parameter available but not currently used

        let userData;
        try {
            userData = await this.users.collection('users').findOne(
                { _id: user },
                {
                    projection: { _id: true, sess: true, username: true },
                    maxTimeMS: consts.DB_MAX_TIME_USERS
                }
            );
        } catch (err) {
            err.responseCode = 500;
            err.code = 'InternalDatabaseError';
            throw err;
        }

        if (!userData) {
            let err = new Error('User not found');
            err.responseCode = 404;
            err.code = 'UserNotFound';
            throw err;
        }

        if (!this.messageHandler || !this.messageHandler.notifier) {
            return false;
        }

        this.messageHandler.notifier.fire(userData._id, false);

        return false;
    }

    async delete(user, options) {
        options = options || {};

        let userQuery = user;
        if (typeof userQuery === 'string') {
            userQuery = new ObjectId(userQuery);
        }

        let existingAccount = await this.users.collection('users').findOne({ _id: userQuery }, { maxTimeMS: consts.DB_MAX_TIME_USERS });

        if (!existingAccount) {
            let err = new Error('User not found');
            err.responseCode = 404;
            err.code = 'UserNotFound';
            throw err;
        }

        let existingDeleted = await this.database.collection('deleted').findOne({ user: userQuery }, { maxTimeMS: consts.DB_MAX_TIME_USERS });

        if (existingDeleted) {
            // delete operation already initiated
            let err = new Error('User is already being deleted');
            err.responseCode = 400;
            err.code = 'UserDeleteStarted';
            throw err;
        } else {
            // initiate user deletion
            let r = await this.database.collection('deleted').insertOne({
                user: userQuery,
                task: 'user-delete',
                created: new Date()
            });

            if (r.insertedId) {
                log.info('API', 'User %s marked for deletion', userQuery);
            }

            if (existingAccount.featureFlags && Object.keys(existingAccount.featureFlags).length) {
                // decrement counters for enabled feature flags
                for (let featureFlag of Object.keys(existingAccount.featureFlags)) {
                    if (existingAccount.featureFlags[featureFlag]) {
                        let res = await this.users.collection('users').updateOne(
                            { _id: userQuery },
                            { $inc: { [`featureFlags.${featureFlag}`]: -1 } }
                        );
                        if (res) {
                            // nothing
                        }
                    }
                }
            }

            try {
                await publish(this.database, USER_DELETE_STARTED, {
                    user: userQuery
                });
            } catch (err) {
                log.error('Events', 'Failed to publish user deletion start event: %s', err.message);
            }
        }

        let existstingTask = await this.taskHandler.ensure('user-delete', { user: userQuery });
        if (existstingTask) {
            if (existstingTask.locked && existstingTask.status === 'delayed') {
                // delete the task and create a new unlocked one
                await this.taskHandler.clearLock(existstingTask._id);
            }

            return { task: existstingTask._id, deleted: false, user: userQuery };
        }

        let task = await this.taskHandler.add('user-delete', { user: userQuery, options });

        if (task) {
            let r = await this.taskHandler.getTask(task);
            if (r && r.value) {
                return { task: r.value._id, deleted: false, user: userQuery };
            }
        }

        return { task: false, deleted: false, user: userQuery };
    }

    async restoreInfo(user) {
        let userQuery = user;
        if (typeof userQuery === 'string') {
            userQuery = new ObjectId(userQuery);
        }

        let existingAccount = await this.database.collection('deleted').findOne({ user: userQuery }, { maxTimeMS: consts.DB_MAX_TIME_USERS });

        if (!existingAccount) {
            let err = new Error('User backup not found');
            err.responseCode = 404;
            err.code = 'UserRestoreNotFound';
            throw err;
        }

        let storageUsed = 0;
        let messages = 0;
        let addresses = [];

        for (let address of existingAccount.deleteInfo.addresses || []) {
            let existingAddress = await this.users.collection('addresses').findOne({ _id: address._id }, { maxTimeMS: consts.DB_MAX_TIME_USERS });
            if (!existingAddress || existingAddress.user.equals(user)) {
                addresses.push(address.address);
            }
        }

        return { user, storageUsed, messages, addresses };
    }

    async restore(user, options) {
        options = options || {};

        let userQuery = user;
        if (typeof userQuery === 'string') {
            userQuery = new ObjectId(userQuery);
        }

        let existstingTask = await this.taskHandler.ensure('user-restore', { user: userQuery });

        if (existstingTask) {
            if (existstingTask.status !== 'delayed') {
                return { task: existstingTask._id, restored: false, user: userQuery };
            }

            // delete the task and create a new unlocked one
            await this.taskHandler.clearLock(existstingTask._id);

            let delRes = await this.taskHandler.delete(existstingTask._id);
            if (!delRes.deletedCount) {
                return { task: existstingTask._id, restored: false, user: userQuery };
            }
        }

        let existingAccount = await this.database.collection('deleted').findOne({ user: userQuery }, { maxTimeMS: consts.DB_MAX_TIME_USERS });

        if (!existingAccount) {
            let err = new Error('User backup not found');
            err.responseCode = 404;
            err.code = 'UserRestoreNotFound';
            throw err;
        }

        let accountDeleted = existingAccount.deleteInfo;

        try {
            let r = await this.users.collection('users').insertOne(accountDeleted);
            if (r.insertedId) {
                // success!
            }
        } catch (err) {
            if (err.code === 11000) {
                let err = new Error(`Username "${accountDeleted.username}" already exists`);
                err.responseCode = 400;
                err.code = 'UserExistsError';
                throw err;
            }
            throw err;
        }

        let recoveredAddresses = [];
        for (let address of accountDeleted.addresses || []) {
            try {
                let r = await this.users.collection('addresses').insertOne(address);
                if (!r || !r.insertedId) {
                    // should not happen
                    log.error('DB', 'RESTOREFAIL Failed to insert address id=%s user=%s', address._id, userQuery);
                } else {
                    recoveredAddresses.push(address.address);
                }
            } catch (err) {
                log.error('DB', 'RESTOREFAIL Failed to restore address=%s error=%s', address.address, err.message);
            }
        }

        let mainAddress = recoveredAddresses.find(address => address === accountDeleted.address);
        if (!mainAddress && recoveredAddresses.length) {
            mainAddress = recoveredAddresses[0];
        }

        if (mainAddress) {
            await this.users.collection('users').updateOne({ _id: userQuery }, { $set: { address: mainAddress } });
        }

        let task = await this.taskHandler.add('user-restore', { user: userQuery, options });

        await this.database.collection('deleted').deleteOne({ user: userQuery });

        try {
            await publish(this.database, USER_DELETE_CANCELLED, {
                user: userQuery
            });
        } catch (err) {
            log.error('Events', 'Failed to publish user deletion cancel event: %s', err.message);
        }

        return { task, restored: true, user: userQuery };
    }

    async pushDefaultMessages(userData, tags) { // eslint-disable-line no-unused-vars
        // tags parameter available but not currently used
        let messages = config.defaultMessages;
        if (!messages || !messages.length) {
            return false;
        }

        for (let data of messages) {
            let messageData = {
                from: {
                    name: config.api.name || 'WildDuck API',
                    address: config.api.emailAddress || (userData.username + '@' + config.emailDomain)
                },
                to: userData.address,
                subject: data.subject || 'Welcome!',
                text: data.text,
                html: data.html,
                date: data.date || new Date(),
                mailbox: data.mailbox || 'INBOX'
            };

            if (['sent', 'trash', 'junk', 'drafts', 'archive'].includes((data.mailbox || '').toString().toLowerCase())) {
                messageData.mailbox = data.mailbox;
            }

            if (data.seen) {
                messageData.flags = ['\\Seen'];
            }
            if (data.flag) {
                messageData.flags = (messageData.flags || []).concat('\\Flagged');
            }

            if (userData.encryptMessages) {
                messageData.encryptionKeys = [userData.pubKey];
            }

            await this.messageHandler.encryptMessage(userData.encryptMessages ? userData.pubKey : false, messageData);

            await this.messageHandler.add(messageData);
        }

        return true;
    }

    async checkAddress(username) {
        if (username.indexOf('@') < 0) {
            return {
                username,
                domain: config.emailDomain || 'localhost',
                address: username + '@' + (config.emailDomain || 'localhost')
            };
        }

        let domain = username.substr(username.indexOf('@') + 1);
        username = username.substr(0, username.indexOf('@'));

        let addressData = await this.users.collection('addresses').findOne(
            {
                address: username + '@' + domain
            },
            { maxTimeMS: consts.DB_MAX_TIME_USERS }
        );

        if (addressData && !addressData.user) {
            return false;
        }

        if (!addressData) {
            return false;
        }

        return {
            username,
            domain,
            address: username + '@' + domain
        };
    }

    async setAuthToken(user, accessToken) {
        if (!accessToken) {
            let err = new Error('Invalid access token provided');
            err.responseCode = 400;
            err.code = 'InvalidAccessToken';
            throw err;
        }

        user = new ObjectId(user);

        let userData = await this.users.collection('users').findOne(
            { _id: user },
            {
                projection: {
                    _id: true,
                    username: true,
                    authVersion: true
                },
                maxTimeMS: consts.DB_MAX_TIME_USERS
            }
        );

        if (!userData) {
            let err = new Error('User not found');
            err.responseCode = 404;
            err.code = 'UserNotFound';
            throw err;
        }

        let authVersion = userData.authVersion || 0;
        let key = 'tn:token:' + accessToken;
        let ttl = config.api.accessControl.tokenTTL || 3600;

        let tokenData = {
            user: user.toString(),
            role: 'user',
            created: Date.now(),
            ttl,
            authVersion,
            // signature
            s: crypto
                .createHmac('sha256', config.api.accessControl.secret)
                .update(
                    JSON.stringify({
                        token: accessToken,
                        user: user.toString(),
                        authVersion,
                        role: 'user'
                    })
                )
                .digest('hex')
        };

        await this.redis.multi().hmset(key, tokenData).expire(key, ttl).exec();

        return accessToken;
    }

    async generateAuthToken(user) {
        let accessToken = crypto.randomBytes(20).toString('hex');
        return await this.setAuthToken(user, accessToken);
    }
}

function rateLimitResponse(res) {
    let err = new Error('Authentication was rate limited');
    err.response = 'NO';
    err.responseCode = 403;
    err.ttl = res.ttl;
    err.code = 'RateLimitedError';
    err.responseMessage = `Authentication was rate limited. Try again in ${tools.roundTime(res.ttl)}.`;
    return err;
}


module.exports = UserHandler;