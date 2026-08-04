const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
    isPythonVirtualEnvironment,
    isInsidePythonVirtualEnvironment,
} = require('./utils.js');
const { collectCodeFiles } = require('./pdfGenerator.js');

test('detects Python virtual environments by their bin/activate file', (t) => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'thoth-venv-'));
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));
    const environmentPath = path.join(rootPath, 'arbitrary-name');
    fs.mkdirSync(path.join(environmentPath, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(environmentPath, 'bin', 'activate'), '');

    assert.equal(isPythonVirtualEnvironment(environmentPath), true);
    assert.equal(isInsidePythonVirtualEnvironment(path.join(environmentPath, 'lib', 'module.py'), rootPath), true);
    assert.equal(isPythonVirtualEnvironment(path.join(rootPath, 'ordinary-directory')), false);
});

test('PDF collection skips virtual environments with arbitrary directory names', async (t) => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'thoth-collect-'));
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));
    const environmentPath = path.join(rootPath, 'dependencies-from-python');
    fs.mkdirSync(path.join(environmentPath, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(environmentPath, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(environmentPath, 'bin', 'activate'), '');
    fs.writeFileSync(path.join(environmentPath, 'lib', 'dependency.py'), 'print("dependency")');
    fs.writeFileSync(path.join(rootPath, 'application.py'), 'print("application")');

    assert.deepEqual(await collectCodeFiles(rootPath), [path.join(rootPath, 'application.py')]);
});
