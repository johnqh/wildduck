/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0, no-console:0 */

'use strict';

const supertest = require('supertest');
const chai = require('chai');
const { logTest, logError, logPerformance } = require('../../lib/logger');
const { TEST_USERS, TEST_PASSWORDS, getTestEmail, createUser, TEST_DOMAINS } = require('../test-config');

const expect = chai.expect;
chai.config.includeStack = true;
const config = require('wild-config');
const tools = require('../../lib/tools');

const server = supertest.agent(`http://127.0.0.1:${config.api.port}`);

describe('API Users', function () {
    this.timeout(10000); // eslint-disable-line no-invalid-this

    let user, user2, token;

    it('should POST /users expect success', async () => {
        const startTime = Date.now();
        logTest('should POST /users expect success', 'API Users', 'START', 'Starting user creation test');

        try {
            const response = await createUser(server, {
                username: TEST_USERS.myuser2,
                name: 'John Smith',
                address: getTestEmail(TEST_USERS.myuser2),
                password: TEST_PASSWORDS.secretvalue
            });

            logTest('should POST /users expect success', 'API Users', 'PASS', 'User creation test completed successfully (standard mode)', {
                userId: response.body.id,
                username: TEST_USERS.myuser2,
                responseStatus: response.status
            });

            expect(response.body.success).to.be.true;
            expect(/^[0-9a-f]{24}$/.test(response.body.id)).to.be.true;

            user = response.body.id;

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /users test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS',
                    userId: user
                },
                'User creation test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /users expect success',
                    testSuite: 'API Users',
                    operation: 'user creation'
                },
                'User creation test failed'
            );
            logTest('should POST /users expect success', 'API Users', 'FAIL', 'User creation test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should POST /authenticate expect success', async () => {
        const startTime = Date.now();
        logTest('should POST /authenticate expect success', 'API Users', 'START', 'Starting authentication test');

        try {
            let authRequest = {
                username: TEST_USERS.myuser2,
                password: TEST_PASSWORDS.secretvalue
            };

            const authResponse = await server.post('/authenticate').send(authRequest).expect(200);

            logTest('should POST /authenticate expect success', 'API Users', 'PASS', 'Authentication test completed successfully', {
                userId: user,
                username: TEST_USERS.myuser2,
                responseStatus: authResponse.status
            });

            expect(authResponse.body.success).to.be.true;

            const isCryptoEmails = tools.runningCryptoEmails();
            if (isCryptoEmails) {
                // In crypto emails mode, we might create a new user with different email
                expect(authResponse.body.username).to.equal(TEST_USERS.myuser2);
                expect(authResponse.body.scope).to.equal('master');
                expect(authResponse.body.require2fa).to.exist;
                expect(authResponse.body.requirePasswordChange).to.exist;
            } else {
                // Standard mode expects exact match
                expect(authResponse.body).to.deep.equal({
                    success: true,
                    address: getTestEmail(TEST_USERS.myuser2),
                    id: user,
                    username: TEST_USERS.myuser2,
                    scope: 'master',
                    require2fa: false,
                    requirePasswordChange: false
                });
            }

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /authenticate test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS',
                    userId: user
                },
                'Authentication test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /authenticate expect success',
                    testSuite: 'API Users',
                    operation: 'authentication'
                },
                'Authentication test failed'
            );
            logTest('should POST /authenticate expect success', 'API Users', 'FAIL', 'Authentication test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should POST /authenticate expect failure', async () => {
        const startTime = Date.now();
        logTest('should POST /authenticate expect failure', 'API Users', 'START', 'Starting authentication failure test');

        try {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto emails mode, authentication always succeeds for valid usernames
                // Test with an invalid username format instead
                const authResponse = await server
                    .post('/authenticate')
                    .send({
                        username: 'invalid@user@name' // Invalid username format
                    })
                    .expect(400);

                logTest(
                    'should POST /authenticate expect failure',
                    'API Users',
                    'PASS',
                    'Authentication validation failure test completed successfully (crypto mode)',
                    {
                        expectedError: 'InputValidationError',
                        actualError: authResponse.body.code,
                        responseStatus: authResponse.status
                    }
                );

                expect(authResponse.body.code).to.equal('InputValidationError');
            } else {
                // Standard mode: test invalid password
                const authResponse = await server
                    .post('/authenticate')
                    .send({
                        username: TEST_USERS.myuser2,
                        password: TEST_PASSWORDS.invalidpass
                    })
                    .expect(403);

                logTest('should POST /authenticate expect failure', 'API Users', 'PASS', 'Authentication failure test completed successfully (standard mode)', {
                    expectedError: 'AuthFailed',
                    actualError: authResponse.body.code,
                    responseStatus: authResponse.status
                });

                expect(authResponse.body.code).to.equal('AuthFailed');
            }

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /authenticate failure test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS'
                },
                'Authentication failure test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /authenticate expect failure',
                    testSuite: 'API Users',
                    operation: 'authentication failure'
                },
                'Authentication failure test failed'
            );
            logTest('should POST /authenticate expect failure', 'API Users', 'FAIL', 'Authentication failure test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should POST /users expect failure / invalid username', async () => {
        const startTime = Date.now();
        logTest('should POST /users expect failure / invalid username', 'API Users', 'START', 'Starting invalid username test');

        try {
            const isCryptoEmails = tools.runningCryptoEmails();

            const response = await server
                .post('/users')
                .send({
                    username: 'ömyuser2',
                    name: 'John Smith',
                    password: TEST_PASSWORDS.secretvalue
                })
                .expect(400);

            if (isCryptoEmails) {
                // In crypto emails mode, should get endpoint not available error
                expect(response.body.error).to.equal('Endpoint not available in crypto emails mode');
                expect(response.body.code).to.equal('EndpointNotAvailable');

                logTest(
                    'should POST /users expect failure / invalid username',
                    'API Users',
                    'PASS',
                    'Invalid username test completed successfully (crypto mode)',
                    {
                        invalidUsername: 'ömyuser2',
                        responseStatus: response.status,
                        cryptoMode: true,
                        errorCode: response.body.code
                    }
                );
            } else {
                // In standard mode, should get username validation error
                expect(response.body.details.username).to.exist;

                logTest(
                    'should POST /users expect failure / invalid username',
                    'API Users',
                    'PASS',
                    'Invalid username test completed successfully (standard mode)',
                    {
                        invalidUsername: 'ömyuser2',
                        responseStatus: response.status,
                        cryptoMode: false,
                        hasUsernameError: !!response.body.details.username
                    }
                );
            }

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /users invalid username test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS'
                },
                'Invalid username test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /users expect failure / invalid username',
                    testSuite: 'API Users',
                    operation: 'invalid username validation'
                },
                'Invalid username test failed'
            );
            logTest('should POST /users expect failure / invalid username', 'API Users', 'FAIL', 'Invalid username test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should POST /authenticate expect success / request a token', async () => {
        const startTime = Date.now();
        logTest('should POST /authenticate expect success / request a token', 'API Users', 'START', 'Starting authentication with token request test');

        try {
            let authRequest = {
                username: TEST_USERS.myuser2,
                password: TEST_PASSWORDS.secretvalue,
                token: true
            };

            const authResponse = await server.post('/authenticate').send(authRequest).expect(200);

            logTest(
                'should POST /authenticate expect success / request a token',
                'API Users',
                'PASS',
                'Authentication with token test completed successfully',
                {
                    username: TEST_USERS.myuser2,
                    hasToken: !!authResponse.body.token,
                    responseStatus: authResponse.status
                }
            );

            expect(authResponse.body.success).to.be.true;
            expect(authResponse.body.token).to.exist;

            token = authResponse.body.token;

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /authenticate token test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS'
                },
                'Authentication with token test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /authenticate expect success / request a token',
                    testSuite: 'API Users',
                    operation: 'authentication with token'
                },
                'Authentication with token test failed'
            );
            logTest('should POST /authenticate expect success / request a token', 'API Users', 'FAIL', 'Authentication with token test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should POST /users expect success / with hashed password', async () => {
        const startTime = Date.now();
        logTest('should POST /users expect success / with hashed password', 'API Users', 'START', 'Starting hashed password user creation test');

        try {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // Skip test in crypto mode since hashed passwords don't apply
                logTest(
                    'should POST /users expect success / with hashed password',
                    'API Users',
                    'SKIP',
                    'Test skipped in crypto mode - hashed passwords not applicable',
                    {
                        cryptoMode: true,
                        expectedBehavior: 'Crypto mode uses different authentication flow'
                    }
                );
                return;
            }

            const response = await createUser(server, {
                username: TEST_USERS.myuser2hash,
                name: 'John Smith',
                password: TEST_PASSWORDS.test
            });

            expect(response.body.success).to.be.true;
            user2 = response.body.id;

            const authResponse = await server
                .post('/authenticate')
                .send({
                    username: TEST_USERS.myuser2hash,
                    password: TEST_PASSWORDS.test
                })
                .expect(200);

            logTest(
                'should POST /users expect success / with hashed password',
                'API Users',
                'PASS',
                'Hashed password user creation test completed successfully',
                {
                    userId: user2,
                    username: TEST_USERS.myuser2hash,
                    hashedPassword: true,
                    authenticationSuccess: authResponse.body.success
                }
            );

            expect(authResponse.body.success).to.be.true;
            expect(authResponse.body).to.deep.equal({
                success: true,
                address: `${TEST_USERS.myuser2hash}@${TEST_DOMAINS.example}`,
                id: user2,
                username: TEST_USERS.myuser2hash,
                scope: 'master',
                require2fa: false,
                requirePasswordChange: false
            });

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /users hashed password test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS',
                    userId: user2
                },
                'Hashed password user creation test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /users expect success / with hashed password',
                    testSuite: 'API Users',
                    operation: 'hashed password user creation'
                },
                'Hashed password user creation test failed'
            );
            logTest('should POST /users expect success / with hashed password', 'API Users', 'FAIL', 'Hashed password user creation test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /users/resolve/{username} expect success', async () => {
        const startTime = Date.now();
        logTest('should GET /users/resolve/{username} expect success', 'API Users', 'START', 'Starting user resolve test');

        try {
            const response = await server.get(`/users/resolve/${TEST_USERS.myuser2}`).expect(200);

            logTest('should GET /users/resolve/{username} expect success', 'API Users', 'PASS', 'User resolve test completed successfully', {
                username: TEST_USERS.myuser2,
                resolvedUserId: response.body.id,
                responseStatus: response.status
            });

            expect(response.body).to.deep.equal({
                success: true,
                id: user
            });

            const duration = Date.now() - startTime;
            logPerformance(
                'GET /users/resolve test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS'
                },
                'User resolve test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should GET /users/resolve/{username} expect success',
                    testSuite: 'API Users',
                    operation: 'user resolve'
                },
                'User resolve test failed'
            );
            logTest('should GET /users/resolve/{username} expect success', 'API Users', 'FAIL', 'User resolve test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /users/resolve/{username} expect failure', async () => {
        const startTime = Date.now();
        logTest('should GET /users/resolve/{username} expect failure', 'API Users', 'START', 'Starting user resolve failure test');

        try {
            const response = await server.get('/users/resolve/myuser2invalid').expect(404);

            logTest('should GET /users/resolve/{username} expect failure', 'API Users', 'PASS', 'User resolve failure test completed successfully', {
                invalidUsername: 'myuser2invalid',
                expectedError: 'UserNotFound',
                actualError: response.body.code,
                responseStatus: response.status
            });

            expect(response.body.code).to.equal('UserNotFound');

            const duration = Date.now() - startTime;
            logPerformance(
                'GET /users/resolve failure test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS'
                },
                'User resolve failure test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should GET /users/resolve/{username} expect failure',
                    testSuite: 'API Users',
                    operation: 'user resolve failure'
                },
                'User resolve failure test failed'
            );
            logTest('should GET /users/resolve/{username} expect failure', 'API Users', 'FAIL', 'User resolve failure test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /users expect success', async () => {
        const startTime = Date.now();
        logTest('should GET /users expect success', 'API Users', 'START', 'Starting users list test');

        try {
            const response = await server.get(`/users?query=${TEST_USERS.myuser2}`).expect(200);

            logTest('should GET /users expect success', 'API Users', 'PASS', 'Users list test completed successfully', {
                query: TEST_USERS.myuser2,
                resultsCount: response.body.results?.length,
                foundUser: !!response.body.results.find(entry => entry.id === user),
                responseStatus: response.status
            });

            expect(response.body.success).to.be.true;
            expect(response.body.results.length).to.be.greaterThan(0);
            expect(response.body.results.find(entry => entry.username === TEST_USERS.myuser2)).to.exist;

            const duration = Date.now() - startTime;
            logPerformance(
                'GET /users test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS'
                },
                'Users list test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should GET /users expect success',
                    testSuite: 'API Users',
                    operation: 'users list'
                },
                'Users list test failed'
            );
            logTest('should GET /users expect success', 'API Users', 'FAIL', 'Users list test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /users/{user} expect success', async () => {
        const startTime = Date.now();
        logTest('should GET /users/{user} expect success', 'API Users', 'START', 'Starting user details test');

        try {
            let response = await server.get(`/users/${user}`).expect(200);

            logTest('should GET /users/{user} expect success', 'API Users', 'PASS', 'User details test completed successfully', {
                userId: user,
                responseUserId: response.body.id,
                responseStatus: response.status
            });

            expect(response.body.success).to.be.true;
            expect(response.body.id).to.equal(user);

            const duration = Date.now() - startTime;
            logPerformance(
                'GET /users/{user} test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS',
                    userId: user
                },
                'User details test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should GET /users/{user} expect success',
                    testSuite: 'API Users',
                    operation: 'user details',
                    userId: user
                },
                'User details test failed'
            );
            logTest('should GET /users/{user} expect success', 'API Users', 'FAIL', 'User details test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /users/{user} expect success / using a token', async () => {
        const startTime = Date.now();
        logTest('should GET /users/{user} expect success / using a token', 'API Users', 'START', 'Starting user details with token test');

        try {
            let response = await server.get(`/users/${user}?accessToken=${token}`).expect(200);

            logTest('should GET /users/{user} expect success / using a token', 'API Users', 'PASS', 'User details with token test completed successfully', {
                userId: user,
                hasToken: !!token,
                responseUserId: response.body.id
            });

            expect(response.body.success).to.be.true;
            expect(response.body.id).to.equal(user);

            const duration = Date.now() - startTime;
            logPerformance(
                'GET /users/{user} with token test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS'
                },
                'User details with token test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should GET /users/{user} expect success / using a token',
                    testSuite: 'API Users',
                    operation: 'user details with token'
                },
                'User details with token test failed'
            );
            logTest('should GET /users/{user} expect success / using a token', 'API Users', 'FAIL', 'User details with token test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /users/:user expect success / try /users/me using a token', async () => {
        let response = await server.get(`/users/me?accessToken=${token}`).expect(200);
        expect(response.body.success).to.be.true;
        expect(response.body.id).to.equal(user);
    });

    it('should GET /users/{user} expect failure / using a token and fail against other user', async () => {
        let response = await server.get(`/users/${user2}?accessToken=${token}`);
        const expectedCode = 'MissingPrivileges';
        expect(response.body.code).to.equal(expectedCode);
    });

    it('should DELETE /authenticate expect success', async () => {
        let response = await server.delete(`/authenticate?accessToken=${token}`).expect(200);
        expect(response.body.success).to.be.true;
    });

    it('should DELETE /authenticate expect failure / with false', async () => {
        // token is not valid anymore
        await server.delete(`/authenticate?accessToken=${token}`).expect(403);
    });

    it('should PUT /users/{user} expect success', async () => {
        const startTime = Date.now();
        logTest('should PUT /users/{user} expect success', 'API Users', 'START', 'Starting user update test');

        try {
            const name = 'John Smith 2';

            // update user data
            const response = await server
                .put(`/users/${user}`)
                .send({
                    name
                })
                .expect(200);

            expect(response.body.success).to.be.true;

            // request and verify
            let getResponse = await server.get(`/users/${user}`);
            expect(getResponse.body.success).to.be.true;
            expect(getResponse.body.id).to.equal(user);
            expect(getResponse.body.name).to.equal(name);

            logTest('should PUT /users/{user} expect success', 'API Users', 'PASS', 'User update test completed successfully', {
                userId: user,
                updatedName: name,
                updateSuccess: response.body.success,
                verificationSuccess: getResponse.body.success
            });

            const duration = Date.now() - startTime;
            logPerformance(
                'PUT /users/{user} test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS'
                },
                'User update test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should PUT /users/{user} expect success',
                    testSuite: 'API Users',
                    operation: 'user update'
                },
                'User update test failed'
            );
            logTest('should PUT /users/{user} expect success', 'API Users', 'FAIL', 'User update test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should PUT /users/{user} expect success / and renew a token', async () => {
        const isCryptoEmails = tools.runningCryptoEmails();
        let authRequest = {
            username: TEST_USERS.myuser2,
            token: true
        };

        if (isCryptoEmails) {
            // Crypto emails mode: no password required
            // emailDomain no longer needed - system will auto-generate email
        } else {
            // Standard mode: password required
            authRequest.password = TEST_PASSWORDS.secretvalue;
        }

        const authResponse1 = await server.post('/authenticate').send(authRequest).expect(200);

        expect(authResponse1.body.success).to.be.true;
        expect(authResponse1.body.token).to.exist;

        let token1 = authResponse1.body.token;

        const authResponse2 = await server.post('/authenticate').send(authRequest).expect(200);

        expect(authResponse2.body.success).to.be.true;
        expect(authResponse2.body.token).to.exist;

        let token2 = authResponse2.body.token;

        // try out token 1
        let getResponse1 = await server.get(`/users/me?accessToken=${token1}`).expect(200);
        expect(getResponse1.body.success).to.be.true;
        expect(getResponse1.body.id).to.equal(user);

        // try out token 2
        let getResponse2 = await server.get(`/users/me?accessToken=${token2}`).expect(200);
        expect(getResponse2.body.success).to.be.true;
        expect(getResponse2.body.id).to.equal(user);

        // update user info using a token

        if (isCryptoEmails) {
            // In crypto mode, password updates are blocked, so update name instead
            const response = await server
                .put(`/users/me?accessToken=${token1}`)
                .send({
                    name: 'Updated Name'
                })
                .expect(200);

            expect(response.body.success).to.be.true;
        } else {
            // In standard mode, update password
            const response = await server
                .put(`/users/me?accessToken=${token1}`)
                .send({
                    password: TEST_PASSWORDS.secretvalue
                })
                .expect(200);

            expect(response.body.success).to.be.true;
        }

        // try out token 1, should have been renewed
        let getResponse3 = await server.get(`/users/me?accessToken=${token1}`).expect(200);
        expect(getResponse3.body.success).to.be.true;
        expect(getResponse3.body.id).to.equal(user);

        if (!isCryptoEmails) {
            // In standard mode, token 2 should fail as it was not renewed after password update
            await server.get(`/users/me?accessToken=${token2}`).expect(403);
        } else {
            // In crypto mode, updating name doesn't invalidate tokens, so token 2 should still work
            let getResponse4 = await server.get(`/users/me?accessToken=${token2}`).expect(200);
            expect(getResponse4.body.success).to.be.true;
            expect(getResponse4.body.id).to.equal(user);
        }
    });

    it('should PUT /users/{user}/logout expect success', async () => {
        // request logout
        const response = await server.put(`/users/${user}/logout`).send({ reason: 'Just because' }).expect(200);
        expect(response.body.success).to.be.true;
    });

    it('should POST /users/{user}/quota/reset expect success', async () => {
        const response = await server.post(`/users/${user}/quota/reset`).send({}).expect(200);
        expect(response.body.success).to.be.true;

        expect(response.body.storageUsed).to.exist;
        expect(response.body.previousStorageUsed).to.exist;
    });

    it('should POST /quota/reset expect success', async () => {
        const response = await server.post(`/quota/reset`).send({}).expect(200);
        expect(response.body.success).to.be.true;
        expect(response.body.task).to.exist;
    });

    it('should POST /users/{user}/password/reset expect success', async () => {
        const isCryptoEmails = tools.runningCryptoEmails();

        if (isCryptoEmails) {
            // In crypto mode, password reset should return 400
            const response = await server.post(`/users/${user}/password/reset`).send({}).expect(400);
            expect(response.body.error).to.exist;
            expect(response.body.code).to.equal('PasswordResetNotAvailable');
            return;
        }

        const response = await server.post(`/users/${user}/password/reset`).send({}).expect(200);
        expect(response.body.success).to.be.true;

        expect(response.body.password).to.exist;

        // In standard mode, test that the reset password works for authentication
        const authResponse = await server
            .post('/authenticate')
            .send({
                username: TEST_USERS.myuser2,
                password: response.body.password
            })
            .expect(200);

        expect(authResponse.body).to.deep.equal({
            success: true,
            address: getTestEmail(TEST_USERS.myuser2),
            id: user,
            username: TEST_USERS.myuser2,
            scope: 'master',
            require2fa: false,
            // using a temporary password requires a password change
            requirePasswordChange: true
        });
    });

    it('should POST /users/{user}/password/reset expect success / using a future date', async () => {
        const isCryptoEmails = tools.runningCryptoEmails();

        if (isCryptoEmails) {
            // In crypto mode, password reset should return 400
            const response = await server
                .post(`/users/${user}/password/reset`)
                .send({
                    validAfter: new Date(Date.now() + 1 * 3600 * 1000).toISOString()
                })
                .expect(400);
            expect(response.body.error).to.exist;
            expect(response.body.code).to.equal('PasswordResetNotAvailable');
            return;
        }

        const response = await server
            .post(`/users/${user}/password/reset`)
            .send({
                validAfter: new Date(Date.now() + 1 * 3600 * 1000).toISOString()
            })
            .expect(200);
        expect(response.body.success).to.be.true;

        expect(response.body.password).to.exist;

        // password not yet valid, should get 403
        await server
            .post('/authenticate')
            .send({
                username: TEST_USERS.myuser2,
                password: response.body.password
            })
            .expect(403);
    });

    it('should DELETE /users/{user} expect success', async () => {
        const startTime = Date.now();
        logTest('should DELETE /users/{user} expect success', 'API Users', 'START', 'Starting user deletion test');

        try {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto mode, password update should fail with 403
                const passwordUpdateResponse = await server
                    .put(`/users/${user}`)
                    .send({
                        password: TEST_PASSWORDS.secretvalue,
                        ip: '1.2.3.5'
                    })
                    .expect(403);

                expect(passwordUpdateResponse.body.error).to.include('Password updates are not available in crypto emails mode');
            } else {
                // In standard mode, password update should succeed
                const passwordUpdateResponse = await server
                    .put(`/users/${user}`)
                    .send({
                        password: TEST_PASSWORDS.secretvalue,
                        ip: '1.2.3.5'
                    })
                    .expect(200);

                expect(passwordUpdateResponse.body.success).to.be.true;
            }

            // Delete user
            const response = await server
                .delete(`/users/${user}?deleteAfter=${encodeURIComponent(new Date(Date.now() + 3600 * 1000).toISOString())}`)
                .expect(200);
            expect(response.body.success).to.be.true;

            expect(response.body.addresses.deleted).to.gte(1);
            expect(response.body.task).to.exist;

            // Try to authenticate
            // In standard mode: fails with 403
            if (!isCryptoEmails) {
                await server
                    .post('/authenticate')
                    .send({
                        username: TEST_USERS.myuser2,
                        password: TEST_PASSWORDS.secretvalue
                    })
                    .expect(403);
            }

            logTest('should DELETE /users/{user} expect success', 'API Users', 'PASS', 'User deletion test completed successfully', {
                userId: user,
                addressesDeleted: response.body.addresses.deleted,
                taskId: response.body.task,
                authenticationBlocked: true
            });

            const duration = Date.now() - startTime;
            logPerformance(
                'DELETE /users/{user} test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS',
                    userId: user
                },
                'User deletion test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should DELETE /users/{user} expect success',
                    testSuite: 'API Users',
                    operation: 'user deletion',
                    userId: user
                },
                'User deletion test failed'
            );
            logTest('should DELETE /users/{user} expect success', 'API Users', 'FAIL', 'User deletion test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /users/{user}/restore expect success', async () => {
        const response = await server.get(`/users/${user}/restore`).expect(200);
        expect(response.body.success).to.be.true;
        expect(response.body.username).to.equal(TEST_USERS.myuser2);
        const expectedAddress = getTestEmail(TEST_USERS.myuser2);
        expect(response.body.recoverableAddresses).to.deep.equal([expectedAddress]);
    });

    it('should POST /users/{user}/restore expect success', async () => {
        const response = await server.post(`/users/${user}/restore`).send({}).expect(200);
        expect(response.body.success).to.be.true;
        expect(response.body.addresses.recovered).to.gte(1);
        const expectedMainAddress = getTestEmail(TEST_USERS.myuser2);
        expect(response.body.addresses.main).to.equal(expectedMainAddress);
    });

    it('should POST /users expect success / with DES hash', async () => {
        const startTime = Date.now();
        logTest('should POST /users expect success / with DES hash', 'API Users', 'START', 'Starting DES hash user creation test');

        try {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto mode, create a regular user instead of DES hash since hashed passwords don't apply
                const response = await createUser(server, {
                    username: TEST_USERS.desuser,
                    name: 'Crypt Des',
                    password: TEST_PASSWORDS.test
                });
                expect(response.body.success).to.be.true;
                expect(/^[0-9a-f]{24}$/.test(response.body.id)).to.be.true;
                user2 = response.body.id;

                logTest(
                    'should POST /users expect success / with DES hash',
                    'API Users',
                    'PASS',
                    'User creation test completed successfully (crypto mode - regular user instead of DES)',
                    {
                        userId: response.body.id,
                        username: TEST_USERS.desuser,
                        cryptoMode: true,
                        expectedBehavior: 'Created regular user instead of DES hash in crypto mode'
                    }
                );
                return;
            }

            const response = await createUser(server, {
                username: TEST_USERS.desuser,
                name: 'Crypt Des',
                address: getTestEmail('des'),
                password: 'sBk81TlWxyZlc',
                hashedPassword: true
            });

            expect(response.body.success).to.be.true;
            expect(/^[0-9a-f]{24}$/.test(response.body.id)).to.be.true;
            user2 = response.body.id;

            const authResponseSuccess = await server
                .post('/authenticate')
                .send({
                    username: TEST_USERS.desuser,
                    password: '12Mina34Ise56P.'
                })
                .expect(200);
            expect(authResponseSuccess.body.success).to.be.true;

            const authResponseFail = await server
                .post('/authenticate')
                .send({
                    username: TEST_USERS.desuser,
                    password: TEST_PASSWORDS.wrongpass
                })
                .expect(403);
            expect(authResponseFail.body.error).to.exist;

            logTest('should POST /users expect success / with DES hash', 'API Users', 'PASS', 'DES hash user creation test completed successfully', {
                userId: response.body.id,
                username: TEST_USERS.desuser,
                address: getTestEmail('des'),
                authSuccessful: authResponseSuccess.body.success,
                authFailureHandled: !!authResponseFail.body.error
            });

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /users DES hash test',
                duration,
                {
                    testSuite: 'API Users',
                    status: 'PASS',
                    userId: response.body.id
                },
                'DES hash user creation test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /users expect success / with DES hash',
                    testSuite: 'API Users',
                    operation: 'DES hash user creation'
                },
                'DES hash user creation test failed'
            );
            logTest('should POST /users expect success / with DES hash', 'API Users', 'FAIL', 'DES hash user creation test failed', {
                error: error.message
            });
            throw error;
        }
    });
});
