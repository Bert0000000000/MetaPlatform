const fs = require('fs');
const path = require('path');
// Resolve Babel modules from an APP that already has them installed.
const babelRoot = path.resolve(__dirname, '..', '..', 'APP-DASHBOARD');
const parser = require(path.join(babelRoot, 'node_modules/@babel/parser'));
const traverse = require(path.join(babelRoot, 'node_modules/@babel/traverse')).default;

const apps = [
  'APP-DASHBOARD',
  'APP-SUPERAI',
  'APP-DW',
  'APP-APPHUB',
  'APP-ONTSTUDIO',
  'APP-ARCH',
  'APP-MCPHUB',
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Fix corruption left by a previous naive regex-based run that replaced
  // lambda arrows (=>) inside JSX expressions with scroll props.
  content = content.replace(/= scroll=\{\{ x: 'max-content' \}\}>/g, '=>');

  let ast;
  try {
    ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (err) {
    console.error('parse error', file, err.message);
    return;
  }

  const insertions = [];
  traverse(ast, {
    JSXOpeningElement(path) {
      const name = path.node.name;
      if (name.type !== 'JSXIdentifier' || name.name !== 'Table') return;

      const hasScroll = path.node.attributes.some(
        (attr) => attr.type === 'JSXAttribute' && attr.name.name === 'scroll'
      );
      if (hasScroll) return;

      const end = path.node.end;
      const before = content.slice(0, end);
      let insertPos = end;
      if (before.endsWith('/>')) {
        insertPos = end - 2;
      } else if (before.endsWith('>')) {
        insertPos = end - 1;
      } else {
        const lastGt = before.lastIndexOf('>');
        if (lastGt === -1) return;
        insertPos = lastGt;
      }

      insertions.push({ pos: insertPos, text: ' scroll={{ x: \'max-content\' }}' });
    },
  });

  if (insertions.length === 0 && content === original) return;

  insertions.sort((a, b) => b.pos - a.pos);
  for (const { pos, text } of insertions) {
    content = content.slice(0, pos) + text + content.slice(pos);
  }

  fs.writeFileSync(file, content);
  console.log('updated', file, insertions.length);
}

for (const app of apps) {
  const src = path.join(__dirname, '..', '..', app, 'src');
  if (!fs.existsSync(src)) continue;
  for (const file of walk(src)) {
    processFile(file);
  }
}
