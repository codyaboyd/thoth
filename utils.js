const path = require('path');

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

module.exports = {
    getLanguageFromExtension,
    isValidFileType,
    getMarkdownPathFromRelativePath,
};
