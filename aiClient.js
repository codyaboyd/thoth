const http = require('http');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8080;
const DEFAULT_BASE_PROMPT = 'Write documentation to describe the logic in the following code using markdown.';

function buildPrompt({ fileContent, language, filePath, basePrompt = DEFAULT_BASE_PROMPT }) {
    return `[INST]${basePrompt}\nLanguage: ${language}\nFile: ${filePath}\n\nCode:\n${fileContent}[/INST]`;
}

function requestCompletion(prompt, { host = DEFAULT_HOST, port = DEFAULT_PORT } = {}) {
    const postData = JSON.stringify({ prompt });

    const options = {
        hostname: host,
        port,
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
                } catch (error) {
                    reject(new Error(`Error parsing response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Problem with request: ${error.message}`));
        });

        req.write(postData);
        req.end();
    });
}

async function generateDocumentation({ fileContent, language, filePath, basePrompt = DEFAULT_BASE_PROMPT, host = DEFAULT_HOST, port = DEFAULT_PORT }) {
    const prompt = buildPrompt({ fileContent, language, filePath, basePrompt });
    return requestCompletion(prompt, { host, port });
}

module.exports = {
    DEFAULT_BASE_PROMPT,
    DEFAULT_HOST,
    DEFAULT_PORT,
    buildPrompt,
    requestCompletion,
    generateDocumentation,
};
