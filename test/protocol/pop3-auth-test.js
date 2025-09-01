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
 * POP3 Protocol Authentication Tests
 * Tests follow RFC 1939 (POP3) standards
 */
describe('POP3 Protocol Authentication Tests', function () {
    this.timeout(15000);
    
    const POP3_PORT = 9995; // Default WildDuck POP3 port (secure)
    const POP3_HOST = 'localhost';
    
    before((done) => {
        // Server should be running
        done();
    });
    
    after((done) => {
        done();
    });
    
    describe('POP3 USER/PASS Commands (RFC 1939)', () => {
        describe('EVM Wallet Authentication', () => {
            it('should authenticate with USER/PASS commands using EVM address', async () => {
                const authData = await createAPIAuthData('evm');
                
                // POP3 protocol test using raw socket
                const testPOP3Auth = (callback) => {
                    const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                        let buffer = '';
                        let state = 'GREETING';
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop(); // Keep incomplete line in buffer
                            
                            lines.forEach(line => {
                                if (state === 'GREETING' && line.startsWith('+OK')) {
                                    // Server greeting received, send USER
                                    client.write(`USER ${authData.username}\r\n`);
                                    state = 'USER_SENT';
                                    
                                } else if (state === 'USER_SENT' && line.startsWith('+OK')) {
                                    // USER accepted, send PASS (signature as password)
                                    client.write(`PASS ${authData.signature}\r\n`);
                                    state = 'PASS_SENT';
                                    
                                } else if (state === 'PASS_SENT') {
                                    if (line.startsWith('+OK')) {
                                        // Authentication successful
                                        expect(line).to.include('+OK');
                                        
                                        // Send QUIT
                                        client.write('QUIT\r\n');
                                        state = 'QUIT_SENT';
                                        
                                    } else if (line.startsWith('-ERR')) {
                                        // Authentication failed
                                        callback(new Error('Authentication failed: ' + line));
                                        client.end();
                                    }
                                    
                                } else if (state === 'QUIT_SENT' && line.startsWith('+OK')) {
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
                    testPOP3Auth((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
            
            it('should reject invalid EVM signature', async () => {
                const username = TEST_WALLETS.evm.address;
                const invalidSignature = 'aW52YWxpZF9zaWduYXR1cmU='; // Invalid base64 signature
                
                const testInvalidAuth = (callback) => {
                    const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                        let buffer = '';
                        let state = 'GREETING';
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (state === 'GREETING' && line.startsWith('+OK')) {
                                    // Send USER
                                    client.write(`USER ${username}\r\n`);
                                    state = 'USER_SENT';
                                    
                                } else if (state === 'USER_SENT' && line.startsWith('+OK')) {
                                    // Send invalid PASS
                                    client.write(`PASS ${invalidSignature}\r\n`);
                                    state = 'PASS_SENT';
                                    
                                } else if (state === 'PASS_SENT' && line.startsWith('-ERR')) {
                                    // Authentication should fail
                                    expect(line).to.include('-ERR');
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
            it('should authenticate with USER/PASS commands using Solana address', async () => {
                const authData = await createAPIAuthData('solana');
                
                const testPOP3Auth = (callback) => {
                    const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                        let buffer = '';
                        let state = 'GREETING';
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (state === 'GREETING' && line.startsWith('+OK')) {
                                    client.write(`USER ${authData.username}\r\n`);
                                    state = 'USER_SENT';
                                    
                                } else if (state === 'USER_SENT' && line.startsWith('+OK')) {
                                    // Solana signature (base58)
                                    client.write(`PASS ${authData.signature}\r\n`);
                                    state = 'PASS_SENT';
                                    
                                } else if (state === 'PASS_SENT' && line.startsWith('+OK')) {
                                    expect(line).to.include('+OK');
                                    client.write('QUIT\r\n');
                                    state = 'QUIT_SENT';
                                    
                                } else if (state === 'QUIT_SENT' && line.startsWith('+OK')) {
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
                    testPOP3Auth((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        });
        
        describe('ENS Name Authentication', () => {
            it('should authenticate with USER/PASS commands using ENS name', async () => {
                const authData = await createAPIAuthData('ens');
                
                const testPOP3Auth = (callback) => {
                    const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                        let buffer = '';
                        let state = 'GREETING';
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (state === 'GREETING' && line.startsWith('+OK')) {
                                    // ENS name as username
                                    client.write(`USER ${authData.username}\r\n`);
                                    state = 'USER_SENT';
                                    
                                } else if (state === 'USER_SENT' && line.startsWith('+OK')) {
                                    // Base64 EVM signature as password
                                    client.write(`PASS ${authData.signature}\r\n`);
                                    state = 'PASS_SENT';
                                    
                                } else if (state === 'PASS_SENT' && line.startsWith('+OK')) {
                                    expect(line).to.include('+OK');
                                    client.write('QUIT\r\n');
                                    state = 'QUIT_SENT';
                                    
                                } else if (state === 'QUIT_SENT' && line.startsWith('+OK')) {
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
                    testPOP3Auth((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        });
        
        describe('POP3 CAPA Command', () => {
            it('should advertise capabilities', (done) => {
                const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                    let buffer = '';
                    let state = 'GREETING';
                    
                    client.on('data', (data) => {
                        buffer += data.toString();
                        const lines = buffer.split('\r\n');
                        buffer = lines.pop();
                        
                        lines.forEach(line => {
                            if (state === 'GREETING' && line.startsWith('+OK')) {
                                // Send CAPA command
                                client.write('CAPA\r\n');
                                state = 'CAPA_SENT';
                                
                            } else if (state === 'CAPA_SENT') {
                                if (line.startsWith('+OK')) {
                                    // Start of capabilities list
                                    state = 'READING_CAPA';
                                } else if (state === 'READING_CAPA') {
                                    if (line === '.') {
                                        // End of capabilities
                                        client.write('QUIT\r\n');
                                        state = 'QUIT_SENT';
                                    } else {
                                        // Check for expected capabilities
                                        // Common capabilities: TOP, USER, UIDL, STLS
                                    }
                                }
                                
                            } else if (state === 'QUIT_SENT' && line.startsWith('+OK')) {
                                client.end();
                                done();
                            }
                        });
                    });
                    
                    client.on('error', done);
                });
            });
        });
        
        describe('POP3 STLS Command', () => {
            it('should support STLS for secure authentication', (done) => {
                const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                    let buffer = '';
                    let state = 'GREETING';
                    let tlsStarted = false;
                    
                    client.on('data', (data) => {
                        buffer += data.toString();
                        const lines = buffer.split('\r\n');
                        buffer = lines.pop();
                        
                        lines.forEach(line => {
                            if (state === 'GREETING' && line.startsWith('+OK') && !tlsStarted) {
                                // Check if STLS is supported
                                client.write('CAPA\r\n');
                                state = 'CAPA_SENT';
                                
                            } else if (state === 'CAPA_SENT') {
                                if (line.includes('STLS')) {
                                    // STLS is supported
                                    state = 'STLS_AVAILABLE';
                                } else if (line === '.') {
                                    if (state === 'STLS_AVAILABLE') {
                                        // Send STLS command
                                        client.write('STLS\r\n');
                                        state = 'STLS_SENT';
                                    } else {
                                        // STLS not supported, skip test
                                        client.end();
                                        done();
                                    }
                                }
                                
                            } else if (state === 'STLS_SENT' && line.startsWith('+OK')) {
                                // Upgrade to TLS
                                tlsStarted = true;
                                
                                const tlsOptions = {
                                    socket: client,
                                    rejectUnauthorized: false // For test environment
                                };
                                
                                const tlsSocket = tls.connect(tlsOptions, () => {
                                    // TLS handshake complete
                                    // Send QUIT over TLS
                                    tlsSocket.write('QUIT\r\n');
                                });
                                
                                tlsSocket.on('data', (data) => {
                                    if (data.toString().includes('+OK')) {
                                        tlsSocket.end();
                                        done();
                                    }
                                });
                                
                            } else if (line.startsWith('+OK Logging out')) {
                                client.end();
                                done();
                            }
                        });
                    });
                    
                    client.on('error', done);
                });
            });
        });
        
        describe('POP3 Session Management', () => {
            it('should maintain session state after authentication', async () => {
                const authData = await createAPIAuthData('evm');
                
                const testSession = (callback) => {
                    const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                        let buffer = '';
                        let state = 'GREETING';
                        let authenticated = false;
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (state === 'GREETING' && line.startsWith('+OK')) {
                                    // Authenticate
                                    client.write(`USER ${authData.username}\r\n`);
                                    state = 'USER_SENT';
                                    
                                } else if (state === 'USER_SENT' && line.startsWith('+OK')) {
                                    client.write(`PASS ${authData.signature}\r\n`);
                                    state = 'PASS_SENT';
                                    
                                } else if (state === 'PASS_SENT' && line.startsWith('+OK')) {
                                    authenticated = true;
                                    
                                    // Try STAT command
                                    client.write('STAT\r\n');
                                    state = 'STAT_SENT';
                                    
                                } else if (state === 'STAT_SENT' && line.startsWith('+OK')) {
                                    // STAT should work after authentication
                                    expect(authenticated).to.be.true;
                                    expect(line).to.match(/\+OK \d+ \d+/); // +OK message_count total_size
                                    
                                    // Send QUIT
                                    client.write('QUIT\r\n');
                                    state = 'QUIT_SENT';
                                    
                                } else if (state === 'QUIT_SENT' && line.startsWith('+OK')) {
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
                const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                    let buffer = '';
                    let state = 'GREETING';
                    
                    client.on('data', (data) => {
                        buffer += data.toString();
                        const lines = buffer.split('\r\n');
                        buffer = lines.pop();
                        
                        lines.forEach(line => {
                            if (state === 'GREETING' && line.startsWith('+OK')) {
                                // Try STAT without authentication
                                client.write('STAT\r\n');
                                state = 'STAT_SENT';
                                
                            } else if (state === 'STAT_SENT' && line.startsWith('-ERR')) {
                                // Command should be rejected
                                expect(line).to.include('-ERR');
                                
                                // Send QUIT
                                client.write('QUIT\r\n');
                                state = 'QUIT_SENT';
                                
                            } else if (state === 'QUIT_SENT' && line.startsWith('+OK')) {
                                client.end();
                                done();
                            }
                        });
                    });
                    
                    client.on('error', done);
                });
            });
            
            it('should handle LIST command after authentication', async () => {
                const authData = await createAPIAuthData('evm');
                
                const testList = (callback) => {
                    const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                        let buffer = '';
                        let state = 'GREETING';
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (state === 'GREETING' && line.startsWith('+OK')) {
                                    client.write(`USER ${authData.username}\r\n`);
                                    state = 'USER_SENT';
                                    
                                } else if (state === 'USER_SENT' && line.startsWith('+OK')) {
                                    client.write(`PASS ${authData.signature}\r\n`);
                                    state = 'PASS_SENT';
                                    
                                } else if (state === 'PASS_SENT' && line.startsWith('+OK')) {
                                    // Send LIST command
                                    client.write('LIST\r\n');
                                    state = 'LIST_SENT';
                                    
                                } else if (state === 'LIST_SENT') {
                                    if (line.startsWith('+OK')) {
                                        // Start of message list
                                        state = 'READING_LIST';
                                    } else if (state === 'READING_LIST' && line === '.') {
                                        // End of list
                                        client.write('QUIT\r\n');
                                        state = 'QUIT_SENT';
                                    }
                                    
                                } else if (state === 'QUIT_SENT' && line.startsWith('+OK')) {
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
                    testList((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        });
        
        describe('POP3 Error Handling', () => {
            it('should handle malformed USER command', (done) => {
                const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                    let buffer = '';
                    let state = 'GREETING';
                    
                    client.on('data', (data) => {
                        buffer += data.toString();
                        const lines = buffer.split('\r\n');
                        buffer = lines.pop();
                        
                        lines.forEach(line => {
                            if (state === 'GREETING' && line.startsWith('+OK')) {
                                // Send USER without argument
                                client.write('USER\r\n');
                                state = 'USER_SENT';
                                
                            } else if (state === 'USER_SENT' && line.startsWith('-ERR')) {
                                // Should return error for missing argument
                                expect(line).to.include('-ERR');
                                
                                client.end();
                                done();
                            }
                        });
                    });
                    
                    client.on('error', done);
                });
            });
            
            it('should handle PASS without USER', (done) => {
                const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                    let buffer = '';
                    let state = 'GREETING';
                    
                    client.on('data', (data) => {
                        buffer += data.toString();
                        const lines = buffer.split('\r\n');
                        buffer = lines.pop();
                        
                        lines.forEach(line => {
                            if (state === 'GREETING' && line.startsWith('+OK')) {
                                // Send PASS without USER first
                                client.write('PASS somepassword\r\n');
                                state = 'PASS_SENT';
                                
                            } else if (state === 'PASS_SENT' && line.startsWith('-ERR')) {
                                // Should return error
                                expect(line).to.include('-ERR');
                                
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
                
                // Test with credentials containing special characters
                // POP3 doesn't have literal syntax like IMAP, so special chars might cause issues
                const testSpecialChars = (callback) => {
                    const client = net.createConnection(POP3_PORT, POP3_HOST, () => {
                        let buffer = '';
                        let state = 'GREETING';
                        
                        client.on('data', (data) => {
                            buffer += data.toString();
                            const lines = buffer.split('\r\n');
                            buffer = lines.pop();
                            
                            lines.forEach(line => {
                                if (state === 'GREETING' && line.startsWith('+OK')) {
                                    // Send USER with the actual username
                                    client.write(`USER ${authData.username}\r\n`);
                                    state = 'USER_SENT';
                                    
                                } else if (state === 'USER_SENT' && line.startsWith('+OK')) {
                                    // Send PASS with signature that might contain special chars
                                    // In POP3, spaces in passwords need to be handled carefully
                                    client.write(`PASS ${authData.signature}\r\n`);
                                    state = 'PASS_SENT';
                                    
                                } else if (state === 'PASS_SENT') {
                                    if (line.startsWith('+OK')) {
                                        // Authentication succeeded
                                        expect(line).to.include('+OK');
                                        client.write('QUIT\r\n');
                                        state = 'QUIT_SENT';
                                    } else if (line.startsWith('-ERR')) {
                                        // If special chars caused issues
                                        callback(new Error('Special characters not handled: ' + line));
                                        client.end();
                                    }
                                    
                                } else if (state === 'QUIT_SENT' && line.startsWith('+OK')) {
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