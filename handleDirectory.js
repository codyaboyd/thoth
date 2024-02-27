const fs = require('fs').promises;
const http = require('http');
const path = require('path');
const { getLanguageFromExtension,isValidFileType } = require('./utils.js');

class DocumentationGenerator {
    constructor() {
        this.apiHost = '127.0.0.1';
        this.apiPort = 8080;
        // Base prompt without specifying the language
        this.basePrompt = "Write documentation to describe the logic in the following code using markdown: ";
    }

    async generateForDirectory(directoryPath) {
        await this.processDirectory(directoryPath, directoryPath);
    }

    async processDirectory(currentPath, rootPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (let entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                await this.processDirectory(fullPath, rootPath);
            } else if (entry.isFile() && isValidFileType(entry.name)) {
                await this.processFile(fullPath, rootPath);
            }
        }
    }

    async processFile(filePath, rootPath) {
        console.log('Processing: ' + filePath);
        const data = await fs.readFile(filePath, { encoding: 'utf8' });
        const language = getLanguageFromExtension(filePath);
        const documentation = await this.generateDocumentation(data, language);
        const relativePath = path.relative(rootPath, filePath);
        const markdownPath = path.join(rootPath, 'docs', relativePath.replace(/\.(js|py|sol|rs|ts)$/, '.md'));
        await this.saveFile(markdownPath, documentation);
        console.log('Completed: ' + filePath);
    }

    async generateDocumentation(fileContent, language) {
        const prompt = `${this.basePrompt} [${language}] ` + fileContent;
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
        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(filePath, content, { encoding: 'utf8' });
    }
}

module.exports = async (directoryPath) => {
    const generator = new DocumentationGenerator();
    await generator.generateForDirectory(directoryPath);
};
