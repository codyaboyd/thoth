const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const generateDocumentationForDirectory = require('./handleDirectory.js');
const watchDirectory = require('./watchDirectory.js');
const { generateForSingleFile } = require('./singleGen.js');
const { reassembleModel, downloadFileHF } = require('./getModel.js');
const { buildHtmlDocumentationPackage } = require('./htmlPackage.js');

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

    Build HTML documentation package from existing markdown docs:
     node thoth.js --html-package <path_to_directory>

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
     --host <local_model_host> --port <local_model_port>`
  );
};

function getArgValue(flag) {
    const index = args.indexOf(flag);
    if (index !== -1 && args.length > index + 1) {
        return args[index + 1];
    }
    return undefined;
}

function applyProviderArgs() {
    const provider = getArgValue('--provider');
    const model = getArgValue('--model');
    const apiKey = getArgValue('--api-key');
    const host = getArgValue('--host');
    const port = getArgValue('--port');

    if (provider) process.env.THOTH_PROVIDER = provider;
    if (model) process.env.THOTH_MODEL = model;
    if (apiKey) process.env.THOTH_API_KEY = apiKey;
    if (host) process.env.THOTH_API_HOST = host;
    if (port) process.env.THOTH_API_PORT = port;
}

// Handle --help flag
if (args.includes('--help')) {
    printHelp();
    return;
};

applyProviderArgs();

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
            .then(async () => {
                console.log('Documentation generation complete.');
                const htmlPackage = await buildHtmlDocumentationPackage(directoryPath);
                console.log(`HTML documentation package complete (${htmlPackage.documentCount} docs): ${htmlPackage.outputDirectory}`);
            })
            .catch((error) => console.error(`Error generating documentation: ${error}`));
    } else {
        console.error('Usage: node script.js --directory <path_to_directory>');
    }
    return;
};

// Handle --html-package option
if (args.includes('--html-package')) {
    const htmlPackageIndex = args.indexOf('--html-package');
    if (htmlPackageIndex !== -1 && args.length > htmlPackageIndex + 1) {
        const directoryPath = args[htmlPackageIndex + 1];
        buildHtmlDocumentationPackage(directoryPath)
            .then((result) => console.log(`HTML documentation package complete (${result.documentCount} docs): ${result.outputDirectory}`))
            .catch((error) => console.error(`Error generating HTML package: ${error}`));
    } else {
        console.error('Usage: node script.js --html-package <path_to_directory>');
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
        console.error('Usage: node script.js --service <path_to_directory>');
    }
    return;
};

// Default action for a single file
const filePath = args[0];
fs.readFile(filePath, { encoding: 'utf8' }, (err, data) => {
    if (err) {
        console.error(`Error reading file from disk: ${err}`);
        return;
    }
generateForSingleFile(filePath,data);
});
