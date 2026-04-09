const http = require('http');
const https = require('https');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8080;
const DEFAULT_BASE_PROMPT = 'Write documentation to describe the logic in the following code using markdown.';
const DEFAULT_PROVIDER = 'local';

const PROVIDERS = {
    LOCAL: 'local',
    OPENAI: 'openai',
    CLAUDE: 'claude',
    GEMINI: 'gemini',
    LECHAT: 'lechat',
};

const DEFAULT_MODEL_BY_PROVIDER = {
    [PROVIDERS.OPENAI]: 'gpt-4o-mini',
    [PROVIDERS.CLAUDE]: 'claude-3-5-haiku-latest',
    [PROVIDERS.GEMINI]: 'gemini-1.5-flash',
    [PROVIDERS.LECHAT]: 'mistral-small-latest',
};

function buildPrompt({ fileContent, language, filePath, basePrompt = DEFAULT_BASE_PROMPT }) {
    return `[INST]${basePrompt}\nLanguage: ${language}\nFile: ${filePath}\n\nCode:\n${fileContent}[/INST]`;
}

function buildCloudPrompt({ fileContent, language, filePath, basePrompt = DEFAULT_BASE_PROMPT }) {
    return `${basePrompt}\nLanguage: ${language}\nFile: ${filePath}\n\nCode:\n${fileContent}`;
}

function normalizeProvider(provider) {
    if (!provider) return DEFAULT_PROVIDER;
    return provider.toLowerCase();
}

function getApiKeyForProvider(provider, explicitApiKey) {
    if (explicitApiKey) return explicitApiKey;
    if (provider === PROVIDERS.OPENAI) return process.env.OPENAI_API_KEY || process.env.THOTH_API_KEY;
    if (provider === PROVIDERS.CLAUDE) return process.env.ANTHROPIC_API_KEY || process.env.THOTH_API_KEY;
    if (provider === PROVIDERS.GEMINI) return process.env.GEMINI_API_KEY || process.env.THOTH_API_KEY;
    if (provider === PROVIDERS.LECHAT) return process.env.MISTRAL_API_KEY || process.env.THOTH_API_KEY;
    return process.env.THOTH_API_KEY;
}

function resolveConfig({
    provider = process.env.THOTH_PROVIDER || DEFAULT_PROVIDER,
    model = process.env.THOTH_MODEL,
    apiKey = process.env.THOTH_API_KEY,
    host = process.env.THOTH_API_HOST || DEFAULT_HOST,
    port = process.env.THOTH_API_PORT || DEFAULT_PORT,
} = {}) {
    const normalizedProvider = normalizeProvider(provider);
    return {
        provider: normalizedProvider,
        model: model || DEFAULT_MODEL_BY_PROVIDER[normalizedProvider],
        apiKey: getApiKeyForProvider(normalizedProvider, apiKey),
        host,
        port: Number(port),
    };
}

function requestCompletion(prompt, { host = DEFAULT_HOST, port = DEFAULT_PORT } = {}) {
    const postData = JSON.stringify({ prompt });

    const options = {
        hostname: host,
        port,
        path: '/completion',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
        },
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    resolve(parsedData.content || '');
                } catch (error) {
                    reject(new Error(`Error parsing response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Problem with request: ${error.message}`));
        });

        req.write(postData);
        req.end();
    });
}

function requestJson({
    protocol = 'https:',
    hostname,
    path,
    method = 'POST',
    headers = {},
    body = {},
}) {
    const postData = JSON.stringify(body);
    const requester = protocol === 'http:' ? http : https;

    const options = {
        protocol,
        hostname,
        path,
        method,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            ...headers,
        },
    };

    return new Promise((resolve, reject) => {
        const req = requester.request(options, (res) => {
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`Provider request failed (${res.statusCode}): ${rawData}`));
                }
                try {
                    const parsedData = JSON.parse(rawData);
                    resolve(parsedData);
                } catch (error) {
                    reject(new Error(`Error parsing provider response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Problem with provider request: ${error.message}`));
        });

        req.write(postData);
        req.end();
    });
}

async function requestOpenAICompletion(prompt, { model, apiKey }) {
    const response = await requestJson({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: {
            model,
            messages: [{ role: 'user', content: prompt }],
        },
    });
    return response.choices?.[0]?.message?.content || '';
}

async function requestClaudeCompletion(prompt, { model, apiKey }) {
    const response = await requestJson({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: {
            model,
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }],
        },
    });
    return response.content?.[0]?.text || '';
}

async function requestGeminiCompletion(prompt, { model, apiKey }) {
    const response = await requestJson({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        body: {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }],
                },
            ],
        },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function requestLeChatCompletion(prompt, { model, apiKey }) {
    const response = await requestJson({
        hostname: 'api.mistral.ai',
        path: '/v1/chat/completions',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: {
            model,
            messages: [{ role: 'user', content: prompt }],
        },
    });
    return response.choices?.[0]?.message?.content || '';
}

async function generateDocumentation({
    fileContent,
    language,
    filePath,
    basePrompt = DEFAULT_BASE_PROMPT,
    provider,
    model,
    apiKey,
    host,
    port,
}) {
    const config = resolveConfig({ provider, model, apiKey, host, port });
    if (config.provider === PROVIDERS.LOCAL) {
        const localPrompt = buildPrompt({ fileContent, language, filePath, basePrompt });
        return requestCompletion(localPrompt, { host: config.host, port: config.port });
    }

    if (![PROVIDERS.OPENAI, PROVIDERS.CLAUDE, PROVIDERS.GEMINI, PROVIDERS.LECHAT].includes(config.provider)) {
        throw new Error(`Unsupported provider "${config.provider}". Use local|openai|claude|gemini|lechat.`);
    }

    if (!config.apiKey) {
        throw new Error(`Missing API key for provider "${config.provider}". Set --api-key or relevant env var.`);
    }

    const cloudPrompt = buildCloudPrompt({ fileContent, language, filePath, basePrompt });

    if (config.provider === PROVIDERS.OPENAI) {
        return requestOpenAICompletion(cloudPrompt, config);
    }
    if (config.provider === PROVIDERS.CLAUDE) {
        return requestClaudeCompletion(cloudPrompt, config);
    }
    if (config.provider === PROVIDERS.GEMINI) {
        return requestGeminiCompletion(cloudPrompt, config);
    }
    return requestLeChatCompletion(cloudPrompt, config);
}

module.exports = {
    DEFAULT_BASE_PROMPT,
    DEFAULT_HOST,
    DEFAULT_PORT,
    DEFAULT_PROVIDER,
    buildPrompt,
    requestCompletion,
    resolveConfig,
    generateDocumentation,
};
