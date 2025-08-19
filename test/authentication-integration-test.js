/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0, no-console:0 */

'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.config.includeStack = true;

const config = require('wild-config');
const { MongoClient } = require('mongodb');
const UserHandler = require('../lib/user-handler');
const BlockchainTestHelpers = require('./helpers/blockchain-test-helpers');

describe('Authentication Integration Tests', function () {
    this.timeout(30000);

    let client, database, users, userHandler;
    let testUsers = [];

    before(async function () {
        // Connect to test database
        client = new MongoClient(config.dbs.users);
        await client.connect();
        database = client.db();
        users = database;

        userHandler = new UserHandler({
            database: database,
            users: users,
            redis: false, // Skip Redis for testing
            log: {
                info: () => {},
                error: () => {},
                debug: () => {}
            }
        });
    });

    after(async function () {
        // Clean up test data
        if (users && testUsers.length > 0) {
            const testUsernames = testUsers.map(user => user.username);
            await users.collection('users').deleteMany({
                username: { $in: testUsernames }
            });
        }
        
        if (client) {
            await client.close();
        }
    });

    beforeEach(function () {
        // Clear test users array for each test
        testUsers = [];
    });

    describe('User Creation with Blockchain Auth', function () {
        
        it('should create user with EVM address username', async function () {
            const testUser = await BlockchainTestHelpers.generateEVMTestUser();
            testUsers.push(testUser);

            const userData = {
                username: testUser.username,
                name: `Test User ${testUser.address.substring(0, 8)}`,
                blockchainAuth: {
                    type: 'evm',
                    address: testUser.address,
                    lastAuth: new Date()
                }
            };

            const userId = await userHandler.create(userData);
            
            expect(userId).to.exist;
            expect(userId.toString()).to.match(/^[0-9a-f]{24}$/); // MongoDB ObjectId format
            
            // Verify user was created correctly
            const createdUser = await users.collection('users').findOne({ _id: userId });
            expect(createdUser).to.exist;
            expect(createdUser.username).to.equal(testUser.username);
            expect(createdUser.blockchainAuth.type).to.equal('evm');
            expect(createdUser.blockchainAuth.address).to.equal(testUser.address);
            
            console.log(`      ✅ Created EVM user: ${testUser.username.substring(0, 10)}...`);
        });

        it('should create user with Solana address username', async function () {
            const testUser = BlockchainTestHelpers.generateSolanaTestUser();
            testUsers.push(testUser);

            const userData = {
                username: testUser.username,
                name: `Test User ${testUser.address.substring(0, 8)}`,
                blockchainAuth: {
                    type: 'solana',
                    address: testUser.address,
                    lastAuth: new Date()
                }
            };

            const userId = await userHandler.create(userData);
            
            expect(userId).to.exist;
            
            // Verify user was created correctly
            const createdUser = await users.collection('users').findOne({ _id: userId });
            expect(createdUser).to.exist;
            expect(createdUser.username).to.equal(testUser.username);
            expect(createdUser.blockchainAuth.type).to.equal('solana');
            expect(createdUser.blockchainAuth.address).to.equal(testUser.address);
            
            console.log(`      ✅ Created Solana user: ${testUser.username.substring(0, 10)}...`);
        });

        it('should create user with base64 encoded EVM address', async function () {
            const testUser = await BlockchainTestHelpers.generateBase64EVMTestUser();
            testUsers.push(testUser);

            const userData = {
                username: testUser.username,
                name: `Test User Base64`,
                blockchainAuth: {
                    type: 'evm',
                    address: testUser.address, // Original hex address
                    lastAuth: new Date()
                }
            };

            const userId = await userHandler.create(userData);
            
            expect(userId).to.exist;
            
            // Verify user was created correctly
            const createdUser = await users.collection('users').findOne({ _id: userId });
            expect(createdUser).to.exist;
            expect(createdUser.username).to.equal(testUser.username); // base64 username
            expect(createdUser.blockchainAuth.type).to.equal('evm');
            expect(createdUser.blockchainAuth.address).to.equal(testUser.address); // hex address
            
            console.log(`      ✅ Created Base64 EVM user: ${testUser.username}`);
        });

        it('should reject duplicate usernames', async function () {
            const testUser = await BlockchainTestHelpers.generateEVMTestUser();
            testUsers.push(testUser);

            const userData = {
                username: testUser.username,
                name: 'First User',
                blockchainAuth: {
                    type: 'evm',
                    address: testUser.address,
                    lastAuth: new Date()
                }
            };

            // Create first user
            await userHandler.create(userData);

            // Try to create duplicate
            const duplicateData = {
                ...userData,
                name: 'Duplicate User'
            };

            try {
                await userHandler.create(duplicateData);
                expect.fail('Should have thrown error for duplicate username');
            } catch (err) {
                expect(err.code).to.equal('UserExistsError');
                expect(err.message).to.include('already exists');
            }
        });
    });

    describe('Authentication Flow', function () {
        
        it('should authenticate EVM user with valid signature', async function () {
            const testUser = await BlockchainTestHelpers.generateEVMTestUser();
            testUsers.push(testUser);

            // Create user first
            const userData = {
                username: testUser.username,
                name: 'Auth Test User',
                blockchainAuth: {
                    type: 'evm',
                    address: testUser.address,
                    lastAuth: new Date()
                }
            };

            await userHandler.create(userData);

            // Test authentication
            const [authResult, userId] = await userHandler.asyncAuthenticate(
                testUser.username,
                testUser.signature,
                'imap',
                {
                    protocol: 'IMAP',
                    sess: 'test-session',
                    ip: '127.0.0.1',
                    message: testUser.message,
                    signerAddress: testUser.address
                }
            );

            expect(authResult).to.exist;
            expect(authResult.user).to.exist;
            expect(authResult.username).to.equal(testUser.username);
            expect(authResult.scope).to.equal('imap');
            expect(userId).to.exist;
            
            console.log(`      ✅ Authenticated EVM user: ${testUser.username.substring(0, 10)}...`);
        });

        it('should authenticate Solana user with valid signature', async function () {
            const testUser = BlockchainTestHelpers.generateSolanaTestUser();
            testUsers.push(testUser);

            // Create user first
            const userData = {
                username: testUser.username,
                name: 'Auth Test User',
                blockchainAuth: {
                    type: 'solana',
                    address: testUser.address,
                    lastAuth: new Date()
                }
            };

            await userHandler.create(userData);

            // Test authentication
            const [authResult, userId] = await userHandler.asyncAuthenticate(
                testUser.username,
                testUser.signature,
                'pop3',
                {
                    protocol: 'POP3',
                    sess: 'test-session',
                    ip: '127.0.0.1',
                    message: testUser.message,
                    signerAddress: testUser.address
                }
            );

            expect(authResult).to.exist;
            expect(authResult.user).to.exist;
            expect(authResult.username).to.equal(testUser.username);
            expect(authResult.scope).to.equal('pop3');
            expect(userId).to.exist;
            
            console.log(`      ✅ Authenticated Solana user: ${testUser.username.substring(0, 10)}...`);
        });

        it('should reject authentication with invalid signature', async function () {
            const testUser = await BlockchainTestHelpers.generateEVMTestUser();
            testUsers.push(testUser);

            // Create user first
            const userData = {
                username: testUser.username,
                name: 'Auth Test User',
                blockchainAuth: {
                    type: 'evm',
                    address: testUser.address,
                    lastAuth: new Date()
                }
            };

            await userHandler.create(userData);

            // Test authentication with invalid signature
            const invalidSignature = '0x' + '0'.repeat(130);

            try {
                await userHandler.asyncAuthenticate(
                    testUser.username,
                    invalidSignature,
                    'imap',
                    {
                        protocol: 'IMAP',
                        sess: 'test-session',
                        ip: '127.0.0.1',
                        message: testUser.message,
                        signerAddress: testUser.address
                    }
                );
                expect.fail('Should have rejected invalid signature');
            } catch (err) {
                expect(err.message).to.include('Invalid signature');
            }
        });

        it('should reject authentication for non-existent user', async function () {
            const testUser = await BlockchainTestHelpers.generateEVMTestUser();
            // Note: NOT creating user in database

            try {
                await userHandler.asyncAuthenticate(
                    testUser.username,
                    testUser.signature,
                    'imap',
                    {
                        protocol: 'IMAP',
                        sess: 'test-session',
                        ip: '127.0.0.1',
                        message: testUser.message,
                        signerAddress: testUser.address
                    }
                );
                expect.fail('Should have rejected non-existent user');
            } catch (err) {
                expect(err.code).to.equal('AuthFailed');
            }
        });

        it('should authenticate base64 encoded EVM user', async function () {
            const testUser = await BlockchainTestHelpers.generateBase64EVMTestUser();
            testUsers.push(testUser);

            // Create user first
            const userData = {
                username: testUser.username, // base64 username
                name: 'Base64 Auth Test User',
                blockchainAuth: {
                    type: 'evm',
                    address: testUser.address, // original hex address
                    lastAuth: new Date()
                }
            };

            await userHandler.create(userData);

            // Test authentication with base64 username
            const [authResult, userId] = await userHandler.asyncAuthenticate(
                testUser.username, // base64 username
                testUser.signature,
                'smtp',
                {
                    protocol: 'SMTP',
                    sess: 'test-session',
                    ip: '127.0.0.1',
                    message: testUser.message,
                    signerAddress: testUser.address // original hex address
                }
            );

            expect(authResult).to.exist;
            expect(authResult.user).to.exist;
            expect(authResult.username).to.equal(testUser.username);
            expect(authResult.scope).to.equal('smtp');
            expect(userId).to.exist;
            
            console.log(`      ✅ Authenticated Base64 EVM user: ${testUser.username}`);
        });
    });

    describe('Protocol Interface Compatibility', function () {
        
        it('should handle standard SASL PLAIN format', function () {
            const testUser = await BlockchainTestHelpers.generateEVMTestUser();
            const saslCredentials = BlockchainTestHelpers.createSASLPlainCredentials(
                testUser.username, 
                testUser.signature
            );

            // Decode and verify format
            const decoded = Buffer.from(saslCredentials, 'base64').toString();
            const parts = decoded.split('\0');
            
            expect(parts).to.have.length(3);
            expect(parts[0]).to.equal(''); // authzid (empty)
            expect(parts[1]).to.equal(testUser.username);
            expect(parts[2]).to.equal(testUser.signature); // password field contains signature
        });

        it('should handle enhanced blockchain SASL format', function () {
            const testUser = await BlockchainTestHelpers.generateEVMTestUser();
            const enhancedCredentials = BlockchainTestHelpers.createEnhancedSASLCredentials(
                testUser.username,
                testUser.signature,
                testUser.message,
                testUser.address
            );

            // Decode and verify format
            const decoded = Buffer.from(enhancedCredentials, 'base64').toString();
            const parts = decoded.split('\0');
            
            expect(parts).to.have.length(5);
            expect(parts[0]).to.equal(''); // authzid (empty)
            expect(parts[1]).to.equal(testUser.username);
            expect(parts[2]).to.equal(testUser.signature);
            expect(parts[3]).to.equal(testUser.message);
            expect(parts[4]).to.equal(testUser.address);
        });

        it('should handle JSON format in password field', function () {
            const testUser = await BlockchainTestHelpers.generateEVMTestUser();
            const jsonPassword = JSON.stringify({
                signature: testUser.signature,
                message: testUser.message,
                signerAddress: testUser.address
            });

            // Verify JSON can be parsed
            expect(() => JSON.parse(jsonPassword)).to.not.throw();
            
            const parsed = JSON.parse(jsonPassword);
            expect(parsed.signature).to.equal(testUser.signature);
            expect(parsed.message).to.equal(testUser.message);
            expect(parsed.signerAddress).to.equal(testUser.address);
        });
    });

    describe('Performance and Edge Cases', function () {
        
        it('should handle multiple concurrent authentications', async function () {
            const users = await BlockchainTestHelpers.generateTestUsers(5);
            testUsers.push(...users);

            // Create all users
            for (const user of users) {
                const userData = {
                    username: user.username,
                    name: `Concurrent User ${user.address.substring(0, 8)}`,
                    blockchainAuth: {
                        type: user.type,
                        address: user.address,
                        lastAuth: new Date()
                    }
                };
                await userHandler.create(userData);
            }

            // Authenticate all users concurrently
            const authPromises = users.map(user => 
                userHandler.asyncAuthenticate(
                    user.username,
                    user.signature,
                    'imap',
                    {
                        protocol: 'IMAP',
                        sess: `test-session-${user.address.substring(0, 8)}`,
                        ip: '127.0.0.1',
                        message: user.message,
                        signerAddress: user.address
                    }
                )
            );

            const results = await Promise.all(authPromises);
            
            expect(results).to.have.length(users.length);
            results.forEach((result, index) => {
                expect(result[0]).to.exist; // authResult
                expect(result[0].username).to.equal(users[index].username);
                expect(result[1]).to.exist; // userId
            });
            
            console.log(`      ✅ Authenticated ${users.length} users concurrently`);
        });

        it('should handle very long signatures', async function () {
            const testUser = await BlockchainTestHelpers.generateEVMTestUser();
            testUsers.push(testUser);

            // Create user
            const userData = {
                username: testUser.username,
                name: 'Long Signature Test',
                blockchainAuth: {
                    type: 'evm',
                    address: testUser.address,
                    lastAuth: new Date()
                }
            };

            await userHandler.create(userData);

            // Test with very long (but valid) signature
            expect(testUser.signature.length).to.be.greaterThan(100);
            
            const [authResult] = await userHandler.asyncAuthenticate(
                testUser.username,
                testUser.signature,
                'imap',
                {
                    protocol: 'IMAP',
                    sess: 'test-session',
                    ip: '127.0.0.1',
                    message: testUser.message,
                    signerAddress: testUser.address
                }
            );

            expect(authResult).to.exist;
            expect(authResult.username).to.equal(testUser.username);
        });
    });
});