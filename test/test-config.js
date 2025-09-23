'use strict';

/**
 * Centralized test configuration
 * All test usernames and related constants should be defined here
 * Maps existing test values to maintain consistency
 */

// Test usernames (appended 'xx' for final verification)
const TEST_USERS = {
    testuser: 'testuserxx',
    testuser1: 'testuser1xx',
    testuser2: 'testuser2xx',
    testuser3: 'testuser3xx',
    testuser4: 'testuser4xx',
    testuser5: 'testuser5xx',
    testuser6: 'testuser6xx',
    testuser7: 'testuser7xx',
    myuser2: 'myuser2xx',
    myuser2hash: 'myuser2hashxx',
    desuser: 'desuserxx',
    user1: 'user1xx',
    user2: 'user2xx',
    user3: 'user3xx',
    user4: 'user4xx',
    user5: 'user5xx',
    user1_1_addrtest: 'user1xx.1.addrtest',
    user1_2_addrtest: 'user1xx.2.addrtest',
    user2_1_addrtest: 'user2xx.1.addrtest',
    filteruser: 'filteruserxx',
    filteruser2: 'filteruser2xx',
    filteruser_addrtest: 'filteruserxx.addrtest',
    filteruser2_addrtest: 'filteruser2xx.addrtest',
    addressuser: 'addressuserxx',
    addressuser2: 'addressuser2xx',
    addressuser_addrtest: 'addressuserxx.addrtest',
    addressuser2_addrtest: 'addressuser2xx.addrtest',
    storageuser: 'storageuserxx',
    storageuser_addrtest: 'storageuserxx.addrtest',
    mailboxuser: 'mailboxuserxx',
    mailboxesuser: 'mailboxesuserxx',
    mailboxesuser_addrtest: 'mailboxesuserxx.addrtest',
    john: 'johnxx',
    alias1: 'alias1xx',
    alias2: 'alias2xx',
    forwarded_1_addrtest: 'forwardedxx.1.addrtest',
    andris: 'andrisxx',
    my_new_address: 'my.new.addressxx',
    my_old_address: 'my.old.addressxx',
    note: 'notexx',
    user: 'userxx',
    sender: 'senderxx',
    receiver: 'receiverxx',
    andris1: 'andris1xx',
    andris2: 'andris2xx',
    to: 'toxx',
    cc: 'ccxx',
    rfinnie: 'rfinniexx',
    bob: 'bobxx'
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
