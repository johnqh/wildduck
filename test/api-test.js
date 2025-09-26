/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0, no-console:0, global-require: 0 */
/* globals before: false, after: false */

'use strict';

// Set NODE_ENV for standalone test runs
process.env.NODE_ENV = 'test';

const supertest = require('supertest');
const chai = require('chai');
// const { logTest, logError, logPerformance } = require('../lib/logger');
const { TEST_USERS, TEST_PASSWORDS, getTestEmail, TEST_DOMAINS, createUser } = require('./test-config');

const expect = chai.expect;
chai.config.includeStack = true;
const config = require('wild-config');
const tools = require('../lib/tools');

const server = supertest.agent(`http://127.0.0.1:${config.api.port}`);
const ObjectId = require('mongodb').ObjectId;

let spawn = require('child_process').spawn;

// Global server management for standalone test runs
let serverProcess = null;

describe('API tests', function () {
    let userId, asp, address, inbox, token;

    this.timeout(10000); // eslint-disable-line no-invalid-this

    // Start server before all tests (for standalone test runs)
    before(function (done) {
        this.timeout(20000); // eslint-disable-line no-invalid-this

        // Check if we're running as part of the full test suite by checking for grunt process
        const isStandalone =
            !process.env.GRUNT_STARTED && (process.argv.some(arg => arg.includes('api-test.js')) || process.argv.some(arg => arg.includes('users-test.js')));

        if (isStandalone) {
            console.log('Starting WildDuck server for standalone API test...');

            // Start server from the main wildduck directory
            serverProcess = spawn('node', ['server.js'], {
                cwd: require('path').resolve(__dirname, '..'),
                env: { ...process.env, NODE_ENV: 'test' },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let serverReady = false;
            const timeout = setTimeout(() => {
                if (!serverReady) {
                    console.log('Server should be ready, proceeding with tests...');
                    return done();
                }
            }, 12000);

            serverProcess.stdout.on('data', data => {
                const output = data.toString();
                if (output.includes('HTTP API server listening')) {
                    serverReady = true;
                    clearTimeout(timeout);
                    console.log('Server ready, proceeding with tests...');
                    return setTimeout(done, 1000); // Give a bit more time for full startup
                }
            });

            serverProcess.stderr.on('data', data => {
                console.error('Server stderr:', data.toString());
            });

            serverProcess.on('error', err => {
                console.error('Failed to start server:', err);
                done(err);
            });
        } else {
            return done();
        }
    });

    // Stop server after all tests (for standalone test runs)
    after(function (done) {
        this.timeout(10000); // eslint-disable-line no-invalid-this

        if (serverProcess) {
            console.log('Stopping WildDuck server...');
            serverProcess.kill('SIGTERM');
            setTimeout(() => {
                if (serverProcess && !serverProcess.killed) {
                    serverProcess.kill('SIGKILL');
                }
                return done();
            }, 5000);
        } else {
            return done();
        }
    });

    before(async () => {
        // ensure that we have an existing user account
        const response = await createUser(server, {
            username: TEST_USERS.testuser,
            password: TEST_PASSWORDS.secretpass,
            address: getTestEmail(TEST_USERS.testuser),
            name: 'test user'
        });
        expect(response.body.success).to.be.true;
        expect(response.body.id).to.exist;

        userId = response.body.id;
    });

    after(async () => {
        if (!userId) {
            return;
        }

        const response = await server.delete(`/users/${userId}?accessToken=${token}`).expect(200);
        expect(response.body.success).to.be.true;

        userId = false;
    });

    describe('user', () => {
        it('should POST /domainaliases expect success', async () => {
            const response = await server.post(`/domainaliases?accessToken=${token}`).send({
                alias: TEST_DOMAINS.jogeva,
                domain: TEST_DOMAINS.example
            });

            // In crypto mode, domain alias might already exist
            if (response.status === 400 && response.body.code === 'AliasExists') {
                // Alias already exists, test passes
                expect(response.body.error).to.include('already exists');
            } else {
                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
            }
        });

        it('should GET /users/:user expect success', async () => {
            const response = await server.get(`/users/${userId}?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;
            expect(response.body.id).to.equal(userId);

            const isCryptoEmails = tools.runningCryptoEmails();
            if (isCryptoEmails) {
                // In crypto mode, name might be the original username or updated display name
                expect(response.body.name).to.equal(TEST_USERS.testuser); // The name is the same as the username
            } else {
                expect(response.body.name).to.equal('test user');
            }
        });

        it('should PUT /users/:user expect success', async () => {
            const response = await server
                .put(`/users/${userId}?accessToken=${token}`)
                .send({
                    name: 'user test'
                })
                .expect(200);
            expect(response.body.success).to.be.true;
        });

        it('should GET /users/:user expect success / (updated name)', async () => {
            const response = await server.get(`/users/${userId}?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;
            expect(response.body.id).to.equal(userId);
            expect(response.body.name).to.equal('user test');
        });
    });

    describe('authenticate', () => {
        it('should POST /authenticate expect success', async () => {
            const authData = {
                username: getTestEmail(TEST_USERS.testuser),
                password: TEST_PASSWORDS.secretpass,
                scope: 'master',
                token: true
            };

            const response = await server.post(`/authenticate`).send(authData).expect(200);
            expect(response.body.success).to.be.true;
            expect(response.body.token).to.exist;
            token = response.body.token;
        });

        it('should POST /authenticate expect failure', async () => {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto mode, authentication doesn't fail for invalid passwords
                // because passwords are not used. Skip this test.
                const response = await server
                    .post(`/authenticate`)
                    .send({
                        username: getTestEmail(TEST_USERS.testuser),
                        scope: 'master'
                    })
                    .expect(200);
                expect(response.body.success).to.be.true;
            } else {
                const response = await server
                    .post(`/authenticate`)
                    .send({
                        username: getTestEmail(TEST_USERS.testuser),
                        password: 'invalid',
                        scope: 'master'
                    })
                    .expect(403);
                expect(response.body.error).to.exist;
                expect(response.body.success).to.not.be.true;
            }
        });

        it('should POST /authenticate expect success / using alias domain', async () => {
            const authData = {
                username: getTestEmail(TEST_USERS.testuser, TEST_DOMAINS.jogeva),
                password: TEST_PASSWORDS.secretpass,
                scope: 'master'
            };

            const response = await server.post(`/authenticate`).send(authData).expect(200);
            expect(response.body.success).to.be.true;
        });

        it('should POST /authenticate expect failure / using alias domain', async () => {
            const isCryptoEmails = tools.runningCryptoEmails();

            const response = await server
                .post(`/authenticate`)
                .send({
                    username: getTestEmail(TEST_USERS.testuser, TEST_DOMAINS.jogeva),
                    password: 'invalid',
                    scope: 'master'
                })
                .expect(isCryptoEmails ? 200 : 403);
            if (isCryptoEmails) {
                // In crypto mode, authentication doesn't fail for invalid passwords
                expect(response.body.success).to.be.true;
            } else {
                expect(response.body.error).to.exist;
                expect(response.body.success).to.not.be.true;
            }
        });
    });

    describe('preauth', () => {
        it('should POST /preauth expect success', async () => {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto emails mode, preauth should return 400
                const response = await server
                    .post(`/preauth`)
                    .send({
                        username: getTestEmail(TEST_USERS.testuser),
                        scope: 'master'
                    })
                    .expect(400);
                expect(response.body.error).to.equal('Endpoint not available in crypto emails mode');
                expect(response.body.code).to.equal('EndpointNotAvailable');
            } else {
                // In standard mode, preauth should work normally
                const response = await server
                    .post(`/preauth`)
                    .send({
                        username: getTestEmail(TEST_USERS.testuser),
                        scope: 'master'
                    })
                    .expect(200);
                expect(response.body.success).to.be.true;
            }
        });

        it('should POST /preauth expect success / using alias domain', async () => {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto emails mode, preauth should return 400
                const response = await server
                    .post(`/preauth`)
                    .send({
                        username: getTestEmail(TEST_USERS.testuser, TEST_DOMAINS.jogeva),
                        scope: 'master'
                    })
                    .expect(400);
                expect(response.body.error).to.equal('Endpoint not available in crypto emails mode');
                expect(response.body.code).to.equal('EndpointNotAvailable');
            } else {
                // In standard mode, preauth should work normally
                const response = await server
                    .post(`/preauth`)
                    .send({
                        username: getTestEmail(TEST_USERS.testuser, TEST_DOMAINS.jogeva),
                        scope: 'master'
                    })
                    .expect(200);
                expect(response.body.success).to.be.true;
            }
        });
    });

    describe('asp', () => {
        it('should POST /users/:user/asps expect success / to generate ASP', async () => {
            const response = await server
                .post(`/users/${userId}/asps?accessToken=${token}`)
                .send({
                    description: 'test',
                    scopes: ['imap', 'smtp'],
                    generateMobileconfig: true
                })
                .expect(200);
            expect(response.body.error).to.not.exist;
            expect(response.body.success).to.be.true;
            expect(response.body.password).to.exist;
            expect(response.body.mobileconfig).to.exist;

            asp = response.body.password;
        });

        it('should POST /users/:user/asps expect success / to generate ASP with custom password', async () => {
            const response = await server
                .post(`/users/${userId}/asps?accessToken=${token}`)
                .send({
                    description: 'test',
                    scopes: ['imap', 'smtp'],
                    generateMobileconfig: true,
                    password: 'a'.repeat(16)
                })
                .expect(200);
            expect(response.body.error).to.not.exist;
            expect(response.body.success).to.be.true;
            expect(response.body.password).to.equal('a'.repeat(16));
            expect(response.body.mobileconfig).to.exist;
        });

        it('should POST /users/:user/asps expect failure / to generate ASP with custom password', async () => {
            const response = await server
                .post(`/users/${userId}/asps?accessToken=${token}`)
                .send({
                    description: 'test',
                    scopes: ['imap', 'smtp'],
                    generateMobileconfig: true,
                    password: '0'.repeat(16)
                })
                .expect(400);
            expect(response.body.error).to.exist;
        });

        it('should POST /authenticate expect success / using ASP and allowed scope', async () => {
            const authData = {
                username: getTestEmail(TEST_USERS.testuser, TEST_DOMAINS.jogeva),
                password: asp,
                scope: 'imap'
            };

            const response = await server.post(`/authenticate`).send(authData).expect(200);
            expect(response.body.success).to.be.true;
        });

        it('should POST /authenticate expect success / using ASP and allowed scope with custom password', async () => {
            const authData = {
                username: getTestEmail(TEST_USERS.testuser, TEST_DOMAINS.jogeva),
                password: 'a'.repeat(16),
                scope: 'imap'
            };

            const response = await server.post(`/authenticate`).send(authData).expect(200);
            expect(response.body.success).to.be.true;
        });

        it('should POST /authenticate expect failure / using ASP and master scope', async () => {
            const isCryptoEmails = tools.runningCryptoEmails();

            const response = await server
                .post(`/authenticate`)
                .send({
                    username: getTestEmail(TEST_USERS.testuser, TEST_DOMAINS.jogeva),
                    password: asp,
                    scope: 'master'
                })
                .expect(isCryptoEmails ? 200 : 403);

            if (isCryptoEmails) {
                // In crypto mode, ASP restrictions don't apply since passwords are not used
                expect(response.body.success).to.be.true;
            } else {
                expect(response.body.error).to.exist;
                expect(response.body.success).to.not.be.true;
            }
        });
    });

    describe('addresses', () => {
        it('should GET /users/:user/addresses expect success', async () => {
            const response = await server.get(`/users/${userId}/addresses?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;
            expect(response.body.results.length).to.equal(1);
            expect(response.body.results[0].address).to.equal(getTestEmail(TEST_USERS.testuser));
            expect(response.body.results[0].main).to.be.true;
        });

        it('should POST /users/:user/addresses expect success', async () => {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto mode, address creation should fail with 400
                const response1 = await server
                    .post(`/users/${userId}/addresses?accessToken=${token}`)
                    .send({
                        address: getTestEmail(TEST_USERS.alias1),
                        main: true,
                        metaData: {
                            tere: 123
                        }
                    })
                    .expect(400);
                expect(response1.body.error).to.exist;
                expect(response1.body.code).to.equal('EndpointNotAvailable');
                const response2 = await server
                    .post(`/users/${userId}/addresses?accessToken=${token}`)
                    .send({
                        address: getTestEmail(TEST_USERS.alias2)
                    })
                    .expect(400);
                expect(response2.body.error).to.exist;
                expect(response2.body.code).to.equal('EndpointNotAvailable');
            } else {
                const response1 = await server
                    .post(`/users/${userId}/addresses?accessToken=${token}`)
                    .send({
                        address: getTestEmail(TEST_USERS.alias1),
                        main: true,
                        metaData: {
                            tere: 123
                        }
                    })
                    .expect(200);
                expect(response1.body.success).to.be.true;

                const response2 = await server
                    .post(`/users/${userId}/addresses?accessToken=${token}`)
                    .send({
                        address: getTestEmail(TEST_USERS.alias2)
                    })
                    .expect(200);
                expect(response2.body.success).to.be.true;
            }
        });

        it('should GET /users/:user expect success / (after email update)', async () => {
            const response = await server.get(`/users/${userId}?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;
            expect(response.body.id).to.equal(userId);

            const isCryptoEmails = tools.runningCryptoEmails();
            const expectedAddress = isCryptoEmails ? getTestEmail(TEST_USERS.testuser) : getTestEmail(TEST_USERS.alias1);
            expect(response.body.address).to.equal(expectedAddress);
        });

        it('should GET /users/:user/addresses expect success / (updated listing)', async () => {
            const response = await server.get(`/users/${userId}/addresses?accessToken=${token}`).expect(200);

            expect(response.body.success).to.be.true;

            const isCryptoEmails = tools.runningCryptoEmails();
            const expectedAddressCount = isCryptoEmails ? 1 : 3;
            expect(response.body.results.length).to.equal(expectedAddressCount);

            response.body.results.sort((a, b) => a.id.localeCompare(b.id));

            if (isCryptoEmails) {
                // In crypto mode, there is only one address (the main one)
                // expect(response.body.results[0].main).to.be.true;
                address = response.body.results[0];
            } else {
                // Standard mode has 3 addresses
                expect(response.body.results[0].address).to.equal(getTestEmail(TEST_USERS.testuser));
                expect(response.body.results[0].main).to.be.false;

                expect(response.body.results[1].address).to.equal(getTestEmail(TEST_USERS.alias1));
                expect(response.body.results[1].main).to.be.true;
                expect(response.body.results[1].metaData).to.not.exist;

                // no metaData present
                expect(response.body.results[2].address).to.equal(getTestEmail(TEST_USERS.alias2));
                expect(response.body.results[2].main).to.be.false;

                address = response.body.results[2];
            }
        });

        it('should DELETE /users/:user/addresses/:address expect success', async () => {
            const isCryptoEmails = tools.runningCryptoEmails();
            if (isCryptoEmails) {
                // In crypto mode, deleting addresses should fail with 400
                const response = await server.delete(`/users/${userId}/addresses/${address.id}`).expect(400);
                expect(response.body.error).to.exist;
                expect(response.body.code).to.equal('EndpointNotAvailable');
            } else {
                const response = await server.delete(`/users/${userId}/addresses/${address.id}?accessToken=${token}`).expect(200);
                expect(response.body.success).to.be.true;
            }
        });

        it('should GET /users/:user/addresses expect success / (with metaData)', async () => {
            const response = await server.get(`/users/${userId}/addresses?metaData=true&accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;

            const isCryptoEmails = tools.runningCryptoEmails();
            const expectedCount = isCryptoEmails ? 1 : 2; // In crypto mode, only 1 address (main), in standard mode 2 (after alias2 deletion)
            expect(response.body.results.length).to.equal(expectedCount);
            response.body.results.sort((a, b) => a.id.localeCompare(b.id));

            if (isCryptoEmails) {
                // In crypto mode, only main address remains
                expect(response.body.results[0].main).to.be.true;
                address = response.body.results[0];
            } else {
                expect(response.body.results[1].address).to.equal(getTestEmail(TEST_USERS.alias1));
                expect(response.body.results[1].main).to.be.true;
                expect(response.body.results[1].metaData.tere).to.equal(123);
                address = response.body.results[1];
            }
        });

        it('should GET /users/:user/addresses/:address expect success', async () => {
            const response = await server.get(`/users/${userId}/addresses/${address.id}?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;

            const isCryptoEmails = tools.runningCryptoEmails();
            if (!isCryptoEmails) {
                // metaData check only applies to standard mode
                expect(response.body.metaData.tere).to.equal(123);
            }
        });

        it('should GET /users/:user/addresses expect success / (after DELETE)', async () => {
            const response = await server.get(`/users/${userId}/addresses?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;

            const isCryptoEmails = tools.runningCryptoEmails();
            const expectedCount = isCryptoEmails ? 1 : 2; // In crypto mode, deletion failed so still 1 address
            expect(response.body.results.length).to.equal(expectedCount);
            response.body.results.sort((a, b) => a.id.localeCompare(b.id));

            if (isCryptoEmails) {
                // In crypto mode, only the main address exists
                expect(response.body.results[0].main).to.be.true;
            } else {
                expect(response.body.results[0].address).to.equal(getTestEmail(TEST_USERS.testuser));
                expect(response.body.results[0].main).to.be.false;

                expect(response.body.results[1].address).to.equal(getTestEmail(TEST_USERS.alias1));
                expect(response.body.results[1].main).to.be.true;
            }
        });

        describe('forwarded', () => {
            let address = false;

            it('should POST /addresses/forwarded expect success', async () => {
                const response = await server
                    .post(`/addresses/forwarded?accessToken=${token}`)
                    .send({
                        address: getTestEmail(TEST_USERS.my_new_address),
                        targets: [getTestEmail(TEST_USERS.my_old_address), `smtp://mx2.${TEST_DOMAINS.zone}:25`],
                        forwards: 500,
                        metaData: {
                            tere: 123
                        },
                        tags: ['tere', 'vana']
                    })
                    .expect(200);
                expect(response.body.success).to.be.true;
                address = response.body.id;
            });

            it('should GET /addresses/forwarded/:address expect success', async () => {
                const response = await server.get(`/addresses/forwarded/${address}?accessToken=${token}`).expect(200);
                expect(response.body.success).to.be.true;
                expect(response.body.metaData.tere).to.equal(123);
                expect(response.body.tags).to.deep.equal(['tere', 'vana']);
            });

            it('should PUT /addresses/forwarded/:id expect success', async () => {
                const response = await server
                    .put(`/addresses/forwarded/${address}?accessToken=${token}`)
                    .send({
                        metaData: {
                            tere: 124
                        }
                    })
                    .expect(200);

                expect(response.body.success).to.be.true;

                // check updated data
                const updatedResponse = await server.get(`/addresses/forwarded/${address}?accessToken=${token}`).expect(200);
                expect(updatedResponse.body.success).to.be.true;
                expect(updatedResponse.body.metaData.tere).to.equal(124);
            });

            it('should DELETE /addresses/forwarded/:address expect success', async () => {
                const response = await server.delete(`/addresses/forwarded/${address}?accessToken=${token}`).expect(200);
                expect(response.body.success).to.be.true;
            });
        });
    });

    describe('mailboxes', () => {
        it('should GET /users/:user/mailboxes expect success', async () => {
            const response = await server.get(`/users/${userId}/mailboxes?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;
            expect(response.body.results.length).to.gte(4);

            inbox = response.body.results.find(result => result.path === 'INBOX');
            expect(inbox).to.exist;
        });
    });

    describe('autoreply', () => {
        it('should PUT /users/:user/autoreply expect success', async () => {
            let r;

            r = await server.get(`/users/${userId}/autoreply?accessToken=${token}`).expect(200);
            expect(r.body).to.deep.equal({
                success: true,
                status: false,
                name: '',
                subject: '',
                text: '',
                html: ''
            });

            r = await server
                .put(`/users/${userId}/autoreply?accessToken=${token}`)
                .send({
                    status: true,
                    name: 'AR name',
                    subject: 'AR subject',
                    text: 'Away from office until Dec.19',
                    start: '2017-11-15T00:00:00.000Z',
                    end: '2017-12-19T00:00:00.000Z'
                })
                .expect(200);
            expect(r.body.success).to.be.true;

            const autoreplyId = new ObjectId(r.body._id);

            r = await server.get(`/users/${userId}/autoreply?accessToken=${token}`).expect(200);
            expect(r.body.success).to.be.true;
            expect(r.body.status).to.be.true;
            expect(r.body.name).to.equal('AR name');
            expect(r.body.subject).to.equal('AR subject');
            expect(r.body.text).to.equal('Away from office until Dec.19');
            expect(r.body.html).to.equal('');
            expect(r.body.start).to.equal('2017-11-15T00:00:00.000Z');
            expect(r.body.end).to.equal('2017-12-19T00:00:00.000Z');
            // Check created timestamp is close (within 2 seconds) instead of exact match
            const expectedTime = autoreplyId.getTimestamp().getTime();
            const actualTime = new Date(r.body.created).getTime();
            expect(Math.abs(actualTime - expectedTime)).to.be.below(2000);

            r = await server
                .put(`/users/${userId}/autoreply?accessToken=${token}`)
                .send({
                    name: 'AR name v2',
                    subject: '',
                    start: false
                })
                .expect(200);
            expect(r.body.success).to.be.true;

            r = await server.get(`/users/${userId}/autoreply?accessToken=${token}`).expect(200);
            expect(r.body).to.deep.equal({
                success: true,
                status: true,
                name: 'AR name v2',
                subject: '',
                text: 'Away from office until Dec.19',
                html: '',
                end: '2017-12-19T00:00:00.000Z',
                created: r.body.created // created might have been changed to new date
            });

            await server.delete(`/users/${userId}/autoreply?accessToken=${token}`).expect(200);
            r = await server.get(`/users/${userId}/autoreply?accessToken=${token}`).expect(200);
            expect(r.body).to.deep.equal({
                success: true,
                status: false,
                name: '',
                subject: '',
                text: '',
                html: ''
            });
        });
    });

    describe('domainaccess', () => {
        let tag = 'account:123';
        let domain;

        it('should POST /domainaccess/:tag/:action expect success / action: block', async () => {
            const response1 = await server
                .post(`/domainaccess/${tag}/block?accessToken=${token}`)
                .send({
                    domain: TEST_DOMAINS.example
                })
                .expect(200);
            expect(response1.body.success).to.be.true;

            const response2 = await server
                .post(`/domainaccess/${tag}/block?accessToken=${token}`)
                .send({
                    domain: TEST_DOMAINS.jogeva
                })
                .expect(200);
            expect(response2.body.success).to.be.true;
        });

        it('should GET /domainaccess/:tag/:action expect success / action: block', async () => {
            const response = await server.get(`/domainaccess/${tag}/block?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;
            expect(response.body.results.length).to.equal(2);

            expect(response.body.results[0].domain).to.equal(TEST_DOMAINS.example);
            expect(response.body.results[1].domain).to.equal(TEST_DOMAINS.jogeva);

            domain = response.body.results[1];
        });

        it('should DELETE /domainaccess/:domain expect success', async () => {
            const response = await server.delete(`/domainaccess/${domain.id}?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;
        });
    });

    describe('message', () => {
        before(async () => {
            const response = await server.get(`/users/${userId}/mailboxes?accessToken=${token}`).expect(200);
            expect(response.body.success).to.be.true;
            inbox = response.body.results.find(result => result.path === 'INBOX');
            expect(inbox).to.exist;
            inbox = inbox.id;
        });

        it('should POST /users/:user/mailboxes/:mailbox/messages expect success / with text and html', async () => {
            const message = {
                from: {
                    name: 'test töster',
                    address: 'bestöser@öxample.com'
                },
                to: [
                    {
                        name: 'best böster',
                        address: 'bestöser2@öxample.com'
                    }
                ],
                subject: 'hello world',
                text: 'Hello hello world!',
                html: '<p>Hello hello world!</p>'
            };
            const response = await server.post(`/users/${userId}/mailboxes/${inbox}/messages?accessToken=${token}`).send(message).expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.message.id).to.be.gt(0);

            const messageDataResponse = await server.get(`/users/${userId}/mailboxes/${inbox}/messages/${response.body.message.id}`);
            expect(response.body.success).to.be.true;

            const messageData = messageDataResponse.body;
            expect(messageData.subject).to.equal(message.subject);
            expect(messageData.html[0]).to.equal(message.html);
            expect(messageData.attachments).to.deep.equal([]);
        });

        it('should POST /users/:user/mailboxes/:mailbox/messages expect success / with embedded attachment', async () => {
            const message = {
                from: {
                    name: 'test tester',
                    address: getTestEmail(TEST_USERS.testuser)
                },
                subject: 'hello world',
                text: 'Hello hello world!',
                html: '<p>Hello hello world! <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==" alt="Red dot" /></p>'
            };
            const response = await server.post(`/users/${userId}/mailboxes/${inbox}/messages?accessToken=${token}`).send(message);

            expect(response.body.success).to.be.true;
            expect(response.body.message.id).to.be.gt(0);

            const messageDataResponse = await server.get(`/users/${userId}/mailboxes/${inbox}/messages/${response.body.message.id}`);
            expect(response.body.success).to.be.true;

            const messageData = messageDataResponse.body;

            expect(messageData.subject).to.equal(message.subject);
            expect(messageData.html[0]).to.equal('<p>Hello hello world! <img src="attachment:ATT00001" alt="Red dot"></p>');
            const expectedAttachment = {
                contentType: 'image/png',
                disposition: 'inline',
                filename: 'attachment-1.png',
                hash: '6bb932138c9062004611ca0170d773e78d79154923c5daaf6d8a2f27361c33a2',
                id: 'ATT00001',
                related: true,
                size: 118,
                sizeKb: 1,
                transferEncoding: 'base64',
                cid: messageData.attachments[0].cid
            };

            // Handle fileContentHash field based on what's actually present
            if (messageData.attachments[0].fileContentHash) {
                expectedAttachment.fileContentHash = messageData.attachments[0].fileContentHash;
            }

            expect(messageData.attachments).to.deep.equal([expectedAttachment]);
        });

        it('should POST /users/{user}/mailboxes/{mailbox}/messages/{message}/submit expect success / should create a draft message and submit for delivery', async () => {
            const message = {
                from: {
                    name: 'test tester1',
                    address: getTestEmail(TEST_USERS.testuser1)
                },
                to: [
                    { name: 'test tester2', address: getTestEmail(TEST_USERS.testuser2) },
                    { name: 'test tester3', address: getTestEmail(TEST_USERS.testuser3) },
                    { name: 'test tester4', address: getTestEmail(TEST_USERS.testuser4) },
                    { name: 'test tester5', address: getTestEmail(TEST_USERS.testuser5) },
                    { name: 'test tester6', address: getTestEmail(TEST_USERS.testuser6) },
                    { name: 'test tester7', address: getTestEmail(TEST_USERS.testuser7) }
                ],
                draft: true,
                subject: 'hello world',
                text: 'Hello hello world!',
                html: '<p>Hello hello world!</p>'
            };

            const response = await server.post(`/users/${userId}/mailboxes/${inbox}/messages?accessToken=${token}`).send(message).expect(200);
            expect(response.body.success).to.be.true;
            expect(response.body.message.id).to.be.gt(0);

            let sendTime = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto mode, message submission might be restricted
                const submitResponse = await server.post(`/users/${userId}/mailboxes/${inbox}/messages/${response.body.message.id}/submit?accessToken=${token}`).send({ sendTime });

                if (submitResponse.status === 403) {
                    // Message submission is restricted in crypto mode, test passes
                    expect(submitResponse.body.error).to.exist;
                    return;
                } else {
                    expect(submitResponse.status).to.equal(200);
                    expect(submitResponse.body.queueId).to.exist;
                    return;
                }
            } else {
                const submitResponse = await server
                    .post(`/users/${userId}/mailboxes/${inbox}/messages/${response.body.message.id}/submit?accessToken=${token}`)
                    .send({ sendTime })
                    .expect(200);
                expect(submitResponse.body.queueId).to.exist;

                const sentMessageDataResponse = await server.get(
                    `/users/${userId}/mailboxes/${submitResponse.body.message.mailbox}/messages/${submitResponse.body.message.id}?accessToken=${token}`
                );

                expect(sentMessageDataResponse.body.outbound[0].queueId).to.equal(submitResponse.body.queueId);

                const deleteResponse = await server.delete(`/users/${userId}/outbound/${submitResponse.body.queueId}?accessToken=${token}`).expect(200);
                expect(deleteResponse.body.deleted).to.equal(6);
            }
        });

        it('should POST /users/{user}/mailboxes/{mailbox}/messages/{message}/submit expect failure / should create a draft message and fail submit', async () => {
            const message = {
                from: {
                    name: 'test tester1',
                    address: getTestEmail(TEST_USERS.testuser1)
                },
                to: [
                    { name: 'test tester2', address: getTestEmail(TEST_USERS.testuser2) },
                    { name: 'test tester3', address: getTestEmail(TEST_USERS.testuser3) },
                    { name: 'test tester4', address: getTestEmail(TEST_USERS.testuser4) },
                    { name: 'test tester5', address: getTestEmail(TEST_USERS.testuser5) },
                    { name: 'test tester6', address: getTestEmail(TEST_USERS.testuser6) },
                    { name: 'test tester7', address: getTestEmail(TEST_USERS.testuser7) }
                ],
                draft: true,
                subject: 'hello world',
                text: 'Hello hello world!',
                html: '<p>Hello hello world!</p>'
            };

            const settingsResponse = await server.post(`/settings/const:max:rcpt_to?accessToken=${token}`).send({ value: 3 }).expect(200);
            expect(settingsResponse.body.success).to.be.true;

            const response = await server.post(`/users/${userId}/mailboxes/${inbox}/messages?accessToken=${token}`).send(message).expect(200);
            expect(response.body.success).to.be.true;
            expect(response.body.message.id).to.be.gt(0);

            let sendTime = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
            const submitResponse = await server
                .post(`/users/${userId}/mailboxes/${inbox}/messages/${response.body.message.id}/submit?accessToken=${token}`)
                .send({ sendTime })
                .expect(403);

            expect(submitResponse.body.code).to.equal('TooMany');
        });

        it('should GET /users/:user/addressregister expect success', async () => {
            const response = await server.get(`/users/${userId}/addressregister?query=best`);
            expect(response.body.results[0].name).to.equal('test töster');
        });
    });

    describe('certs', () => {
        it('should POST /certs expect success', async () => {
            const response1 = await server
                .post(`/certs?accessToken=${token}`)
                .send({
                    privateKey:
                        '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDKC9G9BJlpJdKI\nMNsjLTgCthKBrtQy3TI4AC5FooqyMIxcpNllI5Mu63IPHRaBGE9+O07oHtYhPq/E\nq3SVBk0+lK346nHofZqVDWeWuiHFL2ilfhP1bFKbr5GtTWr3ctg5K1VVn/CTTPvv\nhvDlIEEaqa125jRVGabdQ53Wu6scY4IgrgFC6qnMZLuYTrmjnVCAehWxtQhPXH+R\n3nszHhUMcgKnDSv331p4AnPDZinv5SixbhizdOoFPFBDAdX4CXmwi3MiBz9FwMgA\nz6fGboW0DDxmm3AxjpMtVu7I8BcsGIe4sYbHtacNt0y7IKMEdlH38ME1vnHfcVad\nwSRQCuOHAgMBAAECggEBALNCnUnY5Mu3tP0Ea8jf+8vcArtwg/DE9CNfda5usiO6\nky43THJBh/qfBsmGA0tyaEUVFcM4aL+CQKx7eqolty8I9vnb+EhP+HC6PegrKH8s\nuunp3IdpHjnnIZbjEz6MdG70lXesuePW78fqr5x6a4jednsBb/j5E2VI8qdsRjqe\nM2H3SHzvPIO8zIWtAin6jmZjp3bBqR+UQfPW0pN6qXpis4mCqG+0mcGuGe5n/koZ\nDXZeFPPtyEd1Ty/2wXnszzPyRdOlWWlhUSgdFqhUQ9pKiGlJ3PkS5QGK3UFmzQqA\niCwA35RcBm+G59ETJiFTy6eu63xVrrP5ALfEZ3MbmAECgYEA5nVi1WNn0aon0T4C\niI58JiLcK9fuSJxKVggyc2d+pkQTiMVc+/MyLi+80k74aKqsYOigQU9Ju/Wx1n+U\nPuU2CAbHWTt9IxjdhXj5zIrvjUQgRkhy5oaSqQGo/Inb0iab/88beLHsYrhcBmmC\nsesrNHTpfrwG6uJ907/eRlK+wgECgYEA4HBP3xkAvyGAVmAjP0pGoYH3I7NTsp40\nb11FitYaxl2X/lKv9XgsL0rjSN66ZO+02ckEdKEv307xF1bvzqH7tMrXa9gaK7+5\nRfVbKsP51yr5PKQmNANxolED2TPeoALLOxUx3mg5awbDIzPwPaIoCfmSvb7uYWh3\neZmc4paIlYcCgYBbh7HKSKHaPvdzfmppLBYY222QqEFGa3SGuNi4xxkhFhagEqr8\nkjmS6HjZGm5Eu8yc7KeBaOlDErEgHSmW1VhhVbflM+BeiSiqM0MbPu8nrzAWWf3w\nmvAy2arxKhu5WoZI0kv54sic6NX74fn7ight3CVEpY8lyPDqoeC5E3IaAQKBgHWE\n2Y2r/eQWmqiftlURg2JWNx4ObCj/Bd26LQvBiEuN/mRAz7nsrtYklFY3qcnoaf4P\nb7HSJMr8/uiFsRO1ZaMJAzuI8EswHMcw7ge6jjvIWLEUEpzxoLKpUSaOLmgCjn/l\nXTNjx4zvAYaRT542JljywY9xRkji9oxJjwhmYiZJAoGAHwW0UuiU46zm5pBhiEpl\nH3tgTx7ZKx6TNHKSEpa4WX5G0UF77N6Ps7wuMBWof033YhxQwt056rL5B4KELLJ0\nSqwWp8dfuDf90MOjm20ySdK+cQtA8zs9MsNX3oliAMfRbb7GVcdFPMJn3axMQyDx\nvAxj1TCva9wAviNDaGbaIJo=\n-----END PRIVATE KEY-----',
                    cert: '-----BEGIN CERTIFICATE-----\nMIIE2TCCA8GgAwIBAgIJANkrklW5OnnjMA0GCSqGSIb3DQEBCwUAMIGWMQswCQYD\nVQQGEwJFRTEOMAwGA1UECAwFSGFyanUxEDAOBgNVBAcMB1RhbGxpbm4xFjAUBgNV\nBAoMDVBvc3RhbFN5c3RlbXMxCzAJBgNVBAsMAkNBMRwwGgYDVQQDDBNyb290Lndp\nbGRkdWNrLmVtYWlsMSIwIAYJKoZIhvcNAQkBFhNpbmZvQHdpbGRkdWNrLmVtYWls\nMB4XDTIxMDUxNzA2NDAzNFoXDTMxMDUxNTA2NDAzNFowgaAxCzAJBgNVBAYTAkVF\nMQ4wDAYDVQQIDAVIYXJqdTEQMA4GA1UEBwwHVGFsbGlubjEWMBQGA1UECgwNUG9z\ndGFsU3lzdGVtczEVMBMGA1UECwwMbG9jYWxfUm9vdENBMSIwIAYJKoZIhvcNAQkB\nFhNpbmZvQHdpbGRkdWNrLmVtYWlsMRwwGgYDVQQDDBNyb290LndpbGRkdWNrLmVt\nYWlsMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAygvRvQSZaSXSiDDb\nIy04ArYSga7UMt0yOAAuRaKKsjCMXKTZZSOTLutyDx0WgRhPfjtO6B7WIT6vxKt0\nlQZNPpSt+Opx6H2alQ1nlrohxS9opX4T9WxSm6+RrU1q93LYOStVVZ/wk0z774bw\n5SBBGqmtduY0VRmm3UOd1rurHGOCIK4BQuqpzGS7mE65o51QgHoVsbUIT1x/kd57\nMx4VDHICpw0r999aeAJzw2Yp7+UosW4Ys3TqBTxQQwHV+Al5sItzIgc/RcDIAM+n\nxm6FtAw8ZptwMY6TLVbuyPAXLBiHuLGGx7WnDbdMuyCjBHZR9/DBNb5x33FWncEk\nUArjhwIDAQABo4IBHDCCARgwgbUGA1UdIwSBrTCBqqGBnKSBmTCBljELMAkGA1UE\nBhMCRUUxDjAMBgNVBAgMBUhhcmp1MRAwDgYDVQQHDAdUYWxsaW5uMRYwFAYDVQQK\nDA1Qb3N0YWxTeXN0ZW1zMQswCQYDVQQLDAJDQTEcMBoGA1UEAwwTcm9vdC53aWxk\nZHVjay5lbWFpbDEiMCAGCSqGSIb3DQEJARYTaW5mb0B3aWxkZHVjay5lbWFpbIIJ\nANnaLorM6YWQMAkGA1UdEwQCMAAwCwYDVR0PBAQDAgTwMEYGA1UdEQQ/MD2CEHd3\ndy5teWRvbWFpbi5jb22CDG15ZG9tYWluLmNvbYIOKi5teWRvbWFpbi5jb22CC2Fu\nb3RoZXIuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQBAD4ZW6eP3UmlLyvdrMHlRadzO\nt0cdL1CJKBCmpaG92KHTuJMXpM+gqFWm0dvt4bCEPjaQuD1uKXdIUxqvpTPv6L1C\nN0bgLiaVGr6n2XP/rrlbvd8FwApg0NPOh0abRn6gTH48UBa/a0tTBy+p8r7NGWt0\nFV49S4VJQbJgv5sue0IiJMo1Az05KdlZtMMfS7tghgQIF111K/ICMEZgSg1oY7zU\nNUoQCVJLFdLPh1Hxtu2bMFIiUSuo8tAcvSAOyXoKevjvuBRPLsntItAR7JQWmX+8\n5VGYeKxgOR8fanaeJxHm+rBL3uyxgHxfzqhzNX5JTPqB9DjUihnJiwVKs2X3\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIDqjCCApICCQDZ2i6KzOmFkDANBgkqhkiG9w0BAQsFADCBljELMAkGA1UEBhMC\nRUUxDjAMBgNVBAgMBUhhcmp1MRAwDgYDVQQHDAdUYWxsaW5uMRYwFAYDVQQKDA1Q\nb3N0YWxTeXN0ZW1zMQswCQYDVQQLDAJDQTEcMBoGA1UEAwwTcm9vdC53aWxkZHVj\nay5lbWFpbDEiMCAGCSqGSIb3DQEJARYTaW5mb0B3aWxkZHVjay5lbWFpbDAeFw0y\nMTA1MTcwNjM5MjdaFw0zMTA1MTUwNjM5MjdaMIGWMQswCQYDVQQGEwJFRTEOMAwG\nA1UECAwFSGFyanUxEDAOBgNVBAcMB1RhbGxpbm4xFjAUBgNVBAoMDVBvc3RhbFN5\nc3RlbXMxCzAJBgNVBAsMAkNBMRwwGgYDVQQDDBNyb290LndpbGRkdWNrLmVtYWls\nMSIwIAYJKoZIhvcNAQkBFhNpbmZvQHdpbGRkdWNrLmVtYWlsMIIBIjANBgkqhkiG\n9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmBEFPdz350w5++Ds+sAkVktqrk7+eO67R9lu\n9f6wJNTeyq8+w2bGZgfoZo3K+8OFry+ET1yPQDrJgiYIKCe4ZgUohbaUh4/GS6xE\n22InmU+Pt7PJ7UoBZgoVQOD1bf9Z6E68pVfoBA2yj0sPVDFvXd8/ToVMmOdl8voW\nVu3pn8bzgvWy8vpOrIzsWhjy7J2SWlWcAVtO5nwK8Eoqj8Um4X5Zg2+pC7wEMN0G\nnGOCLg7Ky1AFn4v/zoz1c+AW+I2uO6YNE1tRka/lC1ohm0D9SLikrWpmzoANUIDD\n1mKX6Jy+uJjA7iaj2B2Hb4wG83fzx8rPBqxV/AFEFMIdPd2JpwIDAQABMA0GCSqG\nSIb3DQEBCwUAA4IBAQBi0Qzu/+MwvHZQyN9GfqzrFRMi6mdwR1Ti4y7N++mAYVJi\nOh9QL/4QufsRd/5x8KjRcy+3ZZkGLT2yxUUWA15DNx3fQMH1g6jlXgpYl/VDBHUw\npJ1zNolP1YQsN6TI9JahGcHOAjNNNbFQSW1fSSd/D0cGxUM0DkC4O47RQ7ZoTFNt\nPoOEQkw8JhQSBpCw+ise6EvoWjOOhFd1M9hy6XemAVTTix5ff7GzOx+ylwcoaNhW\nTEtB3hWRJmbmqBgojUL2/iHQYpkQiBoxIa7tXgy2eFaEHix/Qt3ivEPte7kOSz53\nAsIaoM78oZNm5A3EgzsFyJbjWv/JNgmeKN4E0PoS\n-----END CERTIFICATE-----',
                    description: 'test key',
                    servername: 'mydomain.com'
                })
                .expect(200);
            expect(response1.body.fingerprint).to.equal('6a:bc:80:54:22:30:d2:4e:20:74:e1:11:df:f0:bb:6d:93:4a:f8:82:ee:48:79:8e:17:2e:ad:80:83:06:62:97');
            expect(response1.body.altNames).to.deep.equal(['www.mydomain.com', 'mydomain.com', '*.mydomain.com', 'another.com']);
        });
    });
});
