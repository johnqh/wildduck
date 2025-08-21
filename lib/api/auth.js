'use strict';

const Joi = require('joi');
const ObjectId = require('mongodb').ObjectId;
const tools = require('../tools');
const roles = require('../roles');
const { nextPageCursorSchema, previousPageCursorSchema, sessSchema, sessIPSchema, booleanSchema, usernameSchema } = require('../schemas');
const { successRes } = require('../schemas/response/general-schemas');
const { userId } = require('../schemas/request/general-schemas');
const { mongopagingFindWrapper } = require('../mongopaging-find-wrapper');
const { sendErrorResponse, createErrorResponse, getErrorStatusCode } = require('./error-utils');

module.exports = (db, server, userHandler) => {
    server.post(
        {
            path: '/preauth',
            summary: 'Pre-auth check',
            name: 'preauth',
            description: 'Check if a username exists and can be used for blockchain authentication',
            tags: ['Authentication'],
            validationObjs: {
                requestBody: {
                    username: Joi.alternatives()
                        .try(usernameSchema, Joi.string().email({ tlds: false }))
                        .required()
                        .description('Username, blockchain address, ENS/SNS name, or email address'),

                    scope: Joi.string().default('master').description('Required scope. One of master, imap, smtp, pop3'),

                    sess: sessSchema,
                    ip: sessIPSchema
                },
                queryParams: {},
                pathParams: {},
                response: {
                    200: {
                        description: 'Success',
                        model: Joi.object({
                            success: successRes,
                            id: userId,
                            username: Joi.string().required().description('Username of authenticated User'),
                            address: Joi.string().required().description('Default email address of authenticated User'),
                            scope: Joi.string().required().description('The scope this authentication is valid for')
                        }).$_setFlag('objectName', 'PreAuthCheckResponse')
                    }
                }
            }
        },
        tools.responseWrapper(async (req, res) => {
            res.charSet('utf-8');

            const { requestBody, pathParams, queryParams } = req.route.spec.validationObjs;

            const schema = Joi.object({
                ...requestBody,
                ...pathParams,
                ...queryParams
            });

            const result = schema.validate(req.params, {
                abortEarly: false,
                convert: true
            });

            if (result.error) {
                res.status(400);
                return res.json({
                    error: result.error.message,
                    code: 'InputValidationError',
                    details: tools.validationErrors(result)
                });
            }

            let permission = roles.can(req.role).createAny('authentication');

            // permissions check
            req.validate(permission);

            // filter out unallowed fields
            result.value = permission.filter(result.value);

            let authData, user;

            try {
                [authData, user] = await userHandler.preAuth(result.value.username, result.value.scope);
            } catch (err) {
                const additionalInfo = user ? { id: user.toString() } : {};
                return sendErrorResponse(res, err, additionalInfo);
            }

            if (!authData) {
                const error = new Error('Pre-authentication failed');
                error.code = 'PreAuthFailed';
                const additionalInfo = user ? { id: user.toString() } : {};
                return sendErrorResponse(res, error, additionalInfo);
            }

            let preAuthResponse = {
                success: true,
                id: authData.user.toString(),
                username: authData.username,
                address: authData.address,
                scope: authData.scope
            };

            res.status(200);
            return res.json(permission.filter(preAuthResponse));
        })
    );

    server.post(
        {
            path: '/authenticate',
            summary: 'Authenticate a User with blockchain signature',
            name: 'authenticate',
            tags: ['Authentication'],
            validationObjs: {
                requestBody: {
                    username: Joi.alternatives()
                        .try(usernameSchema, Joi.string().email({ tlds: false }))
                        .required()
                        .description('Username, blockchain address, ENS/SNS name, or email address'),
                    
                    signature: Joi.string().required().description('Blockchain signature for authentication'),
                    nonce: Joi.string().required().description('Unique nonce to prevent replay attacks'),
                    signerAddress: Joi.string().optional().description('Signer address for ENS/SNS names'),

                    protocol: Joi.string().default('API').description('Application identifier for security logs'),
                    scope: Joi.string()
                        .default('master')
                        // token can be true only if scope is master
                        .when('token', { is: true, then: Joi.valid('master') })
                        .description('Required scope. One of master, imap, smtp, pop3'),

                    appId: Joi.string().empty('').uri().description('Optional appId which is the URL of the app'),

                    token: booleanSchema
                        .default(false)
                        .description(
                            'If true then generates a temporary access token that is valid for this user. Only available if scope is "master". When using user tokens then you can replace user ID in URLs with "me".'
                        ),

                    sess: sessSchema,
                    ip: sessIPSchema
                },
                queryParams: {},
                pathParams: {},
                response: {
                    200: {
                        description: 'Success',
                        model: Joi.object({
                            success: successRes,
                            id: userId,
                            username: Joi.string().required().description('Username of authenticated User'),
                            address: Joi.string().required().description('Default email address of authenticated User'),
                            scope: Joi.string().required().description('The scope this authentication is valid for'),
                            token: Joi.string().description(
                                'If access token was requested then this is the value to use as access token when making API requests on behalf of logged in user.'
                            )
                        }).$_setFlag('objectName', 'AuthenticateResponse')
                    }
                }
            }
        },
        tools.responseWrapper(async (req, res) => {
            res.charSet('utf-8');

            const { requestBody, pathParams, queryParams } = req.route.spec.validationObjs;

            const schema = Joi.object({
                ...requestBody,
                ...pathParams,
                ...queryParams
            });

            const result = schema.validate(req.params, {
                abortEarly: false,
                convert: true
            });

            if (result.error) {
                res.status(400);
                return res.json({
                    error: result.error.message,
                    code: 'InputValidationError',
                    details: tools.validationErrors(result)
                });
            }

            let permission = roles.can(req.role).createAny('authentication');

            // permissions check
            req.validate(permission);

            // filter out unallowed fields
            result.value = permission.filter(result.value);

            let meta = {
                protocol: result.value.protocol,
                sess: result.value.sess,
                ip: result.value.ip,
                signature: result.value.signature,
                nonce: result.value.nonce,
                signerAddress: result.value.signerAddress
            };

            if (result.value.appId) {
                meta.appId = result.value.appId;
            }

            let authData, user;

            try {
                // Use blockchain signature authentication
                [authData, user] = await userHandler.asyncAuthenticate(
                    result.value.username, 
                    result.value.signature, 
                    result.value.scope, 
                    meta
                );
            } catch (err) {
                const additionalInfo = user ? { id: user.toString() } : {};
                return sendErrorResponse(res, err, additionalInfo);
            }

            if (!authData) {
                const error = new Error('Authentication failed');
                error.code = 'AuthFailed';
                const additionalInfo = user ? { id: user.toString() } : {};
                return sendErrorResponse(res, error, additionalInfo);
            }

            let authResponse = {
                success: true,
                id: authData.user.toString(),
                username: authData.username,
                address: authData.address,
                scope: authData.scope
            };

            if (result.value.token) {
                try {
                    authResponse.token = await userHandler.generateAuthToken(authData.user);
                } catch (err) {
                    err.code = err.code || 'TokenGenerationFailed';
                    return sendErrorResponse(res, err, { id: user.toString() });
                }
            }

            res.status(200);
            return res.json(permission.filter(authResponse));
        })
    );

    server.del(
        {
            path: '/authenticate',
            summary: 'Invalidate authentication token',
            name: 'invalidateAccessToken',
            description: 'This method invalidates currently used authentication token. If token is not provided then nothing happens',
            tags: ['Authentication'],
            validationObjs: {
                requestBody: {},
                pathParams: {},
                queryParams: {},
                response: {
                    200: {
                        description: 'Success',
                        model: Joi.object({ success: successRes }).$_setFlag('objectName', 'SuccessResponse')
                    }
                }
            }
        },
        tools.responseWrapper(async (req, res) => {
            res.charSet('utf-8');

            if (req.accessToken) {
                try {
                    await db.redis
                        .multi()
                        .del('tn:token:' + req.accessToken.hash)
                        .exec();
                } catch (err) {
                    // ignore
                }
            }

            return res.json({ success: true });
        })
    );

    server.get(
        {
            name: 'getAuthlog',
            path: '/users/:user/authlog',
            summary: 'List authentication Events',
            tags: ['Authentication'],
            validationObjs: {
                requestBody: {},
                pathParams: { user: userId },
                queryParams: {
                    action: Joi.string().trim().lowercase().empty('').max(100).description('Limit listing only to values with specific action value'),
                    limit: Joi.number().default(20).min(1).max(250).description('How many records to return'),
                    next: nextPageCursorSchema,
                    previous: previousPageCursorSchema,
                    filterip: sessIPSchema.description('Limit listing only to values with specific IP address'),

                    sess: sessSchema,
                    ip: sessIPSchema
                },
                response: {
                    200: {
                        description: 'Success',
                        model: Joi.object({
                            success: successRes,
                            action: Joi.string().required().description('Limit listing only to values with specific action value'),
                            total: Joi.number().required().description('How many results were found'),
                            page: Joi.number().required().description('Current page number. Derived from page query argument'),
                            previousCursor: previousPageCursorSchema,
                            nextCursor: nextPageCursorSchema,
                            results: Joi.array()
                                .items(
                                    Joi.object({
                                        id: Joi.string().required().description('ID of the event'),
                                        action: Joi.string().required().description('Action identifier'),
                                        result: Joi.string().required().description('Did the action succeed'),
                                        sess: sessSchema,
                                        ip: sessIPSchema,
                                        created: Joi.date().required().description('Datestring of the Event time'),
                                        protocol: Joi.string().description('Protocol that the authentication was made from'),
                                        requiredScope: Joi.string().description('Scope of the auth'),
                                        last: Joi.date().required().description('Date of the last update of data'),
                                        events: Joi.number().required().description('Number of times same auth log has occurred'),
                                        source: Joi.string().description('Source of auth. Example: `blockchain` if signature auth was used'),
                                        expires: Joi.date()
                                            .required()
                                            .description(
                                                'After this date the given auth log document will not be updated and instead a new one will be created'
                                            )
                                    }).$_setFlag('objectName', 'GetAuthlogResult')
                                )
                                .required()
                        }).$_setFlag('objectName', 'GetAuthlogResponse')
                    }
                }
            }
        },
        tools.responseWrapper(async (req, res) => {
            res.charSet('utf-8');

            const { requestBody, pathParams, queryParams } = req.route.spec.validationObjs;

            const schema = Joi.object({
                ...requestBody,
                ...pathParams,
                ...queryParams
            });

            const result = schema.validate(req.params, {
                abortEarly: false,
                convert: true,
                allowUnknown: false
            });

            if (result.error) {
                res.status(400);
                return res.json({
                    error: result.error.message,
                    code: 'InputValidationError',
                    details: tools.validationErrors(result)
                });
            }

            // permissions check
            if (req.user && req.user === result.value.user) {
                req.validate(roles.can(req.role).readOwn('authentication'));
            } else {
                req.validate(roles.can(req.role).readAny('authentication'));
            }

            let user = new ObjectId(result.value.user);
            let limit = result.value.limit;

            let action = result.value.action;
            let ip = result.value.filterIp;

            let pageNext = result.value.next;
            let pagePrevious = result.value.previous;

            let userData;
            try {
                userData = await db.users.collection('users').findOne(
                    {
                        _id: user
                    },
                    {
                        projection: {
                            _id: true
                        }
                    }
                );
            } catch (err) {
                res.status(500);
                return res.json({
                    error: 'MongoDB Error: ' + err.message,
                    code: 'InternalDatabaseError'
                });
            }

            if (!userData) {
                res.status(404);
                return res.json({
                    error: 'This user does not exist',
                    code: 'UserNotFound'
                });
            }

            let filter = { user };
            if (ip) {
                filter.ip = ip;
            }

            let total = await db.users.collection('authlog').countDocuments(filter);

            let opts = {
                limit,
                query: filter,
                sortAscending: false
            };

            if (pageNext) {
                opts.next = pageNext;
            }
            if (pagePrevious) {
                opts.previous = pagePrevious;
            }

            let listingWrapper;
            try {
                listingWrapper = await mongopagingFindWrapper(db.users.collection('authlog'), opts);
            } catch (err) {
                res.status(500);
                return res.json({
                    error: 'MongoDB Error: ' + err.message,
                    code: 'InternalDatabaseError'
                });
            }

            let response = {
                success: true,
                action,
                total,
                page: listingWrapper.page,
                previousCursor: listingWrapper.previousCursor,
                nextCursor: listingWrapper.nextCursor,
                results: (listingWrapper.listing.results || []).map(resultData => {
                    let response = {
                        id: (resultData._id || '').toString()
                    };
                    Object.keys(resultData).forEach(key => {
                        if (!['_id', 'user'].includes(key)) {
                            response[key] = resultData[key];
                        }
                    });
                    return response;
                })
            };

            return res.json(response);
        })
    );

    server.get(
        {
            path: '/users/:user/authlog/:event',
            name: 'getAuthlogEvent',
            summary: 'Request Event information',
            tags: ['Authentication'],
            validationObjs: {
                requestBody: {},
                queryParams: {
                    sess: sessSchema,
                    ip: sessIPSchema
                },
                pathParams: {
                    user: userId,
                    event: Joi.string().hex().lowercase().length(24).required().description('ID of the Event')
                },
                response: {
                    200: {
                        description: 'Success',
                        model: Joi.object({
                            id: Joi.string().required().description('ID of the event'),
                            action: Joi.string().required().description('Action identifier'),
                            result: Joi.string().required().description('Did the action succeed'),
                            sess: sessSchema,
                            ip: sessIPSchema,
                            created: Joi.date().required().description('Datestring of the Event time'),
                            protocol: Joi.string().description('Protocol that the authentication was made from'),
                            requiredScope: Joi.string().description('Scope of the auth'),
                            last: Joi.date().required().description('Date of the last update of Event'),
                            events: Joi.number().required().description('Number of times same auth Event has occurred'),
                            source: Joi.string().description('Source of auth. Example: `blockchain` if signature auth was used'),
                            expires: Joi.date()
                                .required()
                                .description('After this date the given auth Event will not be updated and instead a new one will be created')
                        }).$_setFlag('objectName', 'GetAuthlogEventResponse')
                    }
                }
            }
        },
        tools.responseWrapper(async (req, res) => {
            res.charSet('utf-8');

            const { requestBody, pathParams, queryParams } = req.route.spec.validationObjs;

            const schema = Joi.object({
                ...requestBody,
                ...pathParams,
                ...queryParams
            });

            const result = schema.validate(req.params, {
                abortEarly: false,
                convert: true,
                allowUnknown: false
            });

            if (result.error) {
                res.status(400);
                return res.json({
                    error: result.error.message,
                    code: 'InputValidationError',
                    details: tools.validationErrors(result)
                });
            }

            // permissions check
            if (req.user && req.user === result.value.user) {
                req.validate(roles.can(req.role).readOwn('authentication'));
            } else {
                req.validate(roles.can(req.role).readAny('authentication'));
            }

            let user = new ObjectId(result.value.user);
            let event = new ObjectId(result.value.event);

            let userData;
            try {
                userData = await db.users.collection('users').findOne(
                    {
                        _id: user
                    },
                    {
                        projection: {
                            _id: true
                        }
                    }
                );
            } catch (err) {
                res.status(500);
                return res.json({
                    error: 'MongoDB Error: ' + err.message,
                    code: 'InternalDatabaseError'
                });
            }

            if (!userData) {
                res.status(404);
                return res.json({
                    error: 'This user does not exist',
                    code: 'UserNotFound'
                });
            }

            let filter = { _id: event, user };
            let eventData;
            try {
                eventData = await db.users.collection('authlog').findOne(filter);
            } catch (err) {
                res.status(500);
                return res.json({
                    error: 'MongoDB Error: ' + err.message,
                    code: 'InternalDatabaseError'
                });
            }

            if (!eventData) {
                res.status(404);
                return res.json({
                    error: 'Event was not found',
                    code: 'EventNotFound'
                });
            }

            let response = {
                success: true,
                id: eventData._id.toString()
            };
            Object.keys(eventData).forEach(key => {
                if (!['_id', 'user'].includes(key)) {
                    response[key] = eventData[key];
                }
            });

            return res.json(response);
        })
    );
};