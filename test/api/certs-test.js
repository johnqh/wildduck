/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0, no-console:0 */

'use strict';

const supertest = require('supertest');
const chai = require('chai');
const { logTest, logError, logPerformance } = require('../../lib/logger');

const expect = chai.expect;
chai.config.includeStack = true;
const config = require('wild-config');

const server = supertest.agent(`http://127.0.0.1:${config.api.port}`);

describe('API Certs', function () {
    let cert;

    this.timeout(10000); // eslint-disable-line no-invalid-this

    it('should POST /certs expect success', async () => {
        const startTime = Date.now();
        logTest('should POST /certs expect success', 'API Certs', 'START', 'Starting certificate creation test');

        try {
            const response = await server
                .post('/certs')
                .send({
                    servername: 'example.com',
                    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDUwsIjU4ItLme5
8bhvsdU3ifpYxCA0sz1GaDnUIeH62JW1XLR5dM9yh1vNCZNeMnZ2YASA7dh1+SNT
J8O46OWaIaDMt3PqBeYs8seuJDiHc1kZtsXWaoKQpeA0LkQsDMTpHm/m2j4lpMeI
+c0GjEcYYYupnbJPxfMW9Xzxmer7p1SduKl5g9x0Izicv6ZvuBnQSpaYQUruqIXU
CdK7RAVUinNU2Bjik/bg773CXvCgEf4QpJQdOMaGB45MWs61x3yv+qoIE7oSE36/
RsstJC9NbnavFhheitvc8rPJchq7LWMdADD/C/OdYXM3j9AyVdAbCMYpgcOLNdmG
+mGZUKexAgMBAAECggEBAMsH/9NOQY90FS/wZ5zPCzUwymIi5sjjsrmZhHXWz5td
S6ACk4bD3aLhYM1NMgBWD43vGt0eG86YrQkRjUjLly96n8Q73LWaY4jJNZwMnJVF
keVj8W8nvOjkIgwpioyussnzbb3SzjOGB5PDLc/t1XqCu5BlGF/f+pYSNeUoiIET
8xCMLQ7yWyTA7b8mL3Lx+ZJsW4nbugK7FwOnRktK+RQlAPiJsLCzFL+9AZPRrMom
Tq0z5F7iYGet5vdc/3IiEDG0sH7H51Gtjbc0sLT901Faw+fw2Ca9C6tuR30SFuNY
8SPt4ETViVdueSjuAzCnDAqjeHm7H9lWb8GGjXBfjHECgYEA92lxgXb6xwNSQ9Rx
1bCjlpoLNPvbxUYiKBeCNGUor5i1aLWd8hbF6nMCx6/2AzOFCzK1WxKEFfreY3bG
IyiJxxFYCWNoS2+dCM0IbbC4oY1VQzbagv3V8gGCh8to47dUDBV8nNE8Iqi03Hpk
WDVqk3jnzUQ77IYTcPjHCm+uw2sCgYEA3CVlxKiyRV6f/TboSfio8+jCm2Z/eYP1
UoaWBOwdpFzsOMn74MXtfwQhDm6tf0vjnEDFWWrS0d8lxGV4rSCMJT0o+sgZrs/2
D+MSZxLyqq+NewsqaEU6Hl13/Ic09xIP2Gz8Fk36ddl6f/MO9j/pAdhxF21jNSIW
/dlxnPvU5FMCgYEAt5TpIUyctlEzmJspwIsqR5SUHkOIBnCM5bzT43bwYqNocILa
6QiW4OloNa3OWP/Ah9eflC1AD2Mv4xP935az7R9keMrnV5pBJoek6meICG/rxU0N
hMc/Giyeo45+jQG6fqDu7xmeioUudq7miEFSjIzZS4mHAXFXOauPXaITRnMCgYA5
JSwJpJDCGRIGtN4PdZDF38HEfRLSBEMGLRF8LZ50L/rRsvzDGB3SPswl5uz6gkSP
JvETiPs4p2gyVvTAXBaFBB9DGfYwvqLs9NCuGOkNDYz4R6m2b2Hqx/CBiMdi6zlZ
wNCfKZa+SLnXxMw5d9WQORMCNc7u1+6H7o3jZiuZKQKBgF92xcje7ROjMas6bLru
XzoNjcESSn09LuY0Jmm6eq927QPWvr7HGpvHZJCtsoPhSAqoVVL2f4SlDfxko+NG
5RD9W3AE6jSBumZSpGD+3Pm1p/3fRAbrfOcKJai9O9/K3ZQi3aSQgRQgAhAUZ1C4
gWkJtB9ZKR6nboyDYCFNjfYw
-----END PRIVATE KEY-----
`,
                    cert: `-----BEGIN CERTIFICATE-----
MIIDADCCAegCCQCPXSqvTzty/zANBgkqhkiG9w0BAQsFADBCMRQwEgYDVQQDDAtl
eGFtcGxlLmNvbTEdMBsGA1UECgwUTXkgQ29tcGFueSBOYW1lIExURC4xCzAJBgNV
BAYTAlVTMB4XDTIxMTEzMDEzMjUyOFoXDTIyMTEzMDEzMjUyOFowQjEUMBIGA1UE
AwwLZXhhbXBsZS5jb20xHTAbBgNVBAoMFE15IENvbXBhbnkgTmFtZSBMVEQuMQsw
CQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANTCwiNT
gi0uZ7nxuG+x1TeJ+ljEIDSzPUZoOdQh4frYlbVctHl0z3KHW80Jk14ydnZgBIDt
2HX5I1Mnw7jo5ZohoMy3c+oF5izyx64kOIdzWRm2xdZqgpCl4DQuRCwMxOkeb+ba
PiWkx4j5zQaMRxhhi6mdsk/F8xb1fPGZ6vunVJ24qXmD3HQjOJy/pm+4GdBKlphB
Su6ohdQJ0rtEBVSKc1TYGOKT9uDvvcJe8KAR/hCklB04xoYHjkxazrXHfK/6qggT
uhITfr9Gyy0kL01udq8WGF6K29zys8lyGrstYx0AMP8L851hczeP0DJV0BsIximB
w4s12Yb6YZlQp7ECAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAxpun+z6fLOW8xlWx
ej7XUmaI5emFC6wFSaGh3022ASvqS8TOR9qnY9yN+a1notLyqIiKUvoY4uvjPpk8
OAcMa6e7NRjsBQ/Zry3dxC88CCs4oR0SHeKy/4d3VmqUax5Ufn+X1+in+Sb4FDBD
rDnBTi9TJnAo8JMQ7FwkBFnMsieelX9IXLSsFE0yhz0U97r9B0JFcUEP0OsY9Tz0
NbFXanIpFENKxoXRzAvq0XlE3p446wIiUlIle/PXQpOx8s5Ae0eEmX0/2DY+1MZs
nBhCzyAvD7Z2TQjrszlbekiIeqTgN/D+r7WWJ3Urpf2NdfLOGNWTDe9cVgZlR85n
rp+tEw==
-----END CERTIFICATE-----
`,
                    description: 'Some text about this certificate',
                    sess: '12345',
                    ip: '127.0.0.1'
                })
                .expect(200);

            cert = response.body.id;

            logTest('should POST /certs expect success', 'API Certs', 'PASS', 'Certificate creation test completed successfully', {
                certId: cert,
                servername: response.body.servername,
                altNames: response.body.altNames,
                success: response.body.success,
                description: 'Some text about this certificate'
            });

            expect(response.body.success).to.be.true;
            expect(/^[0-9a-f]{24}$/.test(response.body.id)).to.be.true;
            expect(response.body.servername).to.equal('example.com');
            expect(response.body.altNames).to.deep.equal(['example.com']);

            const duration = Date.now() - startTime;
            logPerformance('POST /certs test', duration, {
                testSuite: 'API Certs',
                status: 'PASS',
                certId: cert
            }, 'Certificate creation test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should POST /certs expect success',
                testSuite: 'API Certs',
                operation: 'certificate creation'
            }, 'Certificate creation test failed');
            logTest('should POST /certs expect success', 'API Certs', 'FAIL', 'Certificate creation test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /certs/:cert expect success', async () => {
        const startTime = Date.now();
        logTest('should GET /certs/:cert expect success', 'API Certs', 'START', 'Starting certificate details test');

        try {
            const response = await server.get(`/certs/${cert}`).expect(200);

            logTest('should GET /certs/:cert expect success', 'API Certs', 'PASS', 'Certificate details test completed successfully', {
                certId: cert,
                responseId: response.body.id,
                success: response.body.success,
                responseStatus: response.status
            });

            expect(response.body.success).to.be.true;
            expect(response.body.id).to.equal(cert);

            const duration = Date.now() - startTime;
            logPerformance('GET /certs/:cert test', duration, {
                testSuite: 'API Certs',
                status: 'PASS',
                certId: cert
            }, 'Certificate details test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should GET /certs/:cert expect success',
                testSuite: 'API Certs',
                operation: 'certificate details',
                certId: cert
            }, 'Certificate details test failed');
            logTest('should GET /certs/:cert expect success', 'API Certs', 'FAIL', 'Certificate details test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /certs/resolve/:servername expect success', async () => {
        const startTime = Date.now();
        logTest('should GET /certs/resolve/:servername expect success', 'API Certs', 'START', 'Starting certificate resolve test');

        try {
            const response = await server.get(`/certs/resolve/example.com`).expect(200);

            logTest('should GET /certs/resolve/:servername expect success', 'API Certs', 'PASS', 'Certificate resolve test completed successfully', {
                servername: 'example.com',
                resolvedCertId: response.body.id,
                expectedCertId: cert,
                success: response.body.success
            });

            expect(response.body.success).to.be.true;
            expect(response.body.id).to.equal(cert);

            const duration = Date.now() - startTime;
            logPerformance('GET /certs/resolve test', duration, {
                testSuite: 'API Certs',
                status: 'PASS',
                servername: 'example.com'
            }, 'Certificate resolve test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should GET /certs/resolve/:servername expect success',
                testSuite: 'API Certs',
                operation: 'certificate resolve',
                servername: 'example.com'
            }, 'Certificate resolve test failed');
            logTest('should GET /certs/resolve/:servername expect success', 'API Certs', 'FAIL', 'Certificate resolve test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should GET /certs expect success', async () => {
        const startTime = Date.now();
        logTest('should GET /certs expect success', 'API Certs', 'START', 'Starting certificates list test');

        try {
            const response = await server.get(`/certs`).expect(200);

            const foundCert = response.body.results.find(entry => entry.id === cert);
            logTest('should GET /certs expect success', 'API Certs', 'PASS', 'Certificates list test completed successfully', {
                totalCertificates: response.body.results.length,
                foundTargetCert: !!foundCert,
                certId: cert,
                success: response.body.success
            });

            expect(response.body.success).to.be.true;
            expect(response.body.results.length).to.gte(1);
            expect(response.body.results.find(entry => entry.id === cert)).to.exist;

            const duration = Date.now() - startTime;
            logPerformance('GET /certs test', duration, {
                testSuite: 'API Certs',
                status: 'PASS',
                certificateCount: response.body.results.length
            }, 'Certificates list test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should GET /certs expect success',
                testSuite: 'API Certs',
                operation: 'certificates list'
            }, 'Certificates list test failed');
            logTest('should GET /certs expect success', 'API Certs', 'FAIL', 'Certificates list test failed', {
                error: error.message
            });
            throw error;
        }
    });

    it('should DELETE /certs/:certs expect success', async () => {
        const startTime = Date.now();
        logTest('should DELETE /certs/:certs expect success', 'API Certs', 'START', 'Starting certificate deletion test');

        try {
            const response = await server.delete(`/certs/${cert}`).expect(200);

            logTest('should DELETE /certs/:certs expect success', 'API Certs', 'PASS', 'Certificate deletion test completed successfully', {
                certId: cert,
                success: response.body.success,
                responseStatus: response.status
            });

            expect(response.body.success).to.be.true;

            const duration = Date.now() - startTime;
            logPerformance('DELETE /certs/:cert test', duration, {
                testSuite: 'API Certs',
                status: 'PASS',
                certId: cert
            }, 'Certificate deletion test performance measured');

        } catch (error) {
            logError(error, {
                testName: 'should DELETE /certs/:certs expect success',
                testSuite: 'API Certs',
                operation: 'certificate deletion',
                certId: cert
            }, 'Certificate deletion test failed');
            logTest('should DELETE /certs/:certs expect success', 'API Certs', 'FAIL', 'Certificate deletion test failed', {
                error: error.message
            });
            throw error;
        }
    });
});
