# AI-Powered Documentation Generator

This project provides an AI-powered documentation generator that automatically creates documentation for your codebase in JavaScript (JS), TypeScript (TS), Python (PY), Rust (RS), and Solidity (SOL) files. It includes a command-line interface for generating documentation for individual files or directories, as well as a watcher service that automatically updates documentation when files change.

<p align="center">
<img src="https://github.com/codyaboyd/thoth/assets/57097960/244566cc-5a68-4bf1-8e5a-9c4c3854ee51">
</p>

## Features

- Generate documentation for individual files or entire directories.
- Support for JS, TS, PY, RS, and SOL files.
- Automatic documentation updates through a watcher service.
- Ability to download and start an AI model service for documentation generation.

## Getting Started

### Prerequisites

- Node.js installed on your system.
- Your project files are organized in a directory structure.

### Installation

Make sure NodeJS is installed.

Clone this repository to your local machine:

```
git clone <repository-url>
cd <repository-directory>
```


### Usage

#### Start the AI Model Service

Before generating documentation, start the AI model service:

```
node thoth.js --download
node thoth.js --start
```

This command starts the AI service in the background, which is required for generating documentation.

#### Generate Documentation for a Directory

To generate documentation for all supported files in a directory:

```
node thoth.js --directory <path_to_directory>
```

Replace `<path_to_directory>` with the path to your project directory.

#### Start the Watcher Service

To automatically generate and update documentation as files change:

```
node thoth.js --service <path_to_directory>
```


This command starts a watcher service that monitors the specified directory for changes and updates the documentation accordingly.

#### Generate Documentation for a Single File

For generating documentation for a single file:

```
node thoth.js <path_to_file>
```


Replace `<path_to_file>` with the path to the file you want to document.

#### Download AI Model

You can download the AI model from Huggingface and/or the back-up IPFS system with (note that this might be slow due to being ~5GB):

```
node thoth.js --download
```


### Help

For a summary of available commands:

```
node thoth.js --help
```


## Watcher Service Details

The watcher service (`watchDirectory.js`) monitors a specified directory for changes in real-time. It generates or updates markdown documentation for any file that changes, provided the file is of a supported type and not part of the `node_modules` directory. The service intelligently handles file updates, ensuring that documentation is always in sync with the latest file version.

## Compile To Binary Executable

```
npx pkg thoth.js -t node18-x64-linux
npx pkg thoth.js -t node18-x64-windows
npx pkg thoth.js -t node18-x64-macos
npx pkg thoth.js -t node18-arm64-macos
npx pkg thoth.js -t node18-arm64-linux
```

This creates a thoth executable for Linux and Mac like ./thoth or for Windows like ./thoth.exe

## License

This project is licensed under the Apache 2.0 License - see the LICENSE file for details.
