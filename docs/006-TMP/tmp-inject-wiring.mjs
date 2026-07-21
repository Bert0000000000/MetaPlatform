import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const pagesDir = 'd:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-design-draft\\pages';
const designFile = 'd:\\Hermes\\Workspace\\10_Projects\\2026-07-02-MetaPlatform\\metaplatform-design-draft\\metaplatform-design-draft.design';

const menuItems = [
  { text: '工作台', domId: 'nav-dashboard' },
  { text: 'SuperAI', domId: 'nav-superai' },
  { text: '架构中心', domId: 'nav-arch' },
  { text: '应用中心', domId: 'nav-apps' },
  { text: '本体引擎', domId: 'nav-ontology' },
  { text: 'MCP 中心', domId: 'nav-mcp' },
  { text: '数字员工', domId: 'nav-agents' },
  { text: '后台管理', domId: 'nav-admin' },
];

const navTargets = {
  'nav-dashboard': 'page-dashboard',
  'nav-superai': 'page-superai-dialogue',
  'nav-arch': 'page-arch-business',
  'nav-apps': 'page-apps-list',
  'nav-ontology': 'page-ontology-modeling',
  'nav-mcp': 'page-mcp-tools',
  'nav-agents': 'page-agents-list',
  'nav-admin': 'page-admin-users',
};

const files = readdirSync(pagesDir).filter(f => f.endsWith('.html'));
let injectedCount = 0;

for (const file of files) {
  const filePath = join(pagesDir, file);
  let html = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  for (const menu of menuItems) {
    if (html.includes(`data-dom-id="${menu.domId}"`)) continue;
    
    const escaped = menu.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Find <a> tag followed by <span>MenuText</span> anywhere between
    const blockRegex = new RegExp(
      `(<a\\s+class="v-sidebar-item(?:\\s+active)?"\\s+href="[^"]*">)([\\s\\S]*?)(<span>${escaped}</span>)`,
    );
    
    const match = html.match(blockRegex);
    if (match && !match[1].includes('data-dom-id=')) {
      const newTag = match[1].replace('>', ` data-dom-id="${menu.domId}">`);
      html = html.replace(match[1], newTag);
      modified = true;
      console.log(`  ${file}: added ${menu.domId}`);
    }
  }
  
  if (modified) {
    writeFileSync(filePath, html, 'utf-8');
    injectedCount++;
  }
}

console.log(`Injected data-dom-id into ${injectedCount} files`);

let missing = 0;
for (const file of files) {
  const html = readFileSync(join(pagesDir, file), 'utf-8');
  if (!html.includes('data-dom-id="nav-dashboard"')) {
    console.log(`MISSING: ${file}`);
    missing++;
  }
}
console.log(`${missing} files still missing nav-dashboard dom-id`);

const design = JSON.parse(readFileSync(designFile, 'utf-8'));
const interactions = menuItems.map(m => ({
  domId: m.domId,
  targetPageId: navTargets[m.domId],
  hideEdge: true,
  transitionLabel: m.text,
}));

for (const node of design.data) {
  if (node.type === 'page') {
    node.devMetadata.interactions = interactions;
  }
}

writeFileSync(designFile, JSON.stringify(design, null, 2), 'utf-8');
console.log(`Wired 42 pages with ${interactions.length} interactions each`);