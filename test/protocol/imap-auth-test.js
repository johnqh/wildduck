'use strict';

const chai = require('chai');
const expect = chai.expect;
const net = require('net');
const tls = require('tls');

const {
    TEST_WALLETS,
    generateNonce,
    createAuthMessage,
    createAPIAuthData,
    hexToBase64
} = require('../helpers/auth-test-utils');

chai.config.includeStack = true;

/**
 * IMAP Protocol Authentication Tests
 * Tests follow RFC 3501 (IMAP4rev1) standards
 */
describe('IMAP Protocol Authentication Tests', function () {
    this.timeout(15000);
    
    let imapServer;
    const IMAP_PORT = 9993; // Default WildDuck IMAP port
    const IMAP_HOST = 'localhost';
    
    before((done) => {
        // Server should be running
        done();
    });
    
    after((done) => {
        done();
    });
    
    describe('IMAP LOGIN Command (RFC 3501)', () => {
        describe('EVM Wallet Authentication', () => {
            it('should authenticate with LOGIN command using EVM address', async () => {
                const authData = await createAPIAuthData('evm');
                
                // IMAP protocol test using raw socket
                const testIMAPAuth = (callback) => {
                    const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                        let buffer = '';
                        let commandTag = 1;
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop(); // Keep incomplete line in buffer
                            
                            lines.forEach(line => {
                                if (line.startsWith('* OK')) {
                                    // Server greeting received, send LOGIN
                                    const tag = `A${commandTag++}`;
                                    const username = authData.username;
                                    const password = authData.signature; // Signature as password
                                    
                                    // IMAP LOGIN command format: tag LOGIN username password
                                    // Need to quote if contains special characters
                                    const command = `${tag} LOGIN "${username}" "${password}"\r\n`;
                                    client.write(command);
                                    
                                } else if (line.includes('OK LOGIN')) {
                                    // Authentication successful
                                    expect(line).to.include('OK');
                                    
                                    // Send LOGOUT
                                    const tag = `A${commandTag++}`;
                                    client.write(`${tag} LOGOUT\r\n`);
                                    
                                } else if (line.includes('BYE')) {
                                    // Server closing connection
                                    client.end();
                                    callback();
                                }
                            });
                        });
                        
                        client.on('error', (err) => {
                            callback(err);
                        });
                    });
                };
                
                return new Promise((resolve, reject) => {
                    testIMAPAuth((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
            
            it('should reject invalid EVM signature', async () => {
                const username = TEST_WALLETS.evm.address;
                const invalidSignature = 'aW52YWxpZF9zaWduYXR1cmU='; // Invalid base64 signature
                
                const testInvalidAuth = (callback) => {
                    const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                        let buffer = '';
                        let commandTag = 1;
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (line.startsWith('* OK')) {
                                    // Send invalid LOGIN
                                    const tag = `A${commandTag++}`;
                                    const command = `${tag} LOGIN "${username}" "${invalidSignature}"\r\n`;
                                    client.write(command);
                                    
                                } else if (line.includes('NO LOGIN') || line.includes('BAD LOGIN')) {
                                    // Authentication should fail
                                    expect(line).to.match(/NO|BAD/);
                                    client.end();
                                    callback();
                                }
                            });
                        });
                        
                        client.on('error', () => {
                            client.end();
                            callback();
                        });
                    });
                };
                
                return new Promise((resolve, reject) => {
                    testInvalidAuth((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        });
        
        describe('Solana Wallet Authentication', () => {
            it('should authenticate with LOGIN command using Solana address', async () => {
                const authData = await createAPIAuthData('solana');
                
                const testIMAPAuth = (callback) => {
                    const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                        let buffer = '';
                        let commandTag = 1;
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (line.startsWith('* OK')) {
                                    const tag = `A${commandTag++}`;
                                    const username = authData.username;
                                    const password = authData.signature; // Base58 signature
                                    
                                    // Solana addresses and signatures may have special chars
                                    const command = `${tag} LOGIN {${username.length}}\r\n${username} {${password.length}}\r\n${password}\r\n`;
                                    client.write(command);
                                    
                                } else if (line.includes('OK LOGIN')) {
                                    expect(line).to.include('OK');
                                    
                                    const tag = `A${commandTag++}`;
                                    client.write(`${tag} LOGOUT\r\n`);
                                    
                                } else if (line.includes('BYE')) {
                                    client.end();
                                    callback();
                                }
                            });
                        });
                        
                        client.on('error', (err) => {
                            callback(err);
                        });
                    });
                };
                
                return new Promise((resolve, reject) => {
                    testIMAPAuth((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        });
        
        describe('ENS Name Authentication', () => {
            it('should authenticate with LOGIN command using ENS name', async () => {
                const authData = await createAPIAuthData('ens');
                
                const testIMAPAuth = (callback) => {
                    const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                        let buffer = '';
                        let commandTag = 1;
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (line.startsWith('* OK')) {
                                    const tag = `A${commandTag++}`;
                                    const username = authData.username; // test.eth
                                    const password = authData.signature; // Base64 EVM signature
                                    
                                    const command = `${tag} LOGIN "${username}" "${password}"\r\n`;
                                    client.write(command);
                                    
                                } else if (line.includes('OK LOGIN')) {
                                    expect(line).to.include('OK');
                                    
                                    const tag = `A${commandTag++}`;
                                    client.write(`${tag} LOGOUT\r\n`);
                                    
                                } else if (line.includes('BYE')) {
                                    client.end();
                                    callback();
                                }
                            });
                        });
                        
                        client.on('error', (err) => {
                            callback(err);
                        });
                    });
                };
                
                return new Promise((resolve, reject) => {
                    testIMAPAuth((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        });
        
        describe('IMAP CAPABILITY', () => {
            it('should advertise LOGIN capability', (done) => {
                const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                    let buffer = '';
                    let commandTag = 1;
                    
                    client.on('data', (data) => {
                        buffer += data.toString();
                        const lines = buffer.split('\r\n');
                        buffer = lines.pop();
                        
                        lines.forEach(line => {
                            if (line.startsWith('* OK')) {
                                // Send CAPABILITY command
                                const tag = `A${commandTag++}`;
                                client.write(`${tag} CAPABILITY\r\n`);
                                
                            } else if (line.includes('* CAPABILITY')) {
                                // Check for required capabilities
                                expect(line).to.include('IMAP4rev1');
                                expect(line).to.include('LOGIN');
                                
                                // Send LOGOUT
                                const tag = `A${commandTag++}`;
                                client.write(`${tag} LOGOUT\r\n`);
                                
                            } else if (line.includes('BYE')) {
                                client.end();
                                done();
                            }
                        });
                    });
                    
                    client.on('error', done);
                });
            });
        });
        
        describe('IMAP STARTTLS', () => {
            it('should support STARTTLS for secure authentication', (done) => {
                const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                    let buffer = '';
                    let commandTag = 1;
                    let tlsStarted = false;
                    
                    client.on('data', (data) => {
                        buffer += data.toString();
                        const lines = buffer.split('\r\n');
                        buffer = lines.pop();
                        
                        lines.forEach(line => {
                            if (line.startsWith('* OK') && !tlsStarted) {
                                // Check if STARTTLS is supported
                                const tag = `A${commandTag++}`;
                                client.write(`${tag} CAPABILITY\r\n`);
                                
                            } else if (line.includes('* CAPABILITY')) {
                                if (line.includes('STARTTLS')) {
                                    // STARTTLS is supported
                                    const tag = `A${commandTag++}`;
                                    client.write(`${tag} STARTTLS\r\n`);
                                } else {
                                    // STARTTLS not supported, skip test
                                    client.end();
                                    done();
                                }
                                
                            } else if (line.includes('OK Begin TLS')) {
                                // Upgrade to TLS
                                tlsStarted = true;
                                
                                const tlsOptions = {
                                    socket: client,
                                    rejectUnauthorized: false // For test environment
                                };
                                
                                const tlsSocket = tls.connect(tlsOptions, () => {
                                    // TLS handshake complete
                                    // Send LOGOUT over TLS
                                    const tag = `A${commandTag++}`;
                                    tlsSocket.write(`${tag} LOGOUT\r\n`);
                                });
                                
                                tlsSocket.on('data', (data) => {
                                    if (data.toString().includes('BYE')) {
                                        tlsSocket.end();
                                        done();
                                    }
                                });
                                
                            } else if (line.includes('BYE')) {
                                client.end();
                                done();
                            }
                        });
                    });
                    
                    client.on('error', done);
                });
            });
        });
        
        describe('IMAP Session Management', () => {
            it('should maintain session state after authentication', async () => {
                const authData = await createAPIAuthData('evm');
                
                const testSession = (callback) => {
                    const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                        let buffer = '';
                        let commandTag = 1;
                        let authenticated = false;
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (line.startsWith('* OK') && !authenticated) {
                                    // Authenticate
                                    const tag = `A${commandTag++}`;
                                    const command = `${tag} LOGIN "${authData.username}" "${authData.signature}"\r\n`;
                                    client.write(command);
                                    
                                } else if (line.includes('OK LOGIN')) {
                                    authenticated = true;
                                    
                                    // Try to SELECT INBOX
                                    const tag = `A${commandTag++}`;
                                    client.write(`${tag} SELECT INBOX\r\n`);
                                    
                                } else if (line.includes('OK [READ-WRITE] SELECT')) {
                                    // Successfully selected mailbox
                                    expect(authenticated).to.be.true;
                                    
                                    // Send LOGOUT
                                    const tag = `A${commandTag++}`;
                                    client.write(`${tag} LOGOUT\r\n`);
                                    
                                } else if (line.includes('BYE')) {
                                    client.end();
                                    callback();
                                }
                            });
                        });
                        
                        client.on('error', (err) => {
                            callback(err);
                        });
                    });
                };
                
                return new Promise((resolve, reject) => {
                    testSession((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
            
            it('should reject commands before authentication', (done) => {
                const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                    let buffer = '';
                    let commandTag = 1;
                    
                    client.on('data', (data) => {
                        buffer += data.toString();
                        const lines = buffer.split('\r\n');
                        buffer = lines.pop();
                        
                        lines.forEach(line => {
                            if (line.startsWith('* OK')) {
                                // Try SELECT without authentication
                                const tag = `A${commandTag++}`;
                                client.write(`${tag} SELECT INBOX\r\n`);
                                
                            } else if (line.includes('NO') || line.includes('BAD')) {
                                // Command should be rejected
                                expect(line).to.match(/NO|BAD/);
                                
                                // Send LOGOUT
                                const tag = `A${commandTag++}`;
                                client.write(`${tag} LOGOUT\r\n`);
                                
                            } else if (line.includes('BYE')) {
                                client.end();
                                done();
                            }
                        });
                    });
                    
                    client.on('error', done);
                });
            });
        });
        
        describe('IMAP Error Handling', () => {
            it('should handle malformed LOGIN commands', (done) => {
                const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                    let buffer = '';
                    let commandTag = 1;
                    
                    client.on('data', (data) => {
                        buffer += data.toString();
                        const lines = buffer.split('\r\n');
                        buffer = lines.pop();
                        
                        lines.forEach(line => {
                            if (line.startsWith('* OK')) {
                                // Send malformed LOGIN (missing password)
                                const tag = `A${commandTag++}`;
                                client.write(`${tag} LOGIN "${TEST_WALLETS.evm.address}"\r\n`);
                                
                            } else if (line.includes('BAD')) {
                                // Should return BAD for syntax error
                                expect(line).to.include('BAD');
                                
                                client.end();
                                done();
                            }
                        });
                    });
                    
                    client.on('error', done);
                });
            });
            
            it('should handle special characters in credentials', async () => {
                const authData = await createAPIAuthData('evm');
                
                // Test with literal syntax for special characters
                const testSpecialChars = (callback) => {
                    const client = net.createConnection(IMAP_PORT, IMAP_HOST, () => {
                        let buffer = '';
                        let commandTag = 1;
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (line.startsWith('* OK')) {
                                    // Use literal syntax for password with special chars
                                    const tag = `A${commandTag++}`;
                                    const username = authData.username;
                                    const password = authData.signature;
                                    
                                    // IMAP literal syntax: {length}\r\n<data>
                                    const command = `${tag} LOGIN "${username}" {${password.length}}\r\n`;
                                    client.write(command);
                                    
                                    // Server should respond with + to continue
                                    
                                } else if (line.startsWith('+')) {
                                    // Send the literal password
                                    client.write(`${authData.signature}\r\n`);
                                    
                                } else if (line.includes('OK LOGIN')) {
                                    expect(line).to.include('OK');
                                    
                                    const tag = `A${commandTag++}`;
                                    client.write(`${tag} LOGOUT\r\n`);
                                    
                                } else if (line.includes('BYE')) {
                                    client.end();
                                    callback();
                                }
                            });
                        });
                        
                        client.on('error', (err) => {
                            callback(err);
                        });
                    });
                };
                
                return new Promise((resolve, reject) => {
                    testSpecialChars((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        });
    });
});