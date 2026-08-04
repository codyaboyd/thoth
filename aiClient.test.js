const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { generateDocumentation } = require('./aiClient.js');

test('generateDocumentation reports streamed local completion progress', async (t) => {
    const server = http.createServer((request, response) => {
        let body = '';
        request.on('data', (chunk) => { body += chunk; });
        request.on('end', () => {
            assert.equal(JSON.parse(body).stream, true);
            response.writeHead(200, { 'Content-Type': 'text/event-stream' });
            response.write('data: {"content":"Generated "}\n\n');
            response.end('data: {"content":"documentation"}\n\ndata: [DONE]\n\n');
        });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));

    const progress = [];
    const originalLog = console.log;
    console.log = () => {};
    t.after(() => { console.log = originalLog; });

    const result = await generateDocumentation({
        fileContent: 'const answer = 42;',
        language: 'JavaScript',
        filePath: 'answer.js',
        host: '127.0.0.1',
        port: server.address().port,
        onProgress: ({ content }) => progress.push(content),
    });

    assert.equal(result, 'Generated documentation');
    assert.deepEqual(progress, ['Generated ', 'Generated documentation']);
});

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
