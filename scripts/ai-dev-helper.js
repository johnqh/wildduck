#!/usr/bin/env node
/**
 * AI Development Helper Script
 * Provides quick diagnostics and context for AI-assisted development
 */

const config = require('wild-config');
const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AIDevHelper {
    constructor() {
        this.context = {
            mongodb: { status: 'unknown', collections: [] },
            redis: { status: 'unknown' },
            mail_box_indexer: { status: 'unknown', url: null },
            configuration: { status: 'unknown', errors: [] },
            tests: { last_run: null, status: 'unknown' }
        };
    }

    async checkMongoDB() {
        try {
            const client = new MongoClient(config.dbs.mongo);
            await client.connect();
            const db = client.db();
            const collections = await db.listCollections().toArray();
            this.context.mongodb = {
                status: 'connected',
                collections: collections.map(c => c.name),
                url: config.dbs.mongo.replace(/\/\/[^@]*@/, '//***:***@') // Hide credentials
            };
            await client.close();
        } catch (err) {
            this.context.mongodb = {
                status: 'failed',
                error: err.message,
                url: config.dbs.mongo?.replace(/\/\/[^@]*@/, '//***:***@') || 'not configured'
            };
        }
    }

    async checkRedis() {
        try {
            const redis = new Redis(config.dbs.redis);
            await redis.ping();
            const info = await redis.info('server');
            this.context.redis = {
                status: 'connected',
                version: info.match(/redis_version:([^\r\n]*)/)?.[1] || 'unknown',
                url: config.dbs.redis.host + ':' + config.dbs.redis.port
            };
            redis.disconnect();
        } catch (err) {
            this.context.redis = {
                status: 'failed',
                error: err.message
            };
        }
    }

    async checkMailBoxIndexer() {
        try {
            const indexerUrl = config.mailBoxIndexerUrl || process.env.MAIL_BOX_INDEXER_URL || 'http://localhost:42069';
            const response = await axios.get(`${indexerUrl}/health`, { timeout: 5000 }).catch(() => {
                // Try a simple ping if /health doesn't exist
                return axios.get(indexerUrl, { timeout: 5000 });
            });
            
            this.context.mail_box_indexer = {
                status: 'connected',
                url: indexerUrl,
                response_status: response.status
            };
        } catch (err) {
            this.context.mail_box_indexer = {
                status: 'failed',
                url: config.mailBoxIndexerUrl || process.env.MAIL_BOX_INDEXER_URL || 'http://localhost:42069',
                error: err.code || err.message
            };
        }
    }

    async checkConfiguration() {
        try {
            const configErrors = [];
            
            // Check required configurations
            if (!config.dbs?.mongo) configErrors.push('MongoDB connection not configured');
            if (!config.dbs?.redis) configErrors.push('Redis connection not configured');
            
            // Check protocol configurations
            const protocols = ['imap', 'pop3', 'lmtp', 'api'];
            protocols.forEach(protocol => {
                if (!config[protocol]) configErrors.push(`${protocol} configuration missing`);
            });

            this.context.configuration = {
                status: configErrors.length > 0 ? 'has_issues' : 'valid',
                errors: configErrors,
                loaded_configs: Object.keys(config)
            };
        } catch (err) {
            this.context.configuration = {
                status: 'failed',
                error: err.message
            };
        }
    }

    async checkTests() {
        try {
            const testResultFile = path.join(__dirname, '../test/TEST-RESULTS.md');
            if (fs.existsSync(testResultFile)) {
                const content = fs.readFileSync(testResultFile, 'utf8');
                const lastRun = content.match(/Last Updated: ([^\n]*)/)?.[1];
                const testStatus = content.includes('❌') ? 'has_failures' : 'passing';
                
                this.context.tests = {
                    status: testStatus,
                    last_run: lastRun,
                    results_file: testResultFile
                };
            } else {
                this.context.tests = {
                    status: 'no_results',
                    last_run: null,
                    message: 'Run npm test to generate test results'
                };
            }
        } catch (err) {
            this.context.tests = {
                status: 'unknown',
                error: err.message
            };
        }
    }

    getQuickCommands() {
        return {
            'Test Everything': 'npm test',
            'Test API Only': 'NODE_ENV=test grunt mochaTest:api',
            'Test Blockchain Auth': 'NODE_ENV=test npx mocha test --grep "signature" --timeout 10000',
            'Check Code Quality': 'grunt eslint', 
            'Start Server': 'npm start',
            'Validate Config': 'npm run printconf',
            'Start mail_box_indexer': 'cd mail_box_indexer && npm run dev'
        };
    }

    getArchitectureOverview() {
        return {
            entry_points: {
                'server.js': 'Master process with clustering',
                'worker.js': 'Protocol servers and services'
            },
            protocols: {
                'imap.js': 'IMAP4 email client connections',
                'pop3.js': 'POP3 simple retrieval',
                'lmtp.js': 'Local mail delivery',
                'api.js': 'RESTful HTTP API',
                'acme.js': 'SSL certificate management'
            },
            core_handlers: {
                'lib/user-handler.js': 'User management and blockchain auth',
                'lib/message-handler.js': 'Email message processing',
                'lib/mailbox-handler.js': 'IMAP folder operations',
                'lib/signature-verifier.js': 'Blockchain signature verification'
            },
            storage: {
                'MongoDB': 'Primary data store',
                'Redis': 'Caching and sessions',
                'GridFS': 'Attachment storage',
                'Elasticsearch': 'Full-text search (optional)'
            }
        };
    }

    async runDiagnostics() {
        console.log('🔍 Running AI Development Diagnostics...\n');
        
        await Promise.all([
            this.checkMongoDB(),
            this.checkRedis(),
            this.checkMailBoxIndexer(),
            this.checkConfiguration(),
            this.checkTests()
        ]);

        return this.context;
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            overall_status: this.getOverallStatus(),
            services: this.context,
            quick_commands: this.getQuickCommands(),
            architecture: this.getArchitectureOverview(),
            recommendations: this.getRecommendations()
        };

        return report;
    }

    getOverallStatus() {
        const services = Object.values(this.context);
        const connected = services.filter(s => s.status === 'connected' || s.status === 'valid' || s.status === 'passing').length;
        const total = services.length;
        
        if (connected === total) return '🟢 All systems operational';
        if (connected > total / 2) return '🟡 Some issues detected';
        return '🔴 Multiple issues require attention';
    }

    getRecommendations() {
        const recommendations = [];
        
        if (this.context.mongodb.status === 'failed') {
            recommendations.push('Start MongoDB service or check connection configuration');
        }
        
        if (this.context.redis.status === 'failed') {
            recommendations.push('Start Redis service or check connection configuration');
        }
        
        if (this.context.mail_box_indexer.status === 'failed') {
            recommendations.push('Start mail_box_indexer service: cd mail_box_indexer && npm run dev');
        }
        
        if (this.context.configuration.status === 'has_issues') {
            recommendations.push('Fix configuration issues: ' + this.context.configuration.errors.join(', '));
        }
        
        if (this.context.tests.status === 'no_results') {
            recommendations.push('Run tests to establish baseline: npm test');
        }
        
        return recommendations;
    }

    async printReport() {
        await this.runDiagnostics();
        const report = this.generateReport();
        
        console.log(`\n📊 WildDuck AI Development Report`);
        console.log(`${report.overall_status}`);
        console.log(`Generated: ${report.timestamp}\n`);
        
        // Services Status
        console.log('🔧 Services Status:');
        Object.entries(report.services).forEach(([service, info]) => {
            const icon = info.status === 'connected' || info.status === 'valid' || info.status === 'passing' ? '✅' : '❌';
            console.log(`  ${icon} ${service}: ${info.status}`);
            if (info.error) console.log(`     Error: ${info.error}`);
            if (info.url) console.log(`     URL: ${info.url}`);
        });
        
        // Quick Commands
        console.log('\n⚡ Quick Commands:');
        Object.entries(report.quick_commands).forEach(([name, cmd]) => {
            console.log(`  ${name}: ${cmd}`);
        });
        
        // Recommendations
        if (report.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            report.recommendations.forEach(rec => console.log(`  • ${rec}`));
        }
        
        console.log('\n📁 Key Files to Understand:');
        console.log('  • CLAUDE.md - AI development guidelines');
        console.log('  • lib/user-handler.js - Authentication and user management');
        console.log('  • lib/signature-verifier.js - Blockchain signature verification');
        console.log('  • config/*.toml - Service configurations');
        
        return report;
    }
}

// CLI Usage
if (require.main === module) {
    const helper = new AIDevHelper();
    
    const command = process.argv[2];
    switch (command) {
        case 'status':
        case 'report':
        default:
            helper.printReport().catch(console.error);
            break;
        case 'json':
            helper.runDiagnostics()
                .then(() => console.log(JSON.stringify(helper.generateReport(), null, 2)))
                .catch(console.error);
            break;
        case 'help':
            console.log(`
AI Development Helper

Usage: node scripts/ai-dev-helper.js [command]

Commands:
  status, report (default) - Print formatted diagnostic report  
  json                     - Output JSON report
  help                     - Show this help

Examples:
  node scripts/ai-dev-helper.js
  node scripts/ai-dev-helper.js json | jq '.services'
            `);
            break;
    }
}

module.exports = AIDevHelper;