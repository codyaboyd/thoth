const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const generateDocumentationForDirectory = require('./handleDirectory.js');
const watchDirectory = require('./watchDirectory.js');
const { generateForSingleFile } = require('./singleGen.js');
const { reassembleModel, downloadFileHF } = require('./getModel.js');

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

    Start a watcher service to automatically manage documentation:
     node thoth.js --service <path_to_directory>

    Generate documentation for a single file:
     node thoth.js <path_to_file>

    Download AI model from IPFS (Slow):
     node thoth.js --download

    Start AI model service:
     node thoth.js --start`
  );
};

// Handle --help flag
if (args.includes('--help')) {
    printHelp();
    return;
};

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
    const child = spawn('./m7q5', ['-t', '7'], {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
    console.log('Service started in the background with PID:', child.pid);
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
        console.error('Usage: node script.js --directory <path_to_directory>');
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
