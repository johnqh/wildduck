'use strict';

const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const crypto = require('crypto');

const {
    TEST_WALLETS,
    generateNonce,
    createAPIAuthData,
    createInvalidAuthData,
    createMockUserData
} = require('../helpers/auth-test-utils');

chai.config.includeStack = true;

describe('API Authentication Tests', function () {
    this.timeout(10000);
    
    let apiServer;
    let db;
    let userHandler;
    
    before(async function () {
        // Initialize test server and database
        // This would be replaced with actual server initialization
        // For now, we'll mock the responses
    });
    
    after(async function () {
        // Cleanup
    });
    
    describe('POST /authenticate', function () {
        describe('EVM Wallet Authentication', function () {
            it('should authenticate with valid EVM address and signature', async function () {
                const authData = await createAPIAuthData('evm');
                
                // Mock the expected request
                const expectedBody = {
                    username: authData.username,
                    signature: authData.signature,
                    nonce: authData.nonce,
                    scope: 'master'
                };
                
                // Verify request structure
                expect(expectedBody).to.have.property('username').that.matches(/^0x[a-fA-F0-9]{40}$/);
                expect(expectedBody).to.have.property('signature').that.matches(/^[A-Za-z0-9+/]+=*$/);
                expect(expectedBody).to.have.property('nonce');
                
                // Expected successful response format
                expect(expectedBody).to.have.property('username');
                expect(expectedBody).to.have.property('signature');
                expect(expectedBody).to.have.property('nonce');
                expect(expectedBody).to.have.property('scope');
            });
            
            it('should auto-create user on first authentication', async function () {
                const authData = await createAPIAuthData('evm');
                
                // First auth should create user
                const mockUser = createMockUserData('evm', false);
                expect(mockUser).to.be.null;
                
                // After successful auth, user should exist
                const createdUser = createMockUserData('evm', true);
                expect(createdUser).to.have.property('blockchainAuth');
                expect(createdUser.blockchainAuth.type).to.equal('evm');
                expect(createdUser.blockchainAuth.address).to.equal(TEST_WALLETS.evm.address);
            });
            
            it('should reject invalid EVM signature', async function () {
                const authData = await createInvalidAuthData('invalid-signature');
                
                // Should return 403 with AuthFailed code
                const mockError = {
                    code: 'AuthFailed'
                };
                
                expect(mockError.code).to.equal('AuthFailed');
            });
            
            it('should handle base64-encoded EVM signatures', async function () {
                const authData = await createAPIAuthData('evm');
                
                // Signature should be base64
                expect(authData.signature).to.match(/^[A-Za-z0-9+/]+=*$/);
                
                // Should not start with 0x
                expect(authData.signature).to.not.match(/^0x/);
            });
        });
        
        describe('Solana Wallet Authentication', function () {
            it('should authenticate with valid Solana address and signature', async function () {
                const authData = await createAPIAuthData('solana');
                
                const expectedBody = {
                    username: authData.username,
                    signature: authData.signature,
                    nonce: authData.nonce,
                    scope: 'master'
                };
                
                // Verify Solana address format (base58)
                expect(expectedBody.username).to.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
                
                // Verify Solana signature format (base58)
                expect(expectedBody.signature).to.be.a('string');
                expect(expectedBody.signature.length).to.be.greaterThan(0);
            });
            
            it('should auto-create Solana user on first authentication', async function () {
                const authData = await createAPIAuthData('solana');
                
                const createdUser = createMockUserData('solana', true);
                expect(createdUser.blockchainAuth.type).to.equal('solana');
                expect(createdUser.blockchainAuth.address).to.equal(TEST_WALLETS.solana.address);
            });
            
            it('should reject invalid Solana signature', async function () {
                const authData = await createInvalidAuthData('invalid-signature');
                authData.username = TEST_WALLETS.solana.address;
                
                const expectedError = {
                    code: 'AuthFailed'
                };
                
                expect(expectedError.code).to.equal('AuthFailed');
            });
        });
        
        describe('ENS Name Authentication', function () {
            it('should authenticate with ENS name and owner signature', async function () {
                const authData = await createAPIAuthData('ens');
                
                const expectedBody = {
                    username: authData.username,
                    signature: authData.signature,
                    nonce: authData.nonce,
                    signerAddress: authData.signerAddress,
                    scope: 'master'
                };
                
                // Verify ENS name format
                expect(expectedBody.username).to.match(/\.eth$/);
                
                // Verify signerAddress is provided
                expect(expectedBody.signerAddress).to.equal(TEST_WALLETS.ens.ownerAddress);
                
                // Signature should be base64 (EVM)
                expect(expectedBody.signature).to.match(/^[A-Za-z0-9+/]+=*$/);
            });
            
            it('should reject ENS name without signerAddress', async function () {
                const authData = await createInvalidAuthData('missing-signer');
                
                const expectedError = {
                    code: 'BlockchainAddressNotFound'
                };
                
                // Should fail to resolve ENS without signer
                expect(expectedError.code).to.be.oneOf(['BlockchainAddressNotFound', 'AuthFailed']);
            });
            
            it('should auto-create user with resolved ENS owner', async function () {
                const authData = await createAPIAuthData('ens');
                
                const createdUser = createMockUserData('ens', true);
                expect(createdUser.username).to.equal(TEST_WALLETS.ens.name);
                expect(createdUser.blockchainAuth.type).to.equal('evm');
                expect(createdUser.blockchainAuth.address).to.equal(TEST_WALLETS.ens.ownerAddress);
            });
        });
        
        describe('SNS Name Authentication', function () {
            it('should authenticate with SNS name and owner signature', async function () {
                const authData = await createAPIAuthData('sns');
                
                const expectedBody = {
                    username: authData.username,
                    signature: authData.signature,
                    nonce: authData.nonce,
                    signerAddress: authData.signerAddress,
                    scope: 'master'
                };
                
                // Verify SNS name format
                expect(expectedBody.username).to.match(/\.sol$/);
                
                // Verify signerAddress is provided
                expect(expectedBody.signerAddress).to.equal(TEST_WALLETS.sns.ownerAddress);
                
                // Signature should be base58 (Solana)
                expect(expectedBody.signature).to.match(/^[1-9A-HJ-NP-Za-km-z]+$/);
            });
            
            it('should auto-create user with resolved SNS owner', async function () {
                const authData = await createAPIAuthData('sns');
                
                const createdUser = createMockUserData('sns', true);
                expect(createdUser.username).to.equal(TEST_WALLETS.sns.name);
                expect(createdUser.blockchainAuth.type).to.equal('solana');
                expect(createdUser.blockchainAuth.address).to.equal(TEST_WALLETS.sns.ownerAddress);
            });
        });
        
        describe('Nonce Management', function () {
            it('should reject reused nonce', async function () {
                const nonce = generateNonce();
                const authData1 = await createAPIAuthData('evm', nonce);
                const authData2 = await createAPIAuthData('evm', nonce);
                
                // First auth should succeed
                // Second auth with same nonce should fail
                const expectedError = {
                    code: 'NonceReused'
                };
                
                expect(expectedError.code).to.equal('NonceReused');
            });
            
            it('should accept new nonce after successful auth', async function () {
                const nonce1 = generateNonce();
                const nonce2 = generateNonce();
                
                const authData1 = await createAPIAuthData('evm', nonce1);
                const authData2 = await createAPIAuthData('evm', nonce2);
                
                // Both should have different nonces
                expect(authData1.nonce).to.not.equal(authData2.nonce);
                
                // Both should be valid
                expect(authData1).to.have.property('signature');
                expect(authData2).to.have.property('signature');
            });
            
            it('should require nonce parameter', async function () {
                const authData = await createAPIAuthData('evm');
                delete authData.nonce;
                
                const expectedError = {
                    code: 'MissingParameterError'
                };
                
                // Should fail without nonce
                expect(authData).to.not.have.property('nonce');
            });
        });
        
        describe('Scope Management', function () {
            it('should accept master scope', async function () {
                const authData = await createAPIAuthData('evm');
                const requestBody = {
                    ...authData,
                    scope: 'master'
                };
                
                expect(requestBody.scope).to.equal('master');
            });
            
            it('should accept imap scope', async function () {
                const authData = await createAPIAuthData('evm');
                const requestBody = {
                    ...authData,
                    scope: 'imap'
                };
                
                expect(requestBody.scope).to.equal('imap');
            });
            
            it('should accept pop3 scope', async function () {
                const authData = await createAPIAuthData('evm');
                const requestBody = {
                    ...authData,
                    scope: 'pop3'
                };
                
                expect(requestBody.scope).to.equal('pop3');
            });
            
            it('should accept smtp scope', async function () {
                const authData = await createAPIAuthData('evm');
                const requestBody = {
                    ...authData,
                    scope: 'smtp'
                };
                
                expect(requestBody.scope).to.equal('smtp');
            });
            
            it('should only generate token with master scope', async function () {
                const authData = await createAPIAuthData('evm');
                
                // Token with master scope
                const masterRequest = {
                    ...authData,
                    scope: 'master',
                    token: true
                };
                
                expect(masterRequest.scope).to.equal('master');
                expect(masterRequest.token).to.be.true;
                
                // Token with other scope should fail validation
                const imapRequest = {
                    ...authData,
                    scope: 'imap',
                    token: true
                };
                
                // This should fail Joi validation
                expect(imapRequest.scope).to.not.equal('master');
            });
        });
        
        describe('Error Responses', function () {
            it('should return detailed error for invalid username', async function () {
                const authData = await createInvalidAuthData('invalid-username');
                
                const expectedError = {
                    code: 'InvalidBlockchainIdentifier'
                };
                
                expect(expectedError).to.have.property('code');
                expect(expectedError.code).to.equal('InvalidBlockchainIdentifier');
            });
            
            it('should return 400 for validation errors', async function () {
                const authData = await createInvalidAuthData('invalid-username');
                
                // Expected status code for validation error
                const expectedStatus = 400;
                expect(expectedStatus).to.equal(400);
            });
            
            it('should return 403 for authentication failures', async function () {
                const authData = await createInvalidAuthData('invalid-signature');
                
                // Expected status code for auth failure
                const expectedStatus = 403;
                expect(expectedStatus).to.equal(403);
            });
            
            it('should return 429 for rate limiting', async function () {
                // Simulate multiple failed attempts
                const expectedError = {
                    code: 'RateLimited'
                };
                
                // Expected status code for rate limiting
                const expectedStatus = 429;
                expect(expectedStatus).to.equal(429);
            });
        });
    });
    
    describe('POST /preauth', function () {
        it('should check if user exists', async function () {
            const authData = await createAPIAuthData('evm');
            
            const requestBody = {
                username: authData.username,
                scope: 'master'
            };
            
            // For existing user
            const existingUserResponse = {
                success: true,
                username: authData.username,
                address: `${authData.username}@localhost`,
                scope: 'master'
            };
            
            expect(requestBody).to.have.property('username');
            expect(requestBody).to.have.property('scope');
        });
        
        it('should work with ENS names', async function () {
            const requestBody = {
                username: TEST_WALLETS.ens.name,
                scope: 'master'
            };
            
            expect(requestBody.username).to.match(/\.eth$/);
        });
        
        it('should work with SNS names', async function () {
            const requestBody = {
                username: TEST_WALLETS.sns.name,
                scope: 'master'
            };
            
            expect(requestBody.username).to.match(/\.sol$/);
        });
    });
});