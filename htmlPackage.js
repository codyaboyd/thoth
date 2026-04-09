const fs = require('fs').promises;
const path = require('path');

function escapeHtml(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function inlineMarkdown(text) {
    return text
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function markdownToHtml(markdown) {
    const lines = markdown.split(/\r?\n/);
    const html = [];
    let inCodeBlock = false;
    let listType = null;
    let inBlockquote = false;

    const closeList = () => {
        if (listType) {
            html.push(`</${listType}>`);
            listType = null;
        }
    };

    const closeBlockquote = () => {
        if (inBlockquote) {
            html.push('</blockquote>');
            inBlockquote = false;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        if (line.startsWith('```')) {
            closeList();
            closeBlockquote();
            if (!inCodeBlock) {
                const language = line.slice(3).trim();
                html.push(`<pre><code class=\"language-${escapeHtml(language || 'plain')}\">`);
                inCodeBlock = true;
            } else {
                html.push('</code></pre>');
                inCodeBlock = false;
            }
            continue;
        }

        if (inCodeBlock) {
            html.push(`${escapeHtml(rawLine)}\n`);
            continue;
        }

        if (!line) {
            closeList();
            closeBlockquote();
            continue;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            closeList();
            closeBlockquote();
            const level = headingMatch[1].length;
            html.push(`<h${level}>${inlineMarkdown(escapeHtml(headingMatch[2]))}</h${level}>`);
            continue;
        }

        const blockquoteMatch = line.match(/^>\s?(.*)$/);
        if (blockquoteMatch) {
            closeList();
            if (!inBlockquote) {
                html.push('<blockquote>');
                inBlockquote = true;
            }
            html.push(`<p>${inlineMarkdown(escapeHtml(blockquoteMatch[1]))}</p>`);
            continue;
        }

        closeBlockquote();

        const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
        if (orderedMatch) {
            if (listType !== 'ol') {
                closeList();
                html.push('<ol>');
                listType = 'ol';
            }
            html.push(`<li>${inlineMarkdown(escapeHtml(orderedMatch[1]))}</li>`);
            continue;
        }

        const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
        if (unorderedMatch) {
            if (listType !== 'ul') {
                closeList();
                html.push('<ul>');
                listType = 'ul';
            }
            html.push(`<li>${inlineMarkdown(escapeHtml(unorderedMatch[1]))}</li>`);
            continue;
        }

        closeList();
        const paragraph = line.replace(/\[(.*?)\]\((.*?)\)/g, '<a href=\"$2\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>');
        html.push(`<p>${inlineMarkdown(escapeHtml(paragraph).replace(/&lt;a href=\"(.*?)\" target=\"_blank\" rel=\"noopener noreferrer\"&gt;(.*?)&lt;\/a&gt;/g, '<a href=\"$1\" target=\"_blank\" rel=\"noopener noreferrer\">$2</a>'))}</p>`);
    }

    if (inCodeBlock) html.push('</code></pre>');
    closeList();
    closeBlockquote();

    return html.join('\n');
}

async function collectMarkdownFiles(docsRoot, currentPath = docsRoot) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const collected = [];

    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
            const nestedFiles = await collectMarkdownFiles(docsRoot, fullPath);
            collected.push(...nestedFiles);
        } else if (entry.isFile() && fullPath.endsWith('.md')) {
            const markdown = await fs.readFile(fullPath, 'utf8');
            const relativePath = path.relative(docsRoot, fullPath);
            const title = path.basename(fullPath, '.md');
            collected.push({
                relativePath,
                title,
                html: markdownToHtml(markdown),
            });
        }
    }

    return collected.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function createHtmlShell(documents) {
    const nav = documents.map((doc, index) => (
        `<button class=\"doc-nav-item${index === 0 ? ' active' : ''}\" data-doc-id=\"doc-${index}\">${escapeHtml(doc.relativePath)}</button>`
    )).join('\n');

    const sections = documents.map((doc, index) => (
        `<article id=\"doc-${index}\" class=\"doc-card${index === 0 ? ' active' : ''}\">\n<h1>${escapeHtml(doc.title)}</h1>\n<p class=\"doc-meta\">${escapeHtml(doc.relativePath)}</p>\n${doc.html}\n</article>`
    )).join('\n');

    return `<!doctype html>
<html lang=\"en\">
<head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
    <title>Thoth Documentation Package</title>
    <link rel=\"stylesheet\" href=\"./styles.css\" />
</head>
<body>
    <div class=\"layout\">
        <aside class=\"sidebar neumorph\">
            <div class=\"logo\">Thoth Docs</div>
            <p class=\"subtitle\">Modern HTML package with a neumorphic UI.</p>
            <nav class=\"doc-nav\">${nav}</nav>
        </aside>
        <main class=\"content\">${sections}</main>
    </div>
    <script>
        const navItems = Array.from(document.querySelectorAll('.doc-nav-item'));
        const cards = Array.from(document.querySelectorAll('.doc-card'));
        navItems.forEach((item) => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-doc-id');
                navItems.forEach((it) => it.classList.toggle('active', it === item));
                cards.forEach((card) => card.classList.toggle('active', card.id === id));
            });
        });
    </script>
</body>
</html>`;
}

const STYLES = `:root {
    --bg: #e8edf4;
    --fg: #243447;
    --muted: #4b5c71;
    --accent: #5f7cfa;
    --card-bg: #e8edf4;
    --radius: 20px;
    --shadow-raised: 10px 10px 20px #c9d0d9, -10px -10px 20px #ffffff;
    --shadow-inset: inset 6px 6px 10px #c9d0d9, inset -6px -6px 10px #ffffff;
}

* { box-sizing: border-box; }
body {
    margin: 0;
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--fg);
    background: radial-gradient(circle at top right, #f4f7fb, var(--bg) 60%);
}

.layout {
    display: grid;
    grid-template-columns: minmax(240px, 320px) 1fr;
    gap: 1.25rem;
    min-height: 100vh;
    padding: 1.5rem;
}

.neumorph {
    background: var(--card-bg);
    border-radius: var(--radius);
    box-shadow: var(--shadow-raised);
}

.sidebar {
    padding: 1.25rem;
    position: sticky;
    top: 1.5rem;
    max-height: calc(100vh - 3rem);
    overflow: auto;
}

.logo {
    font-weight: 700;
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
}

.subtitle {
    color: var(--muted);
    margin: 0 0 1rem;
}

.doc-nav { display: flex; flex-direction: column; gap: 0.75rem; }
.doc-nav-item {
    border: none;
    background: var(--card-bg);
    box-shadow: var(--shadow-raised);
    border-radius: 14px;
    color: var(--fg);
    text-align: left;
    padding: 0.7rem 0.9rem;
    cursor: pointer;
    transition: transform 120ms ease, color 120ms ease;
}
.doc-nav-item:hover { transform: translateY(-1px); color: var(--accent); }
.doc-nav-item.active {
    color: var(--accent);
    box-shadow: var(--shadow-inset);
}

.content { padding: 0.15rem; }
.doc-card {
    display: none;
    background: var(--card-bg);
    border-radius: var(--radius);
    box-shadow: var(--shadow-raised);
    padding: 1.5rem 1.6rem;
    line-height: 1.65;
}
.doc-card.active { display: block; }

.doc-meta { color: var(--muted); margin-top: -0.5rem; }
h1,h2,h3,h4 { line-height: 1.3; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

pre {
    padding: 1rem;
    overflow: auto;
    border-radius: 14px;
    background: #dde5ef;
    box-shadow: inset 4px 4px 10px #c3ccd6, inset -4px -4px 10px #f7fcff;
}
code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    background: #dde5ef;
    border-radius: 8px;
    padding: 0.1rem 0.4rem;
}
blockquote {
    margin: 1rem 0;
    border-left: 4px solid #c9d6ff;
    padding: 0.1rem 1rem;
    color: #3f4d5e;
    background: rgba(255,255,255,0.45);
    border-radius: 10px;
}

@media (max-width: 900px) {
    .layout {
        grid-template-columns: 1fr;
        padding: 1rem;
    }
    .sidebar {
        position: static;
        max-height: unset;
    }
}
`;

async function buildHtmlDocumentationPackage(rootPath) {
    const docsDir = path.join(rootPath, 'docs');
    const packageDir = path.join(rootPath, 'docs-html');

    try {
        await fs.access(docsDir);
    } catch (_) {
        throw new Error(`Cannot build HTML package because docs directory does not exist: ${docsDir}`);
    }

    const documents = await collectMarkdownFiles(docsDir);
    if (documents.length === 0) {
        throw new Error(`No markdown files found to build HTML package in: ${docsDir}`);
    }

    await fs.mkdir(packageDir, { recursive: true });
    await fs.writeFile(path.join(packageDir, 'index.html'), createHtmlShell(documents), 'utf8');
    await fs.writeFile(path.join(packageDir, 'styles.css'), STYLES, 'utf8');

    return {
        outputDirectory: packageDir,
        documentCount: documents.length,
    };
}

module.exports = {
    buildHtmlDocumentationPackage,
};
