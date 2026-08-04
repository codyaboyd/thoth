const fs = require('fs').promises;
const path = require('path');
const { getLanguageFromExtension, isValidFileType, isPythonVirtualEnvironment } = require('./utils.js');
const { generateDocumentation, DEFAULT_BASE_PROMPT } = require('./aiClient.js');

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'docs', 'coverage', 'dist', 'build']);

function pdfEscape(value) {
    return String(value)
        .normalize('NFKD')
        .replace(/[^\x20-\x7e]/g, '?')
        .replace(/([\\()])/g, '\\$1');
}

function wrap(text, width) {
    if (!text) return [''];
    const lines = [];
    for (const sourceLine of String(text).replace(/\t/g, '    ').split(/\r?\n/)) {
        if (!sourceLine) {
            lines.push('');
            continue;
        }
        let remaining = sourceLine;
        while (remaining.length > width) {
            let splitAt = remaining.lastIndexOf(' ', width);
            if (splitAt < Math.floor(width / 2)) splitAt = width;
            lines.push(remaining.slice(0, splitAt));
            remaining = remaining.slice(splitAt).replace(/^ /, '');
        }
        lines.push(remaining);
    }
    return lines;
}

class PdfDocument {
    constructor(title, organization) {
        this.title = title;
        this.organization = organization;
        this.pages = [];
        this.page = null;
        this.y = 0;
    }

    addPage(section = '') {
        this.page = { operations: [], section };
        this.pages.push(this.page);
        this.y = 748;
        if (this.pages.length > 1) {
            this.text(this.organization.toUpperCase(), { x: 54, y: 780, size: 8, color: [0.20, 0.35, 0.48] });
            this.text(section, { x: 558, y: 780, size: 8, align: 'right', color: [0.38, 0.43, 0.48] });
            this.line(54, 770, 558, 770, [0.82, 0.86, 0.89]);
        }
    }

    text(value, { x = 54, y = this.y, size = 10, font = 'regular', color = [0.12, 0.16, 0.20], align } = {}) {
        const approximateWidth = String(value).length * size * 0.52;
        let actualX = x;
        if (align === 'right') actualX = x - approximateWidth;
        this.page.operations.push(`${color.join(' ')} rg BT /${font === 'bold' ? 'F2' : font === 'mono' ? 'F3' : 'F1'} ${size} Tf 1 0 0 1 ${actualX.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(value)}) Tj ET`);
    }

    line(x1, y1, x2, y2, color = [0.8, 0.8, 0.8]) {
        this.page.operations.push(`${color.join(' ')} RG ${x1} ${y1} m ${x2} ${y2} l S`);
    }

    block(text, options = {}) {
        const size = options.size || 10;
        const leading = options.leading || size * 1.45;
        const indent = options.indent || 0;
        const maxChars = options.maxChars || Math.floor((504 - indent) / (size * 0.52));
        for (const line of wrap(text, maxChars)) {
            if (this.y < 54) this.addPage(this.page.section);
            this.text(line, { x: 54 + indent, y: this.y, size, font: options.font, color: options.color });
            this.y -= leading;
        }
        this.y -= options.after || 0;
    }

    heading(text, level = 1) {
        const size = level === 1 ? 22 : level === 2 ? 15 : 11;
        const needed = size * 2.4;
        if (this.y < 54 + needed) this.addPage(this.page.section);
        this.y -= level === 1 ? 12 : 7;
        this.block(text, { size, font: 'bold', leading: size * 1.2, after: 5, color: [0.05, 0.25, 0.38] });
    }

    markdown(markdown) {
        let inCode = false;
        for (const rawLine of String(markdown || '').split(/\r?\n/)) {
            if (rawLine.trim().startsWith('```')) {
                inCode = !inCode;
                this.y -= 3;
                continue;
            }
            const heading = rawLine.match(/^(#{1,3})\s+(.+)/);
            if (!inCode && heading) {
                this.heading(heading[2].replace(/[*_`]/g, ''), heading[1].length + 1);
            } else if (inCode) {
                this.block(rawLine, { size: 7.5, leading: 10, font: 'mono', indent: 10, maxChars: 116, color: [0.16, 0.22, 0.27] });
            } else if (/^\s*[-*]\s+/.test(rawLine)) {
                this.block(`- ${rawLine.replace(/^\s*[-*]\s+/, '').replace(/[*_`]/g, '')}`, { indent: 10, maxChars: 94, after: 2 });
            } else {
                this.block(rawLine.replace(/[*_`]/g, ''), { after: rawLine ? 3 : 0 });
            }
        }
    }

    toBuffer() {
        for (let i = 0; i < this.pages.length; i += 1) {
            const page = this.pages[i];
            page.operations.push(`0.38 0.43 0.48 rg BT /F1 8 Tf 1 0 0 1 54 30 Tm (${pdfEscape(this.title)}) Tj ET`);
            page.operations.push(`0.38 0.43 0.48 rg BT /F1 8 Tf 1 0 0 1 510 30 Tm (Page ${i + 1}) Tj ET`);
        }
        const objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
        ];
        const pageIds = [];
        for (const page of this.pages) {
            const stream = page.operations.join('\n');
            const contentId = objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
            const pageId = objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`);
            pageIds.push(pageId);
        }
        objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
        let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
        const offsets = [0];
        objects.forEach((object, index) => {
            offsets.push(Buffer.byteLength(output, 'latin1'));
            output += `${index + 1} 0 obj\n${object}\nendobj\n`;
        });
        const xref = Buffer.byteLength(output, 'latin1');
        output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        output += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
        output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
        return Buffer.from(output, 'latin1');
    }
}

async function collectCodeFiles(rootPath, currentPath = rootPath) {
    const files = [];
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith('.') && !isPythonVirtualEnvironment(fullPath)) {
            files.push(...await collectCodeFiles(rootPath, fullPath));
        } else if (entry.isFile() && isValidFileType(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

async function generatePdfForDirectory(directoryPath, { title, organization, outputPath, generate = generateDocumentation } = {}) {
    if (!title || !organization) throw new Error('Both title and organization are required.');
    const rootPath = path.resolve(directoryPath);
    const stat = await fs.stat(rootPath);
    if (!stat.isDirectory()) throw new Error(`Not a directory: ${directoryPath}`);
    const files = await collectCodeFiles(rootPath);
    if (!files.length) throw new Error(`No supported code files found in ${directoryPath}`);

    const document = new PdfDocument(title, organization);
    document.addPage('Cover');
    document.y = 560;
    document.block(organization.toUpperCase(), { size: 12, font: 'bold', color: [0.10, 0.45, 0.62], after: 18 });
    document.block(title, { size: 32, font: 'bold', leading: 38, maxChars: 30, color: [0.04, 0.20, 0.31], after: 18 });
    document.line(54, document.y, 240, document.y, [0.10, 0.55, 0.70]);
    document.y -= 28;
    document.block('CODEBASE DOCUMENTATION', { size: 11, color: [0.35, 0.40, 0.44], after: 8 });
    document.block(`${files.length} source files | Generated ${new Date().toISOString().slice(0, 10)}`, { size: 10, color: [0.35, 0.40, 0.44] });

    document.addPage('Contents');
    document.heading('Contents');
    files.forEach((file, index) => document.block(`${String(index + 1).padStart(2, '0')}   ${path.relative(rootPath, file)}`, { size: 9, leading: 14 }));

    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const relativePath = path.relative(rootPath, file);
        const source = await fs.readFile(file, 'utf8');
        const language = getLanguageFromExtension(file);
        console.log(`[${index + 1}/${files.length}] Documenting ${relativePath}`);
        let lastProgressAt = 0;
        const documentation = await generate({
            fileContent: source,
            language,
            filePath: relativePath,
            basePrompt: `${DEFAULT_BASE_PROMPT} Produce a professional overview covering purpose, key components, control flow, dependencies, and notable implementation details.`,
            onProgress: ({ content }) => {
                const now = Date.now();
                if (now - lastProgressAt < 1000) return;
                lastProgressAt = now;
                console.log(`[${index + 1}/${files.length}] Receiving ${relativePath} (${content.length} characters)`);
            },
        });
        document.addPage(relativePath);
        document.block(`FILE ${String(index + 1).padStart(2, '0')} / ${String(files.length).padStart(2, '0')}`, { size: 8, font: 'bold', color: [0.10, 0.55, 0.70], after: 4 });
        document.heading(relativePath);
        document.block(`${language} | ${source.split(/\r?\n/).length} lines`, { size: 9, color: [0.38, 0.43, 0.48], after: 12 });
        document.markdown(documentation);
        document.heading('Source code', 2);
        document.markdown(`\`\`\`${language.toLowerCase()}\n${source}\n\`\`\``);
    }

    const destination = path.resolve(outputPath || path.join(rootPath, 'codebase-documentation.pdf'));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, document.toBuffer());
    return { outputPath: destination, fileCount: files.length, pageCount: document.pages.length };
}

module.exports = { collectCodeFiles, generatePdfForDirectory, PdfDocument };
