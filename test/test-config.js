'use strict';

/**
 * Centralized test configuration
 * All test usernames and related constants should be defined here
 * Maps existing test values to maintain consistency
 */

// Test usernames (unique EVM addresses - lowercase for consistency)
const TEST_USERS = {
    testuser: '0x1a2b3c4d5e6f789012345678901234567890abcd',
    testuser1: '0x2b3c4d5e6f789012345678901234567890abcd1a',
    testuser2: '0x3c4d5e6f789012345678901234567890abcd1a2b',
    testuser3: '0x4d5e6f789012345678901234567890abcd1a2b3c',
    testuser4: '0x5e6f789012345678901234567890abcd1a2b3c4d',
    testuser5: '0x6f789012345678901234567890abcd1a2b3c4d5e',
    testuser6: '0x789012345678901234567890abcd1a2b3c4d5e6f',
    testuser7: '0x89012345678901234567890abcd1a2b3c4d5e6f78',
    myuser2: '0x9012345678901234567890abcd1a2b3c4d5e6f789',
    myuser2hash: '0xa012345678901234567890bcde1a2b3c4d5e6f789',
    desuser: '0xb123456789012345678901cdef1a2b3c4d5e6f789',
    user1: '0xc23456789012345678901defa1a2b3c4d5e6f7890',
    user2: '0xd3456789012345678901efab1a2b3c4d5e6f78901',
    user3: '0xe456789012345678901fabc1a2b3c4d5e6f789012',
    user4: '0xf56789012345678901abcd1a2b3c4d5e6f7890123',
    user5: '0x167890123456789012bcde1a2b3c4d5e6f78901234',
    user1_1_addrtest: '0x27890123456789012cdef1a2b3c4d5e6f789012345',
    user1_2_addrtest: '0x3890123456789012defa1a2b3c4d5e6f7890123456',
    user2_1_addrtest: '0x490123456789012efab1a2b3c4d5e6f78901234567',
    filteruser: '0x5a0123456789012fabc1a2b3c4d5e6f789012345678',
    filteruser2: '0x6b123456789012abcd1a2b3c4d5e6f7890123456789',
    filteruser_addrtest: '0x7c23456789012bcde1a2b3c4d5e6f789012345678a',
    filteruser2_addrtest: '0x8d3456789012cdef1a2b3c4d5e6f789012345678ab',
    addressuser: '0x9e456789012defa1a2b3c4d5e6f789012345678abc',
    addressuser2: '0xaf56789012efab1a2b3c4d5e6f789012345678abcd',
    addressuser_addrtest: '0xb067890123fabc1a2b3c4d5e6f789012345678abcde',
    addressuser2_addrtest: '0xc17890123abcd1a2b3c4d5e6f789012345678abcdef',
    storageuser: '0xd2890123bcde1a2b3c4d5e6f789012345678abcdef0',
    storageuser_addrtest: '0xe390123cdef1a2b3c4d5e6f789012345678abcdef01',
    mailboxuser: '0xf4a0123defa1a2b3c4d5e6f789012345678abcdef012',
    mailboxesuser: '0x05b123efab1a2b3c4d5e6f789012345678abcdef0123',
    mailboxesuser_addrtest: '0x16c23fabc1a2b3c4d5e6f789012345678abcdef01234',
    john: '0x27d3abcd1a2b3c4d5e6f789012345678abcdef012345',
    alias1: '0x38e4bcde1a2b3c4d5e6f789012345678abcdef0123456',
    alias2: '0x49f5cdef1a2b3c4d5e6f789012345678abcdef01234567',
    forwarded_1_addrtest: '0x5a06defa1a2b3c4d5e6f789012345678abcdef012345678',
    andris: '0x6b17efab1a2b3c4d5e6f789012345678abcdef0123456789',
    my_new_address: '0x7c28fabc1a2b3c4d5e6f789012345678abcdef0123456789a',
    my_old_address: '0x8d39abcd1a2b3c4d5e6f789012345678abcdef0123456789ab',
    note: '0x9e4abcde1a2b3c4d5e6f789012345678abcdef0123456789abc',
    user: '0xaf5bcdef1a2b3c4d5e6f789012345678abcdef0123456789abcd',
    sender: '0xb06cdefa1a2b3c4d5e6f789012345678abcdef0123456789abcde',
    receiver: '0xc17defab1a2b3c4d5e6f789012345678abcdef0123456789abcdef',
    andris1: '0xd28efabc1a2b3c4d5e6f789012345678abcdef0123456789abcdef0',
    andris2: '0xe39fabcd1a2b3c4d5e6f789012345678abcdef0123456789abcdef01',
    to: '0xf4a0bcde1a2b3c4d5e6f789012345678abcdef0123456789abcdef012',
    cc: '0x05b1cdef1a2b3c4d5e6f789012345678abcdef0123456789abcdef0123',
    rfinnie: '0x16c2defa1a2b3c4d5e6f789012345678abcdef0123456789abcdef01234',
    bob: '0x27d3efab1a2b3c4d5e6f789012345678abcdef0123456789abcdef012345'
};

// Test passwords
const TEST_PASSWORDS = {
    pass: 'passx',
    secretpass: 'secretpassx',
    secretvalue: 'secretvaluex',
    invalidpass: 'invalidpassx',
    wrongpass: 'wrongpassx',
    test: 'testx'
};

// Test domains for email generation
const TEST_DOMAINS = {
    example: 'xexample.com',
    ethereal: 'xethereal.email',
    kreata: 'xkreata.ee',
    jogeva: 'xjõgeva.öö',
    alternative: 'xalternative.domain',
    neti: 'xneti.ee',
    zone: 'xzone.eu',
    pangalink: 'xpangalink.net',
    tr: 'xtr.ee',
    domain: 'xdomain.dom'
};

// Helper function to generate email addresses
const getTestEmail = (username, domain = TEST_DOMAINS.example) => `${username}@${domain}`;

/**
 * Helper function to create a user - uses /authenticate in crypto mode, /users in standard mode
 * @param {Object} server - Supertest server instance
 * @param {Object} userData - User data object
 * @param {boolean} cryptoEmails - Whether crypto emails mode is enabled (optional, auto-detected if not provided)
 * @returns {Promise<Object>} Response from user creation
 */
async function createUser(server, userData, cryptoEmails = null) {
    const tools = require('../lib/tools'); // eslint-disable-line global-require
    const isCryptoMode = cryptoEmails !== null ? cryptoEmails : tools.runningCryptoEmails();

    if (isCryptoMode) {
        // In crypto mode, use /authenticate endpoint
        const response = await server
            .post('/authenticate')
            .send({
                username: userData.username,
                password: userData.password,
                token: true
            })
            .expect(200);

        return response;
    } else {
        // In standard mode, use /users endpoint
        // Remove crypto-specific fields that don't apply to standard mode
        const standardUserData = { ...userData };
        delete standardUserData.emailDomain;

        const response = await server
            .post('/users')
            .send(standardUserData)
            .expect(200);

        return response;
    }
}

// Export for both CommonJS and ES modules
module.exports = {
    TEST_USERS,
    TEST_PASSWORDS,
    TEST_DOMAINS,
    getTestEmail,
    createUser
};
