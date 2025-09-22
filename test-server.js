// Test server startup script that bypasses ElasticSearch hanging issue
'use strict';

process.env.UV_THREADPOOL_SIZE = 16;
process.env.NODE_ENV = 'test';

const v8 = require('node:v8');
const Path = require('path');
const os = require('os');
const config = require('wild-config');

// Disable tasks for integration testing to avoid hanging issues
config.tasks.enabled = false;

// Enable API accessToken for integration testing
config.api = config.api || {};
config.api.accessToken = "testtoken123";

if (process.env.NODE_CONFIG_ONLY === 'true') {
    console.log(require('util').inspect(config, false, 22)); // eslint-disable-line
    return process.exit();
}

const errors = require('./lib/errors');
const fs = require('fs');
const log = require('npmlog');
const packageData = require('./package.json');

log.level = config.log.level;

const printLogo = () => {
    let logo = fs
        .readFileSync(__dirname + '/logo.txt', 'utf-8')
        .replace(/^\n+|\n+$/g, '')
        .split('\n');

    let columnLength = logo.map(l => l.length).reduce((max, val) => (val > max ? val : max), 0);
    let versionString = ' ' + packageData.name + '@' + packageData.version + ' ';
    let versionPrefix = '-'.repeat(Math.round(columnLength / 2 - versionString.length / 2));
    let versionSuffix = '-'.repeat(columnLength - versionPrefix.length - versionString.length);

    log.info('App', ' ' + '-'.repeat(columnLength));
    log.info('App', '');

    logo.forEach(line => {
        log.info('App', ' ' + line);
    });

    log.info('App', '');
    log.info('App', ' ' + versionPrefix + versionString + versionSuffix);
    log.info('App', '');
};

let processCount = config.processes;
if (processCount) {
    if (/^\s*cpus\s*$/i.test(processCount)) {
        processCount = os.cpus().length;
    }

    if (typeof processCount !== 'number' && !isNaN(processCount)) {
        processCount = Number(processCount);
    }

    if (isNaN(processCount)) {
        processCount = 1;
    }
}

if (!processCount || processCount <= 1) {
    printLogo();
    if (config.ident) {
        process.title = config.ident;
    }
    // single process mode, do not fork anything

    // Skip ElasticSearch initialization that causes hanging
    // and go directly to loading worker.js
    console.log('Test server: Skipping ElasticSearch initialization');
    console.log('Test server: About to load worker.js');
    require('./worker.js');
    console.log('Test server: worker.js require completed');
} else {
    let cluster = require('cluster');

    if (cluster.isMaster) {
        printLogo();

        if (config.ident) {
            process.title = config.ident + ' master';
        }

        log.info('App', `Master [${process.pid}] is running`);

        // Fork workers.
        for (let i = 0; i < processCount; i++) {
            cluster.fork();
        }

        cluster.on('exit', (worker, code, signal) => {
            log.info('App', `Worker ${worker.process.pid} died with signal ${signal || code}. Restarting...`);
            cluster.fork();
        });
    } else {
        if (config.ident) {
            process.title = config.ident + ' worker';
        }
        // Skip ElasticSearch for workers too
        require('./worker.js');

        log.info('App', `Worker [${process.pid}] is running`);
    }
}