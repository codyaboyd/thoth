const http = require('http');
const https = require('https');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8080;
const DEFAULT_BASE_PROMPT = [
    'Write markdown documentation that explains only the logic present in the provided code.',
    'Do not invent behavior, files, APIs, or assumptions not shown in the snippet.',
    'If important context is missing, explicitly state what is unknown.',
].join(' ');
const DEFAULT_PROVIDER = 'local';
const DEFAULT_PROMPT_TEMPLATE = 'mistral';

const PROMPT_TEMPLATES = {
    MISTRAL: 'mistral',
    QWEN: 'qwen',
};

// These profiles favor accurate, repeatable documentation while retaining enough
// sampling diversity to avoid terse or incomplete answers. Qwen benefits from a
// narrower candidate set, while Mistral is more reliable with the conventional
// top-k 40 / top-p 0.9 combination.
const LOCAL_SAMPLING_SETTINGS = Object.freeze({
    [PROMPT_TEMPLATES.MISTRAL]: Object.freeze({
        temperature: 0.3,
        top_k: 40,
        top_p: 0.9,
        min_p: 0.05,
        repeat_penalty: 1.1,
    }),
    [PROMPT_TEMPLATES.QWEN]: Object.freeze({
        temperature: 0.7,
        top_k: 20,
        top_p: 0.8,
        min_p: 0,
        repeat_penalty: 1.05,
    }),
});

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

function normalizePromptTemplate(promptTemplate) {
    const normalizedTemplate = (promptTemplate || DEFAULT_PROMPT_TEMPLATE).toLowerCase();
    if (normalizedTemplate === 'mistral-instruct') return PROMPT_TEMPLATES.MISTRAL;
    if (!Object.values(PROMPT_TEMPLATES).includes(normalizedTemplate)) {
        throw new Error(`Unsupported prompt template "${promptTemplate}". Use mistral|qwen.`);
    }
    return normalizedTemplate;
}

function buildPrompt({
    fileContent,
    language,
    filePath,
    basePrompt = DEFAULT_BASE_PROMPT,
    promptTemplate = DEFAULT_PROMPT_TEMPLATE,
}) {
    const normalizedTemplate = normalizePromptTemplate(promptTemplate);
    const userPrompt = `Language: ${language}\nFile: ${filePath}\n\nCode:\n${fileContent}`;

    if (normalizedTemplate === PROMPT_TEMPLATES.QWEN) {
        return `<|im_start|>system\n${basePrompt}<|im_end|>\n<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`;
    }

    return `[INST]${basePrompt}\n${userPrompt}[/INST]`;
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
    promptTemplate = process.env.THOTH_PROMPT_TEMPLATE || DEFAULT_PROMPT_TEMPLATE,
} = {}) {
    const normalizedProvider = normalizeProvider(provider);
    return {
        provider: normalizedProvider,
        model: model || DEFAULT_MODEL_BY_PROVIDER[normalizedProvider],
        apiKey: getApiKeyForProvider(normalizedProvider, apiKey),
        host,
        port: Number(port),
        promptTemplate: normalizePromptTemplate(promptTemplate),
    };
}

function requestCompletion(prompt, {
    host = DEFAULT_HOST,
    port = DEFAULT_PORT,
    onProgress,
    samplingSettings = LOCAL_SAMPLING_SETTINGS[DEFAULT_PROMPT_TEMPLATE],
} = {}) {
    const streaming = typeof onProgress === 'function';
    const postData = JSON.stringify({ prompt, stream: streaming, ...samplingSettings });

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
            let content = '';
            let settled = false;

            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                callback(value);
            };

            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                rawData += chunk;
                if (!streaming || res.statusCode < 200 || res.statusCode >= 300) return;

                const lines = rawData.split(/\r?\n/);
                rawData = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const data = line.slice(5).trim();
                    if (!data || data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const token = parsed.content || parsed.response || parsed.text || '';
                        if (token) {
                            content += token;
                            onProgress({ content, token });
                        }
                    } catch (_) {
                        // Ignore malformed events without preventing later, valid
                        // streaming events from being read.
                    }
                }
            });
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    finish(reject, new Error(`Local provider request failed (${res.statusCode}): ${rawData}`));
                    return;
                }
                if (streaming) {
                    finish(resolve, content);
                    return;
                }
                try {
                    const parsedData = JSON.parse(rawData);
                    finish(resolve, parsedData.content || parsedData.response || parsedData.text || '');
                } catch (error) {
                    finish(reject, new Error(`Error parsing response: ${error.message}`));
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
                if (!rawData.trim()) {
                    resolve({});
                    return;
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
    promptTemplate,
    onProgress,
}) {
    const config = resolveConfig({ provider, model, apiKey, host, port, promptTemplate });
    let response;

    if (config.provider === PROVIDERS.LOCAL) {
        const localPrompt = buildPrompt({
            fileContent,
            language,
            filePath,
            basePrompt,
            promptTemplate: config.promptTemplate,
        });
        response = await requestCompletion(localPrompt, {
            host: config.host,
            port: config.port,
            onProgress,
            samplingSettings: LOCAL_SAMPLING_SETTINGS[config.promptTemplate],
        });
    } else if (![PROVIDERS.OPENAI, PROVIDERS.CLAUDE, PROVIDERS.GEMINI, PROVIDERS.LECHAT].includes(config.provider)) {
        throw new Error(`Unsupported provider "${config.provider}". Use local|openai|claude|gemini|lechat.`);
    } else if (!config.apiKey) {
        throw new Error(`Missing API key for provider "${config.provider}". Set --api-key or relevant env var.`);
    } else {
        const cloudPrompt = buildCloudPrompt({ fileContent, language, filePath, basePrompt });

        if (config.provider === PROVIDERS.OPENAI) {
            response = await requestOpenAICompletion(cloudPrompt, config);
        } else if (config.provider === PROVIDERS.CLAUDE) {
            response = await requestClaudeCompletion(cloudPrompt, config);
        } else if (config.provider === PROVIDERS.GEMINI) {
            response = await requestGeminiCompletion(cloudPrompt, config);
        } else {
            response = await requestLeChatCompletion(cloudPrompt, config);
        }
    }

    console.log(`[${config.provider}] LLM response for ${filePath}:\n${response}`);
    return response;
}

module.exports = {
    DEFAULT_BASE_PROMPT,
    DEFAULT_HOST,
    DEFAULT_PORT,
    DEFAULT_PROVIDER,
    DEFAULT_PROMPT_TEMPLATE,
    LOCAL_SAMPLING_SETTINGS,
    PROMPT_TEMPLATES,
    buildPrompt,
    normalizePromptTemplate,
    requestCompletion,
    resolveConfig,
    generateDocumentation,
};
