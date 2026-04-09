const { getLanguageFromExtension } = require('./utils.js');
const { generateDocumentation } = require('./aiClient.js');

async function generateForSingleFile(filePath, data) {
    const basePrompt = 'Write documentation to describe the logic in the following code using markdown.';
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
        console.log('Please make sure ./m7q5 AI node is activated.');
    }
}

module.exports = { generateForSingleFile };
