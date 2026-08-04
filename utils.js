const path = require('path');
const fs = require('fs');

const LANGUAGE_BY_EXTENSION = {
    '.js': 'JavaScript',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',
    '.jsx': 'JavaScript (React JSX)',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript (React TSX)',
    '.py': 'Python',
    '.java': 'Java',
    '.c': 'C',
    '.h': 'C/C++ Header',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.hpp': 'C++ Header',
    '.cs': 'C#',
    '.go': 'Go',
    '.rs': 'Rust',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.kts': 'Kotlin Script',
    '.scala': 'Scala',
    '.sol': 'Solidity',
    '.sh': 'Shell',
    '.bash': 'Bash',
    '.zsh': 'Zsh',
    '.ps1': 'PowerShell',
    '.r': 'R',
    '.lua': 'Lua',
    '.pl': 'Perl',
    '.sql': 'SQL',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'Sass',
    '.less': 'Less',
    '.vue': 'Vue',
    '.svelte': 'Svelte',
    '.dart': 'Dart',
    '.ex': 'Elixir',
    '.exs': 'Elixir Script',
    '.erl': 'Erlang',
    '.hrl': 'Erlang Header',
};

function getLanguageFromExtension(filename) {
    const extension = path.extname(filename).toLowerCase();
    return LANGUAGE_BY_EXTENSION[extension] || 'unknown';
}

function isValidFileType(filename) {
    const extension = path.extname(filename).toLowerCase();
    return Object.prototype.hasOwnProperty.call(LANGUAGE_BY_EXTENSION, extension);
}

function getMarkdownPathFromRelativePath(relativePath) {
    return relativePath.replace(/\.[^.]+$/, '.md');
}

function isPythonVirtualEnvironment(directoryPath) {
    return fs.existsSync(path.join(directoryPath, 'bin', 'activate'));
}

function isInsidePythonVirtualEnvironment(filePath, rootPath) {
    const resolvedRoot = path.resolve(rootPath);
    let directoryPath = path.resolve(filePath);

    while (directoryPath === resolvedRoot || !path.relative(resolvedRoot, directoryPath).startsWith('..')) {
        if (isPythonVirtualEnvironment(directoryPath)) return true;
        if (directoryPath === resolvedRoot) break;
        const parentPath = path.dirname(directoryPath);
        if (parentPath === directoryPath) break;
        directoryPath = parentPath;
    }
    return false;
}

module.exports = {
    getLanguageFromExtension,
    isValidFileType,
    getMarkdownPathFromRelativePath,
    isPythonVirtualEnvironment,
    isInsidePythonVirtualEnvironment,
};
