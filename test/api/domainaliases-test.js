/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0, no-console:0 */

'use strict';

const supertest = require('supertest');
const chai = require('chai');
const { logTest, logError, logPerformance } = require('../../lib/logger');

const expect = chai.expect;
chai.config.includeStack = true;
const config = require('wild-config');

const server = supertest.agent(`http://127.0.0.1:${config.api.port}`);

describe('API DomainAliases', function () {
    let domainalias;

    this.timeout(10000); // eslint-disable-line no-invalid-this

    it('should POST /domainaliases expect success', async () => {
        const startTime = Date.now();
        logTest('should POST /domainaliases expect success', 'API DomainAliases', 'START', 'Starting domain alias creation test');

        try {
            const response = await server
                .post('/domainaliases')
                .send({
                    domain: 'example.com',
                    alias: 'alias.example.com',
                    sess: '12345',
                    ip: '127.0.0.1'
                })
                .expect(200);

            domainalias = response.body.id;

            logTest('should POST /domainaliases expect success', 'API DomainAliases', 'PASS', 'Domain alias creation test completed successfully', {
                domainAliasId: domainalias,
                domain: 'example.com',
                alias: 'alias.example.com',
                success: response.body.success
            });

            expect(response.body.success).to.be.true;
            expect(/^[0-9a-f]{24}$/.test(response.body.id)).to.be.true;

            const duration = Date.now() - startTime;
            logPerformance(
                'POST /domainaliases test',
                duration,
                {
                    testSuite: 'API DomainAliases',
                    status: 'PASS',
                    domainAliasId: domainalias
                },
                'Domain alias creation test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should POST /domainaliases expect success',
                    testSuite: 'API DomainAliases',
                    operation: 'domain alias creation'
                },
                'Domain alias creation test failed'
            );
            logTest('should POST /domainaliases expect success', 'API DomainAliases', 'FAIL', 'Domain alias creation test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /domainaliases/:alias expect success', async () => {
        const response = await server.get(`/domainaliases/${domainalias}`).expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.id).to.equal(domainalias);
    });

    it('should GET /domainaliases/resolve/:alias expect success', async () => {
        const response = await server.get(`/domainaliases/resolve/alias.example.com`).expect(200);
        expect(response.body.success).to.be.true;
        expect(response.body.id).to.equal(domainalias);
    });

    it('should GET /domainaliases expect success', async () => {
        const response = await server.get(`/domainaliases?query=alias.example.com`).expect(200);

        expect(response.body.success).to.be.true;
        expect(response.body.results.length).to.gte(1);
        expect(response.body.results.find(entry => entry.id === domainalias)).to.exist;
    });

    it('should DELETE /domainaliases/:alias expect success', async () => {
        const startTime = Date.now();
        logTest('should DELETE /domainaliases/:alias expect success', 'API DomainAliases', 'START', 'Starting domain alias deletion test');

        try {
            const response = await server.delete(`/domainaliases/${domainalias}`).expect(200);

            logTest('should DELETE /domainaliases/:alias expect success', 'API DomainAliases', 'PASS', 'Domain alias deletion test completed successfully', {
                domainAliasId: domainalias,
                success: response.body.success,
                responseStatus: response.status
            });

            expect(response.body.success).to.be.true;

            const duration = Date.now() - startTime;
            logPerformance(
                'DELETE /domainaliases/:alias test',
                duration,
                {
                    testSuite: 'API DomainAliases',
                    status: 'PASS',
                    domainAliasId: domainalias
                },
                'Domain alias deletion test performance measured'
            );
        } catch (error) {
            logError(
                error,
                {
                    testName: 'should DELETE /domainaliases/:alias expect success',
                    testSuite: 'API DomainAliases',
                    operation: 'domain alias deletion',
                    domainAliasId: domainalias
                },
                'Domain alias deletion test failed'
            );
            logTest('should DELETE /domainaliases/:alias expect success', 'API DomainAliases', 'FAIL', 'Domain alias deletion test failed', {
                error: error.message
            });
            throw error;
        }
    });
});
