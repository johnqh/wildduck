'use strict';

/**
 * EML Template Generator
 * Generates dynamic EML files from templates using test configuration
 */

const fs = require('fs');
const path = require('path');
const { TEST_USERS, getTestEmail, TEST_DOMAINS } = require('../test-config');

class EmlGenerator {
    constructor(templatesDir, outputDir) {
        this.templatesDir = templatesDir || path.join(__dirname, '../../imap-core/test/fixtures/templates');
        this.outputDir = outputDir || path.join(__dirname, '../../imap-core/test/fixtures/generated');
        this.placeholders = this.getPlaceholders();
    }

    /**
     * Get default placeholder values from test config
     */
    getPlaceholders() {
        return {
            SENDER_EMAIL: getTestEmail(TEST_USERS.sender),
            TO_EMAIL: getTestEmail(TEST_USERS.to),
            CC_EMAIL: getTestEmail(TEST_USERS.cc),
            RECEIVER_EMAIL: getTestEmail(TEST_USERS.receiver),
            ANDRIS_KREATA_EMAIL: getTestEmail(TEST_USERS.andris, TEST_DOMAINS.kreata),
            ANDRIS_TR_EMAIL: getTestEmail(TEST_USERS.andris, TEST_DOMAINS.tr),
            ANDRIS_PANGALINK_EMAIL: getTestEmail(TEST_USERS.andris, TEST_DOMAINS.pangalink),
            RFINNIE_EMAIL: getTestEmail(TEST_USERS.rfinnie, TEST_DOMAINS.domain),
            BOB_EMAIL: getTestEmail(TEST_USERS.bob, TEST_DOMAINS.domain),
            TEST_DOMAIN: TEST_DOMAINS.example
        };
    }

    /**
     * Generate EML file from template
     * @param {string} templateName - Name of template file (without .template extension)
     * @param {Object} customPlaceholders - Override default placeholders
     * @returns {string} Path to generated file
     */
    generateFromTemplate(templateName, customPlaceholders = {}) {
        const templatePath = path.join(this.templatesDir, `${templateName}.eml.template`);
        const outputPath = path.join(this.outputDir, `${templateName}.eml`);

        // Check if template exists
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Read template content as binary to preserve line endings
        let content = fs.readFileSync(templatePath, 'binary');

        // Merge default and custom placeholders
        const placeholders = { ...this.placeholders, ...customPlaceholders };

        // Replace placeholders
        for (const [placeholder, value] of Object.entries(placeholders)) {
            const regex = new RegExp(`{{${placeholder}}}`, 'g');
            content = content.replace(regex, value);
        }

        // Write generated file as binary to preserve CRLF line endings
        fs.writeFileSync(outputPath, content, 'binary');

        console.log(`Generated EML: ${outputPath}`);
        return outputPath;
    }

    /**
     * Generate all available templates
     * @param {Object} customPlaceholders - Override default placeholders
     * @returns {Array} Array of generated file paths
     */
    generateAll(customPlaceholders = {}) {
        const generatedFiles = [];

        if (!fs.existsSync(this.templatesDir)) {
            console.warn(`Templates directory not found: ${this.templatesDir}`);
            return generatedFiles;
        }

        const templateFiles = fs.readdirSync(this.templatesDir).filter(file => file.endsWith('.eml.template'));

        for (const templateFile of templateFiles) {
            const templateName = templateFile.replace('.eml.template', '');
            try {
                const generatedPath = this.generateFromTemplate(templateName, customPlaceholders);
                generatedFiles.push(generatedPath);
            } catch (error) {
                console.error(`Failed to generate ${templateName}:`, error.message);
            }
        }

        console.log(`Generated ${generatedFiles.length} EML files from templates`);
        return generatedFiles;
    }

    /**
     * Clean up generated files
     */
    cleanup() {
        if (fs.existsSync(this.outputDir)) {
            const files = fs.readdirSync(this.outputDir);
            for (const file of files) {
                if (file.endsWith('.eml')) {
                    fs.unlinkSync(path.join(this.outputDir, file));
                }
            }
            console.log(`Cleaned up ${files.length} generated EML files`);
        }
    }

    /**
     * Verify generated file matches expected format
     * @param {string} generatedPath - Path to generated file
     * @param {string} originalPath - Path to original file for comparison
     * @returns {boolean} True if basic structure matches
     */
    verifyGenerated(generatedPath, originalPath) {
        if (!fs.existsSync(generatedPath) || !fs.existsSync(originalPath)) {
            return false;
        }

        const generated = fs.readFileSync(generatedPath, 'utf8');
        const original = fs.readFileSync(originalPath, 'utf8');

        // Basic checks: line count, header presence, structure
        const generatedLines = generated.split('\n').length;
        const originalLines = original.split('\n').length;

        // Allow for minor line count differences
        if (Math.abs(generatedLines - originalLines) > 2) {
            console.warn(`Line count mismatch: generated=${generatedLines}, original=${originalLines}`);
            return false;
        }

        // Check for presence of email headers
        const hasFromHeader = generated.includes('from:') || generated.includes('From:');
        const hasToHeader = generated.includes('to:') || generated.includes('To:');

        if (!hasFromHeader || !hasToHeader) {
            console.warn('Missing required email headers in generated file');
            return false;
        }

        return true;
    }
}

// Export for both CommonJS and ES modules
module.exports = EmlGenerator;

// CLI usage
if (require.main === module) {
    const generator = new EmlGenerator();

    const command = process.argv[2];
    const templateName = process.argv[3];

    switch (command) {
        case 'generate':
            if (templateName) {
                generator.generateFromTemplate(templateName);
            } else {
                generator.generateAll();
            }
            break;
        case 'cleanup':
            generator.cleanup();
            break;
        case 'verify':
            if (templateName) {
                const generated = path.join(generator.outputDir, `${templateName}.eml`);
                const original = path.join(path.dirname(generator.templatesDir), `${templateName}.eml`);
                const isValid = generator.verifyGenerated(generated, original);
                console.log(`Verification ${isValid ? 'PASSED' : 'FAILED'}: ${templateName}`);
                process.exit(isValid ? 0 : 1);
            }
            break;
        default:
            console.log('Usage: node eml-generator.js [generate|cleanup|verify] [template-name]');
            console.log('  generate [name] - Generate specific template or all templates');
            console.log('  cleanup         - Remove all generated files');
            console.log('  verify [name]   - Verify generated file structure');
    }
}