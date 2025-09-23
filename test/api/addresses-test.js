/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0, no-console:0 */

/* globals before: false, after: false */

'use strict';

const supertest = require('supertest');
const chai = require('chai');
const { logTest, logError, logPerformance } = require('../../lib/logger');

const expect = chai.expect;
chai.config.includeStack = true;
const config = require('wild-config');

const server = supertest.agent(`http://127.0.0.1:${config.api.port}`);

describe('API Users', function () {
    this.timeout(10000); // eslint-disable-line no-invalid-this

    let user, user2, forwarded;

    before(async () => {
        // ensure that we have an existing user account
        const response = await server
            .post('/users')
            .send({
                username: 'addressuser',
                password: 'secretvalue',
                address: 'addressuser.addrtest@example.com',
                name: 'address user'
            })
            .expect(200);
        expect(response.body.success).to.be.true;
        expect(response.body.id).to.exist;

        user = response.body.id;

        const response2 = await server
            .post('/users')
            .send({
                username: 'addressuser2',
                password: 'secretvalue',
                address: 'addressuser2.addrtest@example.com',
                name: 'address user 2'
            })
            .expect(200);
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
            const response = await server
                .post(`/users/${user}/addresses`)
                .send({
                    address: `user1.1.addrtest@example.com`,
                    tags: ['TAG1', 'tag2']
                })
                .expect(200);
            expect(response.body.success).to.be.true;

            const response2 = await server
                .post(`/users/${user2}/addresses`)
                .send({
                    address: `user2.1.addrtest@example.com`
                })
                .expect(200);
            expect(response2.body.success).to.be.true;

            const response3 = await server
                .post(`/users/${user}/addresses`)
                .send({
                    address: `user1.2.addrtest@example.com`,
                    tags: ['TAG2', 'tag3']
                })
                .expect(200);

            expect(response3.body.success).to.be.true;

            logTest('should POST /users/{user}/addresses expect success', 'API Addresses', 'PASS', 'Address creation test completed successfully', {
                addressesCreated: 3,
                user1Addresses: 2,
                user2Addresses: 1,
                tagsUsed: ['TAG1', 'tag2', 'TAG2', 'tag3']
            });

            const duration = Date.now() - startTime;
            logPerformance('POST /users/{user}/addresses test', duration, {
                testSuite: 'API Addresses',
                status: 'PASS',
                addressCount: 3
            }, 'Address creation test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should POST /users/{user}/addresses expect success',
                testSuite: 'API Addresses',
                operation: 'address creation'
            }, 'Address creation test failed');
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
            expect(addressListResponse.body.total).to.gt(3);

            const duration = Date.now() - startTime;
            logPerformance('GET /addresses test', duration, {
                testSuite: 'API Addresses',
                status: 'PASS',
                totalAddresses: addressListResponse.body.total
            }, 'Address list test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should GET /addresses expect success',
                testSuite: 'API Addresses',
                operation: 'address list'
            }, 'Address list test failed');
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

            logTest('should GET /addresses expect failure / incorrect query params data', 'API Addresses', 'PASS', 'Address list validation test completed successfully', {
                expectedError: 'InputValidationError',
                actualError: addressListResponse.body.code,
                invalidLimit: -1,
                queryLength: 256
            });

            expect(addressListResponse.body.code).to.be.equal('InputValidationError');

            const duration = Date.now() - startTime;
            logPerformance('GET /addresses validation test', duration, {
                testSuite: 'API Addresses',
                status: 'PASS'
            }, 'Address list validation test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should GET /addresses expect failure / incorrect query params data',
                testSuite: 'API Addresses',
                operation: 'address list validation'
            }, 'Address list validation test failed');
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
            expect(addressListResponse.body.total).to.equal(2);

            const duration = Date.now() - startTime;
            logPerformance('GET /addresses with tags test', duration, {
                testSuite: 'API Addresses',
                status: 'PASS',
                tagsUsed: 2
            }, 'Address list with tags test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should GET /addresses expect success / with tags',
                testSuite: 'API Addresses',
                operation: 'address list with tags'
            }, 'Address list with tags test failed');
            logTest('should GET /addresses expect success / with tags', 'API Addresses', 'FAIL', 'Address list with tags test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /addresses expect success / with required tags', async () => {
        const addressListResponse = await server.get(`/addresses?requiredTags=tag2,tag3`).expect(200);
        expect(addressListResponse.body.success).to.be.true;
        expect(addressListResponse.body.total).to.equal(1);
    });

    it('should GET /addresses expect success / with a user token', async () => {
        const authResponse = await server
            .post('/authenticate')
            .send({
                username: 'addressuser',
                password: 'secretvalue',
                token: true
            })
            .expect(200);

        expect(authResponse.body.success).to.be.true;
        expect(authResponse.body.token).to.exist;

        let token = authResponse.body.token;

        const userListResponse = await server.get(`/addresses?accessToken=${token}`).expect(200);
        expect(userListResponse.body.success).to.be.true;

        expect(userListResponse.body.total).to.equal(3);
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
            expect(addressListResponse.body.results.length).to.equal(3);
            expect(addressListResponse.body.results.filter(addr => addr.main).length).to.equal(1);
            expect(addressListResponse.body.results.find(addr => addr.main).address).to.equal('addressuser.addrtest@example.com');

            const duration = Date.now() - startTime;
            logPerformance('GET /users/{user}/addresses test', duration, {
                testSuite: 'API Addresses',
                status: 'PASS',
                addressCount: 3
            }, 'User addresses list test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should GET /users/{user}/addresses expect success',
                testSuite: 'API Addresses',
                operation: 'user addresses list',
                userId: user
            }, 'User addresses list test failed');
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
        let address = addresses.find(addr => addr.address === 'user1.1.addrtest@example.com').id;

        const response = await server
            .put(`/users/${user}/addresses/${address}`)
            .send({
                main: true
            })
            .expect(200);
        expect(response.body.success).to.be.true;

        addressListResponse = await server.get(`/users/${user}/addresses`).expect(200);
        expect(addressListResponse.body.success).to.be.true;

        expect(addressListResponse.body.results.length).to.equal(3);
        expect(addressListResponse.body.results.filter(addr => addr.main).length).to.equal(1);
        expect(addressListResponse.body.results.find(addr => addr.main).address).to.equal('user1.1.addrtest@example.com');
    });

    it('should DELETE /users/{user}/addresses/{address} expect failure', async () => {
        let addressListResponse = await server.get(`/users/${user}/addresses`).expect(200);
        expect(addressListResponse.body.success).to.be.true;
        let addresses = addressListResponse.body.results;
        let address = addresses.find(addr => addr.main).id;

        // trying to delete a main address should fail
        const response = await server.delete(`/users/${user}/addresses/${address}`).expect(400);
        expect(response.body.code).to.equal('NotPermitted');
    });

    it('should DELETE /users/{user}/addresses/{address} expect success', async () => {
        const startTime = Date.now();
        logTest('should DELETE /users/{user}/addresses/{address} expect success', 'API Addresses', 'START', 'Starting address deletion test');

        try {
            let addressListResponse = await server.get(`/users/${user}/addresses`).expect(200);
            expect(addressListResponse.body.success).to.be.true;
            let addresses = addressListResponse.body.results;
            let address = addresses.find(addr => addr.address === 'user1.2.addrtest@example.com').id;

            const response = await server.delete(`/users/${user}/addresses/${address}`).expect(200);

            logTest('should DELETE /users/{user}/addresses/{address} expect success', 'API Addresses', 'PASS', 'Address deletion test completed successfully', {
                userId: user,
                addressId: address,
                deletedAddress: 'user1.2.addrtest@example.com',
                success: response.body.success
            });

            expect(response.body.success).to.be.true;

            const duration = Date.now() - startTime;
            logPerformance('DELETE /users/{user}/addresses/{address} test', duration, {
                testSuite: 'API Addresses',
                status: 'PASS'
            }, 'Address deletion test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should DELETE /users/{user}/addresses/{address} expect success',
                testSuite: 'API Addresses',
                operation: 'address deletion',
                userId: user
            }, 'Address deletion test failed');
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
                    address: `forwarded.1.addrtest@example.com`,
                    targets: ['andris@ethereal.email'],
                    tags: ['TAG1', 'tag2']
                })
                .expect(200);

            forwarded = response.body.id;

            logTest('should POST /addresses/forwarded expect success', 'API Addresses', 'PASS', 'Forwarded address creation test completed successfully', {
                forwardedId: forwarded,
                address: 'forwarded.1.addrtest@example.com',
                targets: ['andris@ethereal.email'],
                tags: ['TAG1', 'tag2'],
                success: response.body.success
            });

            expect(response.body.success).to.be.true;

            const duration = Date.now() - startTime;
            logPerformance('POST /addresses/forwarded test', duration, {
                testSuite: 'API Addresses',
                status: 'PASS',
                forwardedId: forwarded
            }, 'Forwarded address creation test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should POST /addresses/forwarded expect success',
                testSuite: 'API Addresses',
                operation: 'forwarded address creation'
            }, 'Forwarded address creation test failed');
            logTest('should POST /addresses/forwarded expect success', 'API Addresses', 'FAIL', 'Forwarded address creation test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /addresses expect success / with query', async () => {
        const addressListResponse = await server.get(`/addresses?query=forwarded.1.addrtest`).expect(200);
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

            const addressListResponse = await server.get(`/addresses?query=forwarded.1.addrtest`).expect(200);
            expect(addressListResponse.body.total).to.equal(1);

            logTest('should PUT /addresses/forwarded/{id} expect success', 'API Addresses', 'PASS', 'Forwarded address update test completed successfully', {
                forwardedId: forwarded,
                updatedTags: ['tAG2', 'tAg3'],
                updateSuccess: response.body.success,
                queryResult: addressListResponse.body.total
            });

            const duration = Date.now() - startTime;
            logPerformance('PUT /addresses/forwarded/{id} test', duration, {
                testSuite: 'API Addresses',
                status: 'PASS',
                forwardedId: forwarded
            }, 'Forwarded address update test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should PUT /addresses/forwarded/{id} expect success',
                testSuite: 'API Addresses',
                operation: 'forwarded address update',
                forwardedId: forwarded
            }, 'Forwarded address update test failed');
            logTest('should PUT /addresses/forwarded/{id} expect success', 'API Addresses', 'FAIL', 'Forwarded address update test failed', {
                error: error.message
            });
            throw error;
        }
    });
});
