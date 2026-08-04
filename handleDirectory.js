const fs = require('fs').promises;
const path = require('path');
const {
    getLanguageFromExtension,
    isValidFileType,
    getMarkdownPathFromRelativePath,
    isPythonVirtualEnvironment,
} = require('./utils.js');
const { generateDocumentation, DEFAULT_BASE_PROMPT } = require('./aiClient.js');

class DocumentationGenerator {
    constructor() {
        this.apiHost = '127.0.0.1';
        this.apiPort = 8080;
        this.basePrompt = DEFAULT_BASE_PROMPT;
    }

    async generateForDirectory(directoryPath) {
        await this.processDirectory(directoryPath, directoryPath);
    }

    async processDirectory(currentPath, rootPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                if (isPythonVirtualEnvironment(fullPath)) continue;
                await this.processDirectory(fullPath, rootPath);
            } else if (entry.isFile() && isValidFileType(entry.name)) {
                try {
                    await this.processFile(fullPath, rootPath);
                } catch (error) {
                    console.error(`Failed to process ${fullPath}: ${error.message}`);
                }
            }
        }
    }

    async processFile(filePath, rootPath) {
        console.log('Processing: ' + filePath);
        const data = await fs.readFile(filePath, { encoding: 'utf8' });
        const language = getLanguageFromExtension(filePath);
        const documentation = await this.generateDocumentation(data, language, filePath);
        const relativePath = path.relative(rootPath, filePath);
        const markdownPath = path.join(rootPath, 'docs', getMarkdownPathFromRelativePath(relativePath));
        await this.saveFile(markdownPath, documentation);
        console.log('Completed: ' + filePath);
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
        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(filePath, content, { encoding: 'utf8' });
    }
}

module.exports = async (directoryPath) => {
    const generator = new DocumentationGenerator();
    await generator.generateForDirectory(directoryPath);
};
