'use strict';

/**
 * Centralized test configuration
 * All test usernames and related constants should be defined here
 * Maps existing test values to maintain consistency
 */

// Test usernames (keeping original values)
const TEST_USERS = {
    testuser: 'testuser',
    testuser1: 'testuser1',
    testuser2: 'testuser2',
    testuser3: 'testuser3',
    testuser4: 'testuser4',
    testuser5: 'testuser5',
    testuser6: 'testuser6',
    testuser7: 'testuser7',
    myuser2: 'myuser2',
    myuser2hash: 'myuser2hash',
    desuser: 'desuser',
    user1: 'user1',
    user2: 'user2',
    user3: 'user3',
    user4: 'user4',
    user5: 'user5',
    user1_1_addrtest: 'user1.1.addrtest',
    user1_2_addrtest: 'user1.2.addrtest',
    user2_1_addrtest: 'user2.1.addrtest',
    filteruser: 'filteruser',
    filteruser2: 'filteruser2',
    filteruser_addrtest: 'filteruser.addrtest',
    filteruser2_addrtest: 'filteruser2.addrtest',
    addressuser: 'addressuser',
    addressuser2: 'addressuser2',
    addressuser_addrtest: 'addressuser.addrtest',
    addressuser2_addrtest: 'addressuser2.addrtest',
    storageuser: 'storageuser',
    storageuser_addrtest: 'storageuser.addrtest',
    mailboxuser: 'mailboxuser',
    mailboxesuser: 'mailboxesuser',
    mailboxesuser_addrtest: 'mailboxesuser.addrtest',
    john: 'john',
    alias1: 'alias1',
    alias2: 'alias2',
    forwarded_1_addrtest: 'forwarded.1.addrtest',
    andris: 'andris',
    my_new_address: 'my.new.address',
    my_old_address: 'my.old.address',
    note: 'note',
    user: 'user',
    sender: 'sender',
    receiver: 'receiver',
    andris1: 'andris1',
    andris2: 'andris2',
    to: 'to',
    cc: 'cc'
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
    tr: 'tr.ee'
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