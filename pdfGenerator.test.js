const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { formatProjectStructure, generatePdfForDirectory, sanitizeGeneratedResponse } = require('./pdfGenerator.js');

test('removes im_end end-of-message tokens from generated responses', () => {
    assert.equal(
        sanitizeGeneratedResponse('Overview<|im_end|>\nDetails<|imend|>\nDone<| im end |>\nFinal<|IM_END|>'),
        'Overview\nDetails\nDone\nFinal',
    );
});

test('formats discovered files as a directory-first project tree', () => {
    const rootPath = path.resolve('/example/project');
    const files = [
        path.join(rootPath, 'app.js'),
        path.join(rootPath, 'src', 'nested', 'worker.js'),
        path.join(rootPath, 'src', 'index.js'),
    ];

    assert.deepEqual(formatProjectStructure(rootPath, files), [
        'src/',
        '  nested/',
        '    worker.js',
        '  index.js',
        'app.js',
    ]);
});

test('places the project structure after the cover and excludes source code', async (t) => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'thoth-pdf-'));
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));
    fs.mkdirSync(path.join(rootPath, 'src'));
    fs.writeFileSync(path.join(rootPath, 'src', 'app.js'), 'const PRIVATE_SOURCE_SENTINEL = 42;');
    const outputPath = path.join(rootPath, 'documentation.pdf');

    const originalLog = console.log;
    console.log = () => {};
    t.after(() => { console.log = originalLog; });
    const result = await generatePdfForDirectory(rootPath, {
        title: 'Test project',
        organization: 'Test organization',
        outputPath,
        generate: async () => '## Purpose\nGenerated documentation only.<|im_end|>',
    });

    const pdf = fs.readFileSync(outputPath, 'latin1');
    assert.equal(result.pageCount, 3);
    assert.ok(pdf.indexOf('Project structure') < pdf.indexOf('Generated documentation only.'));
    assert.match(pdf, /src\//);
    assert.match(pdf, /app\.js/);
    assert.doesNotMatch(pdf, /PRIVATE_SOURCE_SENTINEL|Source code|<\|im_?end\|>/);
});
