#!/usr/bin/env node
/**
 * AI Assistant Script for WildDuck Development
 * Provides comprehensive context and helpers for AI-assisted development
 */

const fs = require('fs');
const path = require('path');
const config = require('wild-config');

class WildDuckAIAssistant {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.cache = new Map();
    }

    /**
     * Get current project state and recent changes
     */
    getProjectState() {
        const packageJson = this.readJSONFile('package.json');
        const gitLog = this.executeCommand('git log --oneline -10');
        const gitStatus = this.executeCommand('git status --porcelain');

        return {
            version: packageJson?.version || 'unknown',
            recentCommits: gitLog?.split('\n').slice(0, 5) || [],
            uncommittedChanges: gitStatus?.split('\n').filter(line => line.trim()) || [],
            lastModified: this.getLastModified(),
            activeFeatures: this.getActiveFeatures()
        };
    }

    /**
     * Analyze codebase structure for AI understanding
     */
    analyzeCodebase() {
        const structure = {
            entryPoints: this.scanFiles(['server.js', 'worker.js', 'imap.js', 'pop3.js', 'lmtp.js', 'api.js']),
            handlers: this.scanDirectory('lib', name => name.endsWith('-handler.js')),
            apiEndpoints: this.scanDirectory('lib/api', name => name.endsWith('.js')),
            schemas: this.scanDirectory('lib/schemas', name => name.endsWith('.js')),
            tests: this.scanDirectory('test', name => name.endsWith('.js')),
            configs: this.scanDirectory('config', name => name.endsWith('.toml'))
        };

        return structure;
    }

    /**
     * Get blockchain authentication context
     */
    getBlockchainContext() {
        return {
            supportedIdentities: ['EVM Addresses (0x...)', 'Base64 EVM Addresses', 'Solana Addresses (Base58)', 'ENS Names (.eth, .box)', 'SNS Names (.sol)'],
            authenticationFlow: [
                'Username validation via indexer',
                'Address resolution for ENS/SNS',
                'Signature verification via indexer',
                'Account auto-creation'
            ],
            indexerEndpoints: {
                validation: 'GET /api/addresses/validate/:address',
                verification: 'POST /api/signature/verify'
            },
            disabledEndpoints: ['POST /users/:user/addresses', 'PUT /users/:user/addresses/:id', 'DELETE /users/:user/addresses/:address']
        };
    }

    /**
     * Get common development patterns
     */
    getDevelopmentPatterns() {
        return {
            handlerPattern: `
// Handler Class Pattern
class XHandler {
    constructor(options) {
        this.database = options.database;
        this.users = options.users;
    }
    
    async asyncMethod(params) {
        // Use async/await for new code
        // Maintain callback fallbacks
    }
}`,
            apiPattern: `
// API Endpoint Pattern
server.post({
    path: '/api/endpoint',
    validationObjs: { /* Joi schemas */ }
}, tools.responseWrapper(async (req, res) => {
    req.validate(roles.can(req.role).createAny('resource'));
    const result = await handler.doSomething();
    return res.json({ success: true, data: result });
}));`,
            errorPattern: `
// Error Handling Pattern
let err = new Error('Description');
err.code = 'MACHINE_READABLE_CODE';
err.responseCode = 400;
throw err;`,
            testPattern: `
// Test Pattern
describe('Component', () => {
    beforeEach(async () => {
        await db.users.deleteMany({});
    });
    
    it('should handle operation', async () => {
        const result = await handler.method(params);
        expect(result).to.have.property('success', true);
    });
});`
        };
    }

    /**
     * Get quick reference commands
     */
    getQuickReference() {
        return {
            development: {
                'Start server': 'npm start',
                'Validate config': 'npm run printconf',
                'Run all tests': 'npm test',
                'Run API tests': 'NODE_ENV=test npx grunt mochaTest:api --force',
                'Check code quality': 'npx grunt eslint',
                'Run blockchain tests': 'NODE_ENV=test npx mocha test --grep "signature"'
            },
            debugging: {
                'Environment check': 'node scripts/ai-dev-helper.js',
                'Config validation': 'NODE_CONFIG_ONLY=true node server.js',
                'Database inspect': 'mongosh wildduck',
                'Redis inspect': 'redis-cli',
                'Check indexer': 'curl http://localhost:42069/health'
            },
            git: {
                'Recent commits': 'git log --oneline -10',
                'Current status': 'git status',
                'File changes': 'git diff --name-status',
                'Staged changes': 'git diff --cached'
            }
        };
    }

    /**
     * Check for common issues and provide solutions
     */
    getIssueResolutions() {
        const issues = [];

        // Check for common configuration issues
        try {
            if (!config.dbs?.mongo) {
                issues.push({
                    type: 'config',
                    issue: 'MongoDB connection not configured',
                    solution: 'Set MONGODB_URL environment variable or configure in config/dbs.toml'
                });
            }

            if (!config.mailBoxIndexerUrl && !process.env.INDEXER_BASE_URL) {
                issues.push({
                    type: 'config',
                    issue: 'Indexer service URL not configured',
                    solution: 'Set INDEXER_BASE_URL environment variable or configure mailBoxIndexerUrl'
                });
            }
        } catch (err) {
            issues.push({
                type: 'config',
                issue: 'Configuration loading failed',
                solution: 'Check config files in config/ directory for syntax errors'
            });
        }

        // Check for missing dependencies
        const packageJson = this.readJSONFile('package.json');
        const requiredDeps = ['mongodb', 'ioredis', 'axios', 'wild-config'];
        requiredDeps.forEach(dep => {
            if (!packageJson?.dependencies?.[dep]) {
                issues.push({
                    type: 'dependency',
                    issue: `Missing required dependency: ${dep}`,
                    solution: `Run: npm install ${dep}`
                });
            }
        });

        return issues;
    }

    /**
     * Generate comprehensive AI context
     */
    generateAIContext() {
        const context = {
            timestamp: new Date().toISOString(),
            projectState: this.getProjectState(),
            codebaseAnalysis: this.analyzeCodebase(),
            blockchainContext: this.getBlockchainContext(),
            developmentPatterns: this.getDevelopmentPatterns(),
            quickReference: this.getQuickReference(),
            issueResolutions: this.getIssueResolutions(),
            recommendations: this.getAIRecommendations()
        };

        return context;
    }

    /**
     * Get AI-specific recommendations
     */
    getAIRecommendations() {
        return [
            'Always read existing code before making changes to understand patterns',
            'Use CLAUDE.md for comprehensive project context and guidelines',
            'Follow established error handling patterns with proper codes',
            'Test changes with appropriate test suites before committing',
            'Use wild-config for configuration management with environment fallbacks',
            'Leverage existing handler classes for database operations',
            'Maintain blockchain authentication patterns for new features',
            'Use helper methods in message-handler.js for complex operations',
            'Update documentation when adding significant functionality'
        ];
    }

    // Utility methods
    readJSONFile(filename) {
        try {
            const content = fs.readFileSync(path.join(this.projectRoot, filename), 'utf8');
            return JSON.parse(content);
        } catch (err) {
            return null;
        }
    }

    executeCommand(command) {
        try {
            const { execSync } = require('child_process');
            return execSync(command, { cwd: this.projectRoot, encoding: 'utf8' });
        } catch (err) {
            return null;
        }
    }

    scanFiles(files) {
        return files.map(file => {
            const fullPath = path.join(this.projectRoot, file);
            return {
                name: file,
                exists: fs.existsSync(fullPath),
                size: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0,
                lastModified: fs.existsSync(fullPath) ? fs.statSync(fullPath).mtime : null
            };
        });
    }

    scanDirectory(dir, filter = () => true) {
        const fullPath = path.join(this.projectRoot, dir);
        if (!fs.existsSync(fullPath)) return [];

        try {
            return fs
                .readdirSync(fullPath)
                .filter(filter)
                .map(file => ({
                    name: file,
                    path: path.join(dir, file),
                    size: fs.statSync(path.join(fullPath, file)).size,
                    lastModified: fs.statSync(path.join(fullPath, file)).mtime
                }));
        } catch (err) {
            return [];
        }
    }

    getLastModified() {
        const importantFiles = ['lib/user-handler.js', 'lib/api/addresses.js', 'lib/signature-verifier.js', 'package.json', 'CLAUDE.md'];

        return importantFiles
            .map(file => {
                const fullPath = path.join(this.projectRoot, file);
                if (fs.existsSync(fullPath)) {
                    return {
                        file,
                        lastModified: fs.statSync(fullPath).mtime
                    };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => b.lastModified - a.lastModified);
    }

    getActiveFeatures() {
        const features = [];

        // Check for blockchain features
        if (fs.existsSync(path.join(this.projectRoot, 'lib/signature-verifier.js'))) {
            features.push('Blockchain Authentication');
        }

        // Check for disabled endpoints
        const addressesApi = fs.readFileSync(path.join(this.projectRoot, 'lib/api/addresses.js'), 'utf8');
        if (addressesApi.includes('EndpointDisabled')) {
            features.push('Disabled Address Management');
        }

        return features;
    }

    /**
     * Run interactive AI assistant
     */
    async run() {
        console.log('🤖 WildDuck AI Development Assistant');
        console.log('====================================\n');

        const context = this.generateAIContext();

        console.log(`📊 Project Status: ${context.projectState.version}`);
        console.log(`🔧 Active Features: ${context.projectState.activeFeatures.join(', ') || 'None detected'}`);
        console.log(`📝 Recent Commits: ${context.projectState.recentCommits[0] || 'None'}\n`);

        if (context.issueResolutions.length > 0) {
            console.log('⚠️  Issues Detected:');
            context.issueResolutions.forEach(issue => {
                console.log(`   ${issue.type}: ${issue.issue}`);
                console.log(`   Solution: ${issue.solution}\n`);
            });
        } else {
            console.log('✅ No issues detected\n');
        }

        console.log('🚀 Quick Commands:');
        Object.entries(context.quickReference.development).forEach(([desc, cmd]) => {
            console.log(`   ${desc}: ${cmd}`);
        });

        console.log('\n💡 AI Recommendations:');
        context.recommendations.slice(0, 3).forEach(rec => {
            console.log(`   • ${rec}`);
        });

        console.log('\n📋 For full context, check:');
        console.log('   • CLAUDE.md - Comprehensive project guide');
        console.log('   • .ai-project-context.md - AI-specific context');
        console.log('   • scripts/ai-dev-helper.js - Service diagnostics');

        // Save context to file for AI reference
        fs.writeFileSync(path.join(this.projectRoot, '.ai-current-context.json'), JSON.stringify(context, null, 2));
        console.log('\n💾 Current context saved to .ai-current-context.json');
    }
}

// Run if called directly
if (require.main === module) {
    const assistant = new WildDuckAIAssistant();
    assistant.run().catch(console.error);
}

module.exports = WildDuckAIAssistant;
