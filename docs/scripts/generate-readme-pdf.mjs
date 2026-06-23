#!/usr/bin/env node
/**
 * Generates docs/OpsTracker-System-Documentation.pdf from README.md
 * - Renders Mermaid diagrams to SVG via @mermaid-js/mermaid-cli
 * - Builds styled HTML and prints PDF via Puppeteer
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DOCS = path.resolve(ROOT, 'docs');
const DIAGRAMS_DIR = path.resolve(DOCS, 'diagrams');
const README_PATH = path.resolve(ROOT, 'README.md');
const CSS_PATH = path.resolve(DOCS, 'styles/pdf.css');
const HTML_PATH = path.resolve(DOCS, 'OpsTracker-Documentation.html');
const PDF_PATH = path.resolve(DOCS, 'OpsTracker-System-Documentation.pdf');

const DIAGRAM_TITLES = [
  'System Architecture Overview',
  'Request Lifecycle (Authentication Flow)',
  'Deployment Topology',
  'User Roles & Access Hierarchy',
  'Feature Modules Mind Map',
  'Equipment Status State Machine',
  'QR Code Workflow',
  'Database Entity Relationships',
  'Vercel Cron — Maintenance Alerts',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function stripBadges(md) {
  return md
    .replace(/^\[![^\]]+\]\([^)]+\)\s*$/gm, '')
    .replace(/^\*\*Live API:\*\*.*$/gm, '')
    .replace(/^\*\*Repository:\*\*.*$/gm, '')
    .replace(/^---\s*$/gm, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function removeMarkdownToc(md) {
  // Stop at the next ## heading — do NOT use --- (matches table separators after stripBadges)
  return md.replace(/## Table of Contents[\s\S]*?(?=\n## )/, '');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractMermaidBlocks(md) {
  const regex = /```mermaid\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  let idx = 0;
  let processed = md;

  while ((match = regex.exec(md)) !== null) {
    blocks.push({ index: idx, content: match[1].trim() });
    idx++;
  }

  let blockIndex = 0;
  processed = md.replace(/```mermaid\n([\s\S]*?)```/g, () => {
    const placeholder = `[[MERMAID_DIAGRAM_${blockIndex}]]`;
    blockIndex++;
    return placeholder;
  });

  return { blocks, processed };
}

function renderMermaidDiagrams(blocks) {
  ensureDir(DIAGRAMS_DIR);
  const svgPaths = [];

  for (let i = 0; i < blocks.length; i++) {
    const mmdPath = path.join(DIAGRAMS_DIR, `diagram-${i + 1}.mmd`);
    const svgPath = path.join(DIAGRAMS_DIR, `diagram-${i + 1}.svg`);
    fs.writeFileSync(mmdPath, blocks[i].content);

    try {
      const isWide = /^(erDiagram|mindmap)/.test(blocks[i].content);
      const width = isWide ? 1400 : 960;
      execSync(
        `npx --yes @mermaid-js/mermaid-cli@11 -i "${mmdPath}" -o "${svgPath}" -b white -w ${width}`,
        { stdio: 'pipe', cwd: ROOT }
      );
      svgPaths.push(svgPath);
      console.log(`  ✓ Diagram ${i + 1}: ${DIAGRAM_TITLES[i] || `Diagram ${i + 1}`}`);
    } catch (err) {
      console.warn(`  ⚠ Diagram ${i + 1} failed, using placeholder`);
      svgPaths.push(null);
    }
  }

  return svgPaths;
}

function injectDiagrams(html, svgPaths) {
  let result = html;
  svgPaths.forEach((svgPath, i) => {
    const title = DIAGRAM_TITLES[i] || `Diagram ${i + 1}`;
    let diagramHtml;

    if (svgPath && fs.existsSync(svgPath)) {
      const svgId = `diagram-svg-${i + 1}`;
      const svg = fs
        .readFileSync(svgPath, 'utf8')
        .replace(/\bid="my-svg"/g, `id="${svgId}"`)
        .replace(/#my-svg/g, `#${svgId}`);
      diagramHtml = `<div class="diagram"><div class="diagram-frame">${svg}</div><p class="diagram-caption">Figure ${i + 1}: ${title}</p></div>`;
    } else {
      diagramHtml = `<div class="diagram"><p class="diagram-caption">Figure ${i + 1}: ${title} (diagram unavailable)</p></div>`;
    }

    result = result.replace(`<p>[[MERMAID_DIAGRAM_${i}]]</p>`, diagramHtml);
    result = result.replace(`[[MERMAID_DIAGRAM_${i}]]`, diagramHtml);
  });
  return result;
}

function buildToc(md) {
  const headings = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  const items = headings
    .filter((h) => !h.includes('Table of Contents'))
    .map((h) => `<li><a href="#${slugify(h)}">${h}</a></li>`)
    .join('\n');
  return `<nav class="toc" aria-label="Table of Contents"><h1>Table of Contents</h1><ol>${items}</ol></nav>`;
}

function buildCover() {
  const year = new Date().getFullYear();
  return `
<div class="cover">
  <div class="cover-logo">OT</div>
  <h1>OpsTracker</h1>
  <p class="subtitle">Construction Operations Tracker — Complete System Documentation</p>
  <div class="cover-meta">
    <span class="cover-badge">React 19 · Express 5 · PostgreSQL</span>
    <span class="cover-badge">Role-Based Dashboards</span>
    <span class="cover-badge">Equipment Management</span>
    <span class="cover-badge">Vercel Deployment</span>
  </div>
  <div class="cover-footer">© ${year} OpsTracker · github.com/bvggies/constructionoperations</div>
</div>`;
}

async function generatePdf(htmlPath, pdfPath) {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;font-size:8px;color:#9ca3af;padding:0 18mm;display:flex;justify-content:space-between;font-family:sans-serif;">
        <span>OpsTracker System Documentation</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
  });
  await browser.close();
}

async function main() {
  console.log('📄 OpsTracker PDF Generator\n');

  ensureDir(DOCS);
  ensureDir(DIAGRAMS_DIR);

  let md = fs.readFileSync(README_PATH, 'utf8');
  md = removeMarkdownToc(md);
  md = stripBadges(md);

  console.log('🔷 Rendering Mermaid diagrams...');
  const { blocks, processed } = extractMermaidBlocks(md);
  const svgPaths = renderMermaidDiagrams(blocks);

  console.log('\n📝 Building HTML...');
  marked.setOptions({ gfm: true, breaks: false });

  let bodyHtml = marked.parse(processed);
  bodyHtml = injectDiagrams(bodyHtml, svgPaths);

  // Hide redundant repo title (cover page already shows branding)
  bodyHtml = bodyHtml.replace(/<h1[^>]*>OpsTracker — Construction Operations Tracker<\/h1>\s*/, '');

  // Page break before each major section (h2), except the first
  bodyHtml = bodyHtml.replace(/<h2>/g, '<h2 class="section-break">');
  bodyHtml = bodyHtml.replace(/<h2 class="section-break">System Overview<\/h2>/, '<h2>System Overview</h2>');

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const toc = buildToc(md);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>OpsTracker System Documentation</title>
  <style>${css}</style>
</head>
<body>
  ${buildCover()}
  ${toc}
  <div class="content">${bodyHtml}</div>
</body>
</html>`;

  fs.writeFileSync(HTML_PATH, html);
  console.log(`  ✓ HTML: ${HTML_PATH}`);

  console.log('\n🖨  Generating PDF...');
  await generatePdf(HTML_PATH, PDF_PATH);
  console.log(`  ✓ PDF:  ${PDF_PATH}`);

  const stats = fs.statSync(PDF_PATH);
  console.log(`\n✅ Done! PDF size: ${(stats.size / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error('❌ PDF generation failed:', err);
  process.exit(1);
});
