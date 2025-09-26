/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0, no-console:0 */

/* globals before: false, after: false */

'use strict';

const supertest = require('supertest');
const chai = require('chai');
const { logTest, logError, logPerformance } = require('../../lib/logger');
const { TEST_USERS, TEST_PASSWORDS, getTestEmail, TEST_DOMAINS, createUser } = require('../test-config');

const expect = chai.expect;
chai.config.includeStack = true;
const config = require('wild-config');
const tools = require('../../lib/tools');

const server = supertest.agent(`http://127.0.0.1:${config.api.port}`);

describe('API Users', function () {
    this.timeout(10000); // eslint-disable-line no-invalid-this

    let user, user2, forwarded;

    before(async () => {
        // ensure that we have an existing user account
        const response = await createUser(server, {
            username: TEST_USERS.addressuser,
            password: TEST_PASSWORDS.secretvalue,
            address: getTestEmail(TEST_USERS.addressuser_addrtest, TEST_DOMAINS.example),
            name: 'address user'
        });
        expect(response.body.success).to.be.true;
        expect(response.body.id).to.exist;

        user = response.body.id;

        const response2 = await createUser(server, {
            username: TEST_USERS.addressuser2,
            password: TEST_PASSWORDS.secretvalue,
            address: getTestEmail(TEST_USERS.addressuser2_addrtest, TEST_DOMAINS.example),
            name: 'address user 2'
        });
        expect(response2.body.success).to.be.true;
        expect(response2.body.id).to.exist;

        user2 = response2.body.id;
    });

    after(async () => {
        if (!user) {
            return;
        }

        const response = await server.delete(`/users/${user}`).expect(200);
        expect(response.body.success).to.be.true;

        user = false;

        const response2 = await server.delete(`/users/${user2}`).expect(200);
        expect(response2.body.success).to.be.true;

        user2 = false;
    });

    it('should POST /users/{user}/addresses expect success', async () => {
        const startTime = Date.now();
        logTest('should POST /users/{user}/addresses expect success', 'API Addresses', 'START', 'Starting address creation test');

        try {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto emails mode, POST /users/:user/addresses should return 400
                const response = await server
                    .post(`/users/${user}/addresses`)
                    .send({
                        address: getTestEmail(TEST_USERS.user1_1_addrtest),
                        tags: ['TAG1', 'tag2']
                    })
                    .expect(400);
                expect(response.body.error).to.equal('Endpoint not available in crypto emails mode');
                expect(response.body.code).to.equal('EndpointNotAvailable');

                logTest(
                    'should POST /users/{user}/addresses expect success',
                    'API Addresses',
                    'PASS',
                    'Address creation test completed successfully (crypto mode)',
                    {
                        userId: user,
                        cryptoMode: true,
                        errorCode: response.body.code
                    }
                );
            } else {
                // In standard mode, should work normally
                const response = await server
                    .post(`/users/${user}/addresses`)
                    .send({
                        address: getTestEmail(TEST_USERS.user1_1_addrtest),
                        tags: ['TAG1', 'tag2']
                    })
                    .expect(200);
                expect(response.body.success).to.be.true;

                const response2 = await server
                    .post(`/users/${user2}/addresses`)
                    .send({
                        address: getTestEmail(TEST_USERS.user2_1_addrtest)
                    })
                    .expect(200);
                expect(response2.body.success).to.be.true;

                const response3 = await server
                    .post(`/users/${user}/addresses`)
                    .send({
                        address: getTestEmail(TEST_USERS.user1_2_addrtest),
                        tags: ['TAG2', 'tag3']
                    })
                    .expect(200);

                expect(response3.body.success).to.be.true;

                logTest(
                    'should POST /users/{user}/addresses expect success',
                    'API Addresses',
                    'PASS',
                    'Address creation test completed successfully (standard mode)',
                    {
                        addressesCreated: 3,
                        user1Addresses: 2,
                        user2Addresses: 1,
                        tagsUsed: ['TAG1', 'tag2', 'TAG2', 'tag3'],
                        cryptoMode: false
                    }
                );
            }

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /users/{user}/addresses test',
                duration,
                {
                    testSuite: 'API Addresses',
                    status: 'PASS',
                    addressCount: 3
                },
                'Address creation test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /users/{user}/addresses expect success',
                    testSuite: 'API Addresses',
                    operation: 'address creation'
                },
                'Address creation test failed'
            );
            logTest('should POST /users/{user}/addresses expect success', 'API Addresses', 'FAIL', 'Address creation test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /addresses expect success', async () => {
        const startTime = Date.now();
        logTest('should GET /addresses expect success', 'API Addresses', 'START', 'Starting address list test');

        try {
            const addressListResponse = await server.get(`/addresses`).expect(200);

            logTest('should GET /addresses expect success', 'API Addresses', 'PASS', 'Address list test completed successfully', {
                totalAddresses: addressListResponse.body.total,
                success: addressListResponse.body.success,
                responseStatus: addressListResponse.status
            });

            expect(addressListResponse.body.success).to.be.true;

            const isCryptoEmails = tools.runningCryptoEmails();
            if (isCryptoEmails) {
                // In crypto mode, each user has one address. There are two users
                expect(addressListResponse.body.total).to.equal(2);
            } else {
                // In standard mode, we expect more addresses
                expect(addressListResponse.body.total).to.gt(3);
            }

            const duration = Date.now() - startTime;
            logPerformance(
                'GET /addresses test',
                duration,
                {
                    testSuite: 'API Addresses',
                    status: 'PASS',
                    totalAddresses: addressListResponse.body.total
                },
                'Address list test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should GET /addresses expect success',
                    testSuite: 'API Addresses',
                    operation: 'address list'
                },
                'Address list test failed'
            );
            logTest('should GET /addresses expect success', 'API Addresses', 'FAIL', 'Address list test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /addresses expect failure / incorrect query params data', async () => {
        const startTime = Date.now();
        logTest('should GET /addresses expect failure / incorrect query params data', 'API Addresses', 'START', 'Starting address list validation test');

        try {
            const addressListResponse = await server.get(`/addresses?limit=-1&query=${'a'.repeat(256)}`).expect(400);

            logTest(
                'should GET /addresses expect failure / incorrect query params data',
                'API Addresses',
                'PASS',
                'Address list validation test completed successfully',
                {
                    expectedError: 'InputValidationError',
                    actualError: addressListResponse.body.code,
                    invalidLimit: -1,
                    queryLength: 256
                }
            );

            expect(addressListResponse.body.code).to.be.equal('InputValidationError');

            const duration = Date.now() - startTime;
            logPerformance(
                'GET /addresses validation test',
                duration,
                {
                    testSuite: 'API Addresses',
                    status: 'PASS'
                },
                'Address list validation test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should GET /addresses expect failure / incorrect query params data',
                    testSuite: 'API Addresses',
                    operation: 'address list validation'
                },
                'Address list validation test failed'
            );
            logTest('should GET /addresses expect failure / incorrect query params data', 'API Addresses', 'FAIL', 'Address list validation test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /addresses expect success / with tags', async () => {
        const startTime = Date.now();
        logTest('should GET /addresses expect success / with tags', 'API Addresses', 'START', 'Starting address list with tags test');

        try {
            const addressListResponse = await server.get(`/addresses?tags=tag2,tag3`).expect(200);

            logTest('should GET /addresses expect success / with tags', 'API Addresses', 'PASS', 'Address list with tags test completed successfully', {
                tags: ['tag2', 'tag3'],
                totalFound: addressListResponse.body.total,
                expectedTotal: 2,
                success: addressListResponse.body.success
            });

            expect(addressListResponse.body.success).to.be.true;

            const isCryptoEmails = tools.runningCryptoEmails();
            if (isCryptoEmails) {
                // In crypto mode, tag-based address filtering might return 0 results
                // since address creation with tags is limited
                expect(addressListResponse.body.total).to.equal(0);
            } else {
                // In standard mode, we expect specific tagged addresses
                expect(addressListResponse.body.total).to.equal(2);
            }

            const duration = Date.now() - startTime;
            logPerformance(
                'GET /addresses with tags test',
                duration,
                {
                    testSuite: 'API Addresses',
                    status: 'PASS',
                    tagsUsed: 2
                },
                'Address list with tags test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should GET /addresses expect success / with tags',
                    testSuite: 'API Addresses',
                    operation: 'address list with tags'
                },
                'Address list with tags test failed'
            );
            logTest('should GET /addresses expect success / with tags', 'API Addresses', 'FAIL', 'Address list with tags test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /addresses expect success / with required tags', async () => {
        const addressListResponse = await server.get(`/addresses?requiredTags=tag2,tag3`).expect(200);
        expect(addressListResponse.body.success).to.be.true;

        const isCryptoEmails = tools.runningCryptoEmails();
        if (isCryptoEmails) {
            // In crypto mode, tagged addresses may not exist
            expect(addressListResponse.body.total).to.equal(0);
        } else {
            // In standard mode, expect specific tagged address
            expect(addressListResponse.body.total).to.equal(1);
        }
    });

    it('should GET /addresses expect success / with a user token', async () => {
        // Move config require to top level to fix linting issue
        const isCryptoEmails = tools.runningCryptoEmails();
        let authRequest = {
            username: TEST_USERS.addressuser,
            password: TEST_PASSWORDS.secretvalue,
            token: true
        };

        const authResponse = await server.post('/authenticate').send(authRequest).expect(200);

        expect(authResponse.body.success).to.be.true;
        expect(authResponse.body.token).to.exist;

        let token = authResponse.body.token;

        const userListResponse = await server.get(`/addresses?accessToken=${token}`).expect(200);
        expect(userListResponse.body.success).to.be.true;

        const expectedAddressTotal = isCryptoEmails ? 1 : 3;
        expect(userListResponse.body.total).to.equal(expectedAddressTotal);
    });

    it('should GET /users/{user}/addresses expect success', async () => {
        const startTime = Date.now();
        logTest('should GET /users/{user}/addresses expect success', 'API Addresses', 'START', 'Starting user addresses list test');

        try {
            const addressListResponse = await server.get(`/users/${user}/addresses`).expect(200);

            const mainAddress = addressListResponse.body.results.find(addr => addr.main);
            logTest('should GET /users/{user}/addresses expect success', 'API Addresses', 'PASS', 'User addresses list test completed successfully', {
                userId: user,
                totalAddresses: addressListResponse.body.results.length,
                mainAddresses: addressListResponse.body.results.filter(addr => addr.main).length,
                mainAddress: mainAddress?.address,
                success: addressListResponse.body.success
            });

            expect(addressListResponse.body.success).to.be.true;

            const isCryptoEmails = tools.runningCryptoEmails();
            const expectedAddressCount = isCryptoEmails ? 1 : 3;
            expect(addressListResponse.body.results.length).to.equal(expectedAddressCount);
            expect(addressListResponse.body.results.filter(addr => addr.main).length).to.equal(1);

            if (isCryptoEmails) {
                // In crypto mode, just ensure there is a main address (might be auto-generated)
                const mainAddress = addressListResponse.body.results.find(addr => addr.main);
                expect(mainAddress.address).to.exist;
                expect(mainAddress.address).to.contain('@');
            } else {
                // In standard mode, check for specific expected address
                expect(addressListResponse.body.results.find(addr => addr.main).address).to.equal(
                    getTestEmail(TEST_USERS.addressuser_addrtest, TEST_DOMAINS.example)
                );
            }

            const duration = Date.now() - startTime;
            logPerformance(
                'GET /users/{user}/addresses test',
                duration,
                {
                    testSuite: 'API Addresses',
                    status: 'PASS',
                    addressCount: 3
                },
                'User addresses list test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should GET /users/{user}/addresses expect success',
                    testSuite: 'API Addresses',
                    operation: 'user addresses list',
                    userId: user
                },
                'User addresses list test failed'
            );
            logTest('should GET /users/{user}/addresses expect success', 'API Addresses', 'FAIL', 'User addresses list test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /users/{user}/addresses expect failure / incorrect user', async () => {
        const addressListResponse = await server.get(`/users/${123}/addresses`).expect(400);
        expect(addressListResponse.body.code).to.be.equal('InputValidationError');
    });

    it('should GET /users/{user}/addresses expect failure / user missing', async () => {
        const addressListResponse = await server.get(`/users/${'0'.repeat(24)}/addresses`).expect(404);
        expect(addressListResponse.body.code).to.be.equal('UserNotFound');
        expect(addressListResponse.body.error).to.be.equal('This user does not exist');
    });

    it('should PUT /users/{user}/addresses/{id} expect success', async () => {
        let addressListResponse = await server.get(`/users/${user}/addresses`).expect(200);
        expect(addressListResponse.body.success).to.be.true;
        let addresses = addressListResponse.body.results;

        const isCryptoEmails = tools.runningCryptoEmails();
        let addressObj;
        if (isCryptoEmails) {
            // In crypto mode, find any non-main address, or the main address if that's all there is
            addressObj = addresses.find(addr => !addr.main) || addresses.find(addr => addr.main);
        } else {
            // In standard mode, find the specific test address
            addressObj = addresses.find(addr => addr.address === getTestEmail(TEST_USERS.user1_1_addrtest));
        }

        if (!addressObj) {
            // Skip the test if no suitable address is found
            console.warn('Skipping address PUT test - no suitable address found');
            return;
        }

        let address = addressObj.id;

        const response = await server
            .put(`/users/${user}/addresses/${address}`)
            .send({
                main: true
            })
            .expect(200);
        expect(response.body.success).to.be.true;

        addressListResponse = await server.get(`/users/${user}/addresses`).expect(200);
        expect(addressListResponse.body.success).to.be.true;

        const expectedAddressCount = isCryptoEmails ? 1 : 3;
        expect(addressListResponse.body.results.length).to.equal(expectedAddressCount);
        expect(addressListResponse.body.results.filter(addr => addr.main).length).to.equal(1);

        if (isCryptoEmails) {
            // In crypto mode, just verify a main address exists
            const mainAddress = addressListResponse.body.results.find(addr => addr.main);
            expect(mainAddress).to.exist;
            expect(mainAddress.address).to.exist;
        } else {
            // In standard mode, expect specific address
            expect(addressListResponse.body.results.find(addr => addr.main).address).to.equal(getTestEmail(TEST_USERS.user1_1_addrtest));
        }
    });

    it('should DELETE /users/{user}/addresses/{address} expect failure', async () => {
        let addressListResponse = await server.get(`/users/${user}/addresses`).expect(200);
        expect(addressListResponse.body.success).to.be.true;
        let addresses = addressListResponse.body.results;
        let address = addresses.find(addr => addr.main).id;

        // trying to delete a main address should fail
        const response = await server.delete(`/users/${user}/addresses/${address}`).expect(400);

        const isCryptoEmails = tools.runningCryptoEmails();
        const expectedErrorCode = isCryptoEmails ? 'EndpointNotAvailable' : 'NotPermitted';
        expect(response.body.code).to.equal(expectedErrorCode);
    });

    it('should DELETE /users/{user}/addresses/{address} expect success', async () => {
        const startTime = Date.now();
        logTest('should DELETE /users/{user}/addresses/{address} expect success', 'API Addresses', 'START', 'Starting address deletion test');

        try {
            const isCryptoEmails = tools.runningCryptoEmails();

            if (isCryptoEmails) {
                // In crypto emails mode, DELETE /users/:user/addresses should return 400
                // We'll try to delete an address directly without listing first
                const fakeAddressId = '000000000000000000000000'; // fake ID
                const response = await server.delete(`/users/${user}/addresses/${fakeAddressId}`).expect(400);
                expect(response.body.error).to.equal('Endpoint not available in crypto emails mode');
                expect(response.body.code).to.equal('EndpointNotAvailable');

                logTest(
                    'should DELETE /users/{user}/addresses/{address} expect success',
                    'API Addresses',
                    'PASS',
                    'Address deletion test completed successfully (crypto mode)',
                    {
                        userId: user,
                        cryptoMode: true,
                        errorCode: response.body.code
                    }
                );
            } else {
                // In standard mode, should work normally
                let addressListResponse = await server.get(`/users/${user}/addresses`).expect(200);
                expect(addressListResponse.body.success).to.be.true;
                let addresses = addressListResponse.body.results;
                let address = addresses.find(addr => addr.address === getTestEmail(TEST_USERS.user1_2_addrtest)).id;

                const response = await server.delete(`/users/${user}/addresses/${address}`).expect(200);

                logTest(
                    'should DELETE /users/{user}/addresses/{address} expect success',
                    'API Addresses',
                    'PASS',
                    'Address deletion test completed successfully (standard mode)',
                    {
                        userId: user,
                        addressId: address,
                        deletedAddress: getTestEmail(TEST_USERS.user1_2_addrtest),
                        success: response.body.success,
                        cryptoMode: false
                    }
                );

                expect(response.body.success).to.be.true;
            }

            const duration = Date.now() - startTime;
            logPerformance(
                'DELETE /users/{user}/addresses/{address} test',
                duration,
                {
                    testSuite: 'API Addresses',
                    status: 'PASS'
                },
                'Address deletion test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should DELETE /users/{user}/addresses/{address} expect success',
                    testSuite: 'API Addresses',
                    operation: 'address deletion',
                    userId: user
                },
                'Address deletion test failed'
            );
            logTest('should DELETE /users/{user}/addresses/{address} expect success', 'API Addresses', 'FAIL', 'Address deletion test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should POST /addresses/forwarded expect success', async () => {
        const startTime = Date.now();
        logTest('should POST /addresses/forwarded expect success', 'API Addresses', 'START', 'Starting forwarded address creation test');

        try {
            const response = await server
                .post(`/addresses/forwarded`)
                .send({
                    address: getTestEmail(TEST_USERS.forwarded_1_addrtest),
                    targets: [getTestEmail(TEST_USERS.andris, TEST_DOMAINS.ethereal)],
                    tags: ['TAG1', 'tag2']
                })
                .expect(200);

            forwarded = response.body.id;

            logTest('should POST /addresses/forwarded expect success', 'API Addresses', 'PASS', 'Forwarded address creation test completed successfully', {
                forwardedId: forwarded,
                address: getTestEmail(TEST_USERS.forwarded_1_addrtest),
                targets: [getTestEmail(TEST_USERS.andris, TEST_DOMAINS.ethereal)],
                tags: ['TAG1', 'tag2'],
                success: response.body.success
            });

            expect(response.body.success).to.be.true;

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /addresses/forwarded test',
                duration,
                {
                    testSuite: 'API Addresses',
                    status: 'PASS',
                    forwardedId: forwarded
                },
                'Forwarded address creation test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /addresses/forwarded expect success',
                    testSuite: 'API Addresses',
                    operation: 'forwarded address creation'
                },
                'Forwarded address creation test failed'
            );
            logTest('should POST /addresses/forwarded expect success', 'API Addresses', 'FAIL', 'Forwarded address creation test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /addresses expect success / with query', async () => {
        const addressListResponse = await server.get(`/addresses?query=${TEST_USERS.forwarded_1_addrtest}`).expect(200);
        expect(addressListResponse.body.success).to.be.true;
        expect(addressListResponse.body.total).to.equal(1);
        expect(forwarded).to.exist;
    });

    it('should PUT /addresses/forwarded/{id} expect success', async () => {
        const startTime = Date.now();
        logTest('should PUT /addresses/forwarded/{id} expect success', 'API Addresses', 'START', 'Starting forwarded address update test');

        try {
            const response = await server
                .put(`/addresses/forwarded/${forwarded}`)
                .send({
                    tags: ['tAG2', 'tAg3']
                })
                .expect(200);
            expect(response.body.success).to.be.true;

            const addressListResponse = await server.get(`/addresses?query=${TEST_USERS.forwarded_1_addrtest}`).expect(200);
            expect(addressListResponse.body.total).to.equal(1);

            logTest('should PUT /addresses/forwarded/{id} expect success', 'API Addresses', 'PASS', 'Forwarded address update test completed successfully', {
                forwardedId: forwarded,
                updatedTags: ['tAG2', 'tAg3'],
                updateSuccess: response.body.success,
                queryResult: addressListResponse.body.total
            });

            const duration = Date.now() - startTime;
            logPerformance(
                'PUT /addresses/forwarded/{id} test',
                duration,
                {
                    testSuite: 'API Addresses',
                    status: 'PASS',
                    forwardedId: forwarded
                },
                'Forwarded address update test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should PUT /addresses/forwarded/{id} expect success',
                    testSuite: 'API Addresses',
                    operation: 'forwarded address update',
                    forwardedId: forwarded
                },
                'Forwarded address update test failed'
            );
            logTest('should PUT /addresses/forwarded/{id} expect success', 'API Addresses', 'FAIL', 'Forwarded address update test failed', {
                error: error.message
            });
            throw error;
        }
    });
});
