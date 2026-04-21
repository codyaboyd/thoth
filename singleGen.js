const { getLanguageFromExtension } = require('./utils.js');
const { generateDocumentation, DEFAULT_BASE_PROMPT } = require('./aiClient.js');

async function generateForSingleFile(filePath, data) {
    const basePrompt = DEFAULT_BASE_PROMPT;
    const language = getLanguageFromExtension(filePath);

    try {
        const content = await generateDocumentation({
            fileContent: data,
            language,
            filePath,
            basePrompt,
        });
        console.log(content);
    } catch (error) {
        console.error(error.message);
        console.log('If using local provider, make sure ./m7q5 service is active. For cloud providers, verify API key and model.');
    }
}

module.exports = { generateForSingleFile };
