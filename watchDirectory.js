const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const { getLanguageFromExtension,isValidFileType } = require('./utils.js');

class DocumentationGenerator {
    constructor() {
        this.apiHost = '127.0.0.1';
        this.apiPort = 8080;
        this.basePrompt = "Write documentation to describe the logic in the following ";
        this.fileHashes = new Map();
        this.processingFiles = new Map(); // Track files being processed
    }

    async watchDirectory(directoryPath) {
        await this.initialScan(directoryPath, directoryPath);
        fs.watch(directoryPath, { recursive: true }, (eventType, filename) => {
            if (!isValidFileType(filename)) return;
            if (filename.includes('node_modules')) return; // Ignore node_modules
            const filePath = path.join(directoryPath, filename);
            this.enqueueFile(filePath, directoryPath);
        });
    }

    async initialScan(currentPath, rootPath) {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        for (let entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            if (fullPath.includes('node_modules')) continue; // Ignore node_modules
            if (entry.isDirectory()) {
                await this.initialScan(fullPath, rootPath);
            } else if (entry.isFile() && isValidFileType(entry.name)) {
                this.enqueueFile(fullPath, rootPath);
            }
        }
    }

    enqueueFile(filePath, rootPath) {
        // Mark the file as updated during processing or enqueue for the first time
        this.processingFiles.set(filePath, { status: 'updated', rootPath });
        if (!this.processingFiles.get(filePath)?.processing) {
            this.handleFileChange(filePath, rootPath);
        }
    }

    async handleFileChange(filePath, rootPath) {
        // Mark as currently processing
        this.processingFiles.set(filePath, { ...this.processingFiles.get(filePath), processing: true, status: 'processing' });
        const exists = fs.existsSync(filePath);
        if (!exists) {
            this.fileHashes.delete(filePath);
            const markdownPath = this.getMarkdownPath(filePath, rootPath);
            if (fs.existsSync(markdownPath)) {
                fs.promises.unlink(markdownPath);
            }
            this.processingFiles.delete(filePath); // Remove from processing map
        } else {
            await this.processFile(filePath, rootPath, false);
            // Check if the file was updated during processing
            if (this.processingFiles.get(filePath)?.status === 'updated') {
                this.handleFileChange(filePath, rootPath); // Restart processing for the updated file
                console.log('File updated: ' + filePath);
            } else {
                this.processingFiles.delete(filePath); // Processing completed, remove from map
            }
        }
    }

    async processFile(filePath, rootPath, isInitialScan) {
        const data = await fs.promises.readFile(filePath, { encoding: 'utf8' });
        const currentHash = crypto.createHash('md5').update(data).digest('hex');
        if (this.fileHashes.get(filePath) === currentHash) {
            return; // File has not changed
        }
        this.fileHashes.set(filePath, currentHash);
        const language = getLanguageFromExtension(filePath);
        console.log('Generating markdown docs for: ' + filePath);
        const documentation = await this.generateDocumentation(data, language);
        const markdownPath = this.getMarkdownPath(filePath, rootPath);
        await this.saveFile(markdownPath, documentation);
    }

    getMarkdownPath(filePath, rootPath) {
        const relativePath = path.relative(rootPath, filePath);
        return path.join(rootPath, 'docs', relativePath.replace(/\.(js|py|sol|rs|ts)$/, '.md'));
    }

    async generateDocumentation(fileContent, language) {
        const prompt = `${this.basePrompt}${language} code using markdown: ` + fileContent;
        const postData = JSON.stringify({ prompt: '[INST]' + prompt + '[/INST]' });

        const options = {
            hostname: this.apiHost,
            port: this.apiPort,
            path: '/completion',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(rawData);
                        resolve(parsedData.content || '');
                    } catch (e) {
                        reject(`Error parsing response: ${e.message}`);
                    }
                });
            });

            req.on('error', (e) => {
                reject(`Problem with request: ${e.message}`);
            });

            req.write(postData);
            req.end();
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
