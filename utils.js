// Helper function to get the language from file extension
function getLanguageFromExtension(filename) {
    if (filename.endsWith('.js')) return "JavaScript";
    if (filename.endsWith('.ts')) return "TypeScript";
    if (filename.endsWith('.py')) return "Python";
    if (filename.endsWith('.sol')) return "Solidity";
    if (filename.endsWith('.rs')) return "Rust";
    return "unknown"; // Default case, should not happen ideally
}

function isValidFileType(filename) {
    return filename.endsWith('.js') || filename.endsWith('.py') || filename.endsWith('.sol') || filename.endsWith('.ts') || filename.endsWith('.rs');
}

module.exports = {
  getLanguageFromExtension,
  isValidFileType
 };
