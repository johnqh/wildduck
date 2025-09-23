#!/usr/bin/env node

'use strict';

// Script to drop test database without mongosh dependency
const { MongoClient } = require('mongodb');

const uri = 'mongodb://127.0.0.1:27017';
const dbName = 'wildduck-test';

async function dropDatabase() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        await db.dropDatabase();
        console.log(`Database ${dbName} dropped successfully`);
    } catch (error) {
        if (error.message.includes('ns not found')) {
            console.log(`Database ${dbName} does not exist, nothing to drop`);
        } else {
            console.error('Error dropping database:', error.message);
            process.exit(1);
        }
    } finally {
        await client.close();
    }
}

dropDatabase();
