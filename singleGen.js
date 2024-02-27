const http = require('http');
const { getLanguageFromExtension } = require('./utils.js');

// Base prompt without specifying the language
async function generateForSingleFile(filePath, data) {
const basePrompt = "Write documentation to describe the logic in the following code using markdown: ";
const language = getLanguageFromExtension(filePath);
const prompt = `[INST]${basePrompt.replace("code", language)}: ${data}[/INST]`;

const postData = JSON.stringify({
    prompt: prompt,
});

const options = {
    hostname: '127.0.0.1',
    port: 8080,
    path: '/completion',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
    },
};

const req = http.request(options, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            console.log(parsedData.content); // Print the response content directly
        } catch (e) {
            console.error(`Error parsing response: ${e.message}`);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    console.log("Please make sure ./m7q5 AI node is activated.");
});

req.write(postData);
req.end();
};

module.exports = { generateForSingleFile };
