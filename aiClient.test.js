const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { generateDocumentation } = require('./aiClient.js');

test('generateDocumentation prints the LLM response to stdout and returns it', async (t) => {
    const server = http.createServer((request, response) => {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ content: 'Generated documentation' }));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));

    const messages = [];
    const originalLog = console.log;
    console.log = (message) => messages.push(message);
    t.after(() => { console.log = originalLog; });

    const result = await generateDocumentation({
        fileContent: 'const answer = 42;',
        language: 'JavaScript',
        filePath: 'answer.js',
        host: '127.0.0.1',
        port: server.address().port,
    });

    assert.equal(result, 'Generated documentation');
    assert.deepEqual(messages, ['[local] LLM response for answer.js:\nGenerated documentation']);
});
