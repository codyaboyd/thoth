const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { getLanguageFromExtension, isValidFileType, getMarkdownPathFromRelativePath } = require('./utils.js');
const { generateDocumentation, DEFAULT_BASE_PROMPT } = require('./aiClient.js');

class DocumentationGenerator {
    constructor() {
        this.apiHost = '127.0.0.1';
        this.apiPort = 8080;
        this.basePrompt = DEFAULT_BASE_PROMPT;
        this.fileHashes = new Map();
        this.processingFiles = new Map();
    }

    async watchDirectory(directoryPath) {
        await this.initialScan(directoryPath, directoryPath);
        fs.watch(directoryPath, { recursive: true }, (_, filename) => {
            if (!filename || !isValidFileType(filename)) return;
            if (filename.includes('node_modules')) return;
            const filePath = path.join(directoryPath, filename);
            this.enqueueFile(filePath, directoryPath);
        });
    }

    async initialScan(currentPath, rootPath) {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            if (fullPath.includes('node_modules')) continue;
            if (entry.isDirectory()) {
                await this.initialScan(fullPath, rootPath);
            } else if (entry.isFile() && isValidFileType(entry.name)) {
                this.enqueueFile(fullPath, rootPath);
            }
        }
    }

    enqueueFile(filePath, rootPath) {
        this.processingFiles.set(filePath, { status: 'updated', rootPath });
        if (!this.processingFiles.get(filePath)?.processing) {
            this.handleFileChange(filePath, rootPath);
        }
    }

    async handleFileChange(filePath, rootPath) {
        this.processingFiles.set(filePath, { ...this.processingFiles.get(filePath), processing: true, status: 'processing' });
        try {
            const exists = fs.existsSync(filePath);
            if (!exists) {
                this.fileHashes.delete(filePath);
                const markdownPath = this.getMarkdownPath(filePath, rootPath);
                if (fs.existsSync(markdownPath)) {
                    await fs.promises.unlink(markdownPath);
                }
                this.processingFiles.delete(filePath);
            } else {
                await this.processFile(filePath, rootPath);
                if (this.processingFiles.get(filePath)?.status === 'updated') {
                    this.handleFileChange(filePath, rootPath);
                    console.log('File updated: ' + filePath);
                } else {
                    this.processingFiles.delete(filePath);
                }
            }
        } catch (error) {
            console.error(`Failed processing ${filePath}: ${error.message}`);
            this.processingFiles.delete(filePath);
        }
    }

    async processFile(filePath, rootPath) {
        const data = await fs.promises.readFile(filePath, { encoding: 'utf8' });
        const currentHash = crypto.createHash('md5').update(data).digest('hex');
        if (this.fileHashes.get(filePath) === currentHash) {
            return;
        }
        this.fileHashes.set(filePath, currentHash);
        const language = getLanguageFromExtension(filePath);
        console.log('Generating markdown docs for: ' + filePath);
        const documentation = await this.generateDocumentation(data, language, filePath);
        const markdownPath = this.getMarkdownPath(filePath, rootPath);
        await this.saveFile(markdownPath, documentation);
    }

    getMarkdownPath(filePath, rootPath) {
        const relativePath = path.relative(rootPath, filePath);
        return path.join(rootPath, 'docs', getMarkdownPathFromRelativePath(relativePath));
    }

    async generateDocumentation(fileContent, language, filePath) {
        return generateDocumentation({
            fileContent,
            language,
            filePath,
            basePrompt: this.basePrompt,
            host: this.apiHost,
            port: this.apiPort,
        });
    }

    async saveFile(filePath, content) {
        const dirPath = path.dirname(filePath);
        await fs.promises.mkdir(dirPath, { recursive: true });
        await fs.promises.writeFile(filePath, content, { encoding: 'utf8' });
        console.log('Saved File: ' + filePath);
    }
}

module.exports = async (directoryPath) => {
    const generator = new DocumentationGenerator();
    await generator.watchDirectory(directoryPath);
    console.log('Watching: ' + directoryPath);
};
