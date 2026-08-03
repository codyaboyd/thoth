const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const generateDocumentationForDirectory = require('./handleDirectory.js');
const watchDirectory = require('./watchDirectory.js');
const { generateForSingleFile } = require('./singleGen.js');
const { reassembleModel, downloadFileHF } = require('./getModel.js');
const { generatePdfForDirectory } = require('./pdfGenerator.js');

// Process command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('NOTICE: Make sure to start the AI service first with: node thoth.js --start');
    printHelp();
    process.exit(1);
}

function printHelp() {
  console.log(
    `Usage:
    Generate documentation for a directory:
     node thoth.js --directory <path_to_directory>

    Generate one complete codebase PDF:
     node thoth.js --pdf <path> --title <title> --organization <name> [--output <file.pdf>]

    Start a watcher service to automatically manage documentation:
     node thoth.js --service <path_to_directory>

    Generate documentation for a single file:
     node thoth.js <path_to_file>

    Download AI model from IPFS (Slow):
     node thoth.js --download

    Start AI model service:
     node thoth.js --start

    Optional provider settings:
     --provider <local|openai|claude|gemini|lechat>
     --model <model_name>
     --api-key <api_key>
     --host <local_model_host> --port <local_model_port>
     --prompt-template <mistral|qwen>`
  );
};

function getArgValue(flag) {
    const index = args.indexOf(flag);
    if (index !== -1 && args.length > index + 1) {
        return args[index + 1];
    }
    return undefined;
}

function getPositionalArgs() {
    const flagsWithValues = new Set([
        '--directory', '--pdf', '--title', '--organization', '--output', '--service',
        '--provider', '--model', '--api-key', '--host', '--port', '--prompt-template',
    ]);
    const positionalArgs = [];

    for (let index = 0; index < args.length; index += 1) {
        if (flagsWithValues.has(args[index])) {
            index += 1;
        } else if (!args[index].startsWith('--')) {
            positionalArgs.push(args[index]);
        }
    }

    return positionalArgs;
}

function applyProviderArgs() {
    const provider = getArgValue('--provider');
    const model = getArgValue('--model');
    const apiKey = getArgValue('--api-key');
    const host = getArgValue('--host');
    const port = getArgValue('--port');
    const promptTemplate = getArgValue('--prompt-template');

    if (provider) process.env.THOTH_PROVIDER = provider;
    if (model) process.env.THOTH_MODEL = model;
    if (apiKey) process.env.THOTH_API_KEY = apiKey;
    if (host) process.env.THOTH_API_HOST = host;
    if (port) process.env.THOTH_API_PORT = port;
    if (promptTemplate) process.env.THOTH_PROMPT_TEMPLATE = promptTemplate;
}

// Handle --help flag
if (args.includes('--help')) {
    printHelp();
    return;
};

applyProviderArgs();

// Handle complete codebase PDF generation
if (args.includes('--pdf')) {
    const directoryPath = getArgValue('--pdf');
    const title = getArgValue('--title');
    const organization = getArgValue('--organization');
    const outputPath = getArgValue('--output');
    if (!directoryPath || !title || !organization) {
        console.error('Usage: node thoth.js --pdf <path> --title <title> --organization <name> [--output <file.pdf>]');
        process.exitCode = 1;
    } else {
        generatePdfForDirectory(directoryPath, { title, organization, outputPath })
            .then(result => console.log(`PDF documentation complete: ${result.outputPath} (${result.fileCount} files, ${result.pageCount} pages)`))
            .catch(error => {
                console.error(`Error generating PDF documentation: ${error.message}`);
                process.exitCode = 1;
            });
    }
    return;
}

// Handle --download flag
if (args.includes('--download')) {
    downloadFileHF()
    .then(() => {
        console.log('Direct model download complete.');
    })
    .catch((error) => {
        console.error(`Direct download failed: ${error.message}. Attempting reassembly...`);
        reassembleModel().then(() => {
            console.log('Model download and reassembly complete.');
        }).catch((reassembleError) => {
            console.error(`Error during reassembly: ${reassembleError.message}`);
        });
    });
    return;
};

// Handle --start flag
if (args.includes('--start')) {
    const numCPUs = os.cpus().length;
    const threadsToUse = Math.max(1, numCPUs - 1);

    const child = spawn('./m7q5', ['-t', `${threadsToUse}`], {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
    console.log('Service started in the background with PID:', child.pid, 'using', threadsToUse, 'threads');
    return;
};

// Handle --directory option
if (args.includes('--directory')) {
    const directoryIndex = args.indexOf('--directory');
    if (directoryIndex !== -1 && args.length > directoryIndex + 1) {
        const directoryPath = args[directoryIndex + 1];
        generateDocumentationForDirectory(directoryPath)
            .then(() => console.log('Documentation generation complete.'))
            .catch((error) => console.error(`Error generating documentation: ${error}`));
    } else {
        console.error('Usage: node thoth.js --directory <path_to_directory>');
    }
    return;
};

// Handle --service option
if (args.includes('--service')) {
    const directoryIndex = args.indexOf('--service');
    if (directoryIndex !== -1 && args.length > directoryIndex + 1) {
        const directoryPath = args[directoryIndex + 1];
        watchDirectory(directoryPath);
    } else {
        console.error('Usage: node thoth.js --service <path_to_directory>');
    }
    return;
};

// Default action for a single file
const filePath = getPositionalArgs()[0];
if (!filePath) {
    console.error('Usage: node thoth.js [provider options] <path_to_file>');
    process.exitCode = 1;
    return;
}
fs.readFile(filePath, { encoding: 'utf8' }, (err, data) => {
    if (err) {
        console.error(`Error reading file from disk: ${err}`);
        return;
    }
generateForSingleFile(filePath,data);
});
