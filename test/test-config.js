'use strict';

/**
 * Centralized test configuration
 * All test usernames and related constants should be defined here
 * Maps existing test values to maintain consistency
 */

// Test usernames (appended 'x' for final verification)
const TEST_USERS = {
    testuser: 'testuserx',
    testuser1: 'testuser1x',
    testuser2: 'testuser2x',
    testuser3: 'testuser3x',
    testuser4: 'testuser4x',
    testuser5: 'testuser5x',
    testuser6: 'testuser6x',
    testuser7: 'testuser7x',
    myuser2: 'myuser2x',
    myuser2hash: 'myuser2hashx',
    desuser: 'desuserx',
    user1: 'user1x',
    user2: 'user2x',
    user3: 'user3x',
    user4: 'user4x',
    user5: 'user5x',
    user1_1_addrtest: 'user1x.1.addrtest',
    user1_2_addrtest: 'user1x.2.addrtest',
    user2_1_addrtest: 'user2x.1.addrtest',
    filteruser: 'filteruserx',
    filteruser2: 'filteruser2x',
    filteruser_addrtest: 'filteruserx.addrtest',
    filteruser2_addrtest: 'filteruser2x.addrtest',
    addressuser: 'addressuserx',
    addressuser2: 'addressuser2x',
    addressuser_addrtest: 'addressuserx.addrtest',
    addressuser2_addrtest: 'addressuser2x.addrtest',
    storageuser: 'storageuserx',
    storageuser_addrtest: 'storageuserx.addrtest',
    mailboxuser: 'mailboxuserx',
    mailboxesuser: 'mailboxesuserx',
    mailboxesuser_addrtest: 'mailboxesuserx.addrtest',
    john: 'johnx',
    alias1: 'alias1x',
    alias2: 'alias2x',
    forwarded_1_addrtest: 'forwardedx.1.addrtest',
    andris: 'andrisx',
    my_new_address: 'my.new.addressx',
    my_old_address: 'my.old.addressx',
    note: 'notex',
    user: 'userx',
    sender: 'senderx',
    receiver: 'receiverx',
    andris1: 'andris1x',
    andris2: 'andris2x',
    to: 'tox',
    cc: 'ccx',
    rfinnie: 'rfinniex',
    bob: 'bobx'
};

// Test passwords
const TEST_PASSWORDS = {
    pass: 'pass',
    secretpass: 'secretpass',
    secretvalue: 'secretvalue',
    invalidpass: 'invalidpass',
    wrongpass: 'wrongpass',
    test: 'test'
};

// Test domains for email generation
const TEST_DOMAINS = {
    example: 'example.com',
    ethereal: 'ethereal.email',
    kreata: 'kreata.ee',
    jogeva: 'jõgeva.öö',
    alternative: 'alternative.domain',
    neti: 'neti.ee',
    zone: 'zone.eu',
    pangalink: 'pangalink.net',
    tr: 'tr.ee',
    domain: 'domain.dom'
};

// Helper function to generate email addresses
const getTestEmail = (username, domain = TEST_DOMAINS.example) => `${username}@${domain}`;

// Export for both CommonJS and ES modules
module.exports = {
    TEST_USERS,
    TEST_PASSWORDS,
    TEST_DOMAINS,
    getTestEmail
};
