const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(getFiles(file));
    else if (file.endsWith('.jsx')) results.push(file);
  });
  return results;
}

const files = getFiles(path.join(__dirname, '../../client/src'));
let realErrors = [];

files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  const importBlocks = code.match(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g) || [];
  const importedIdentifiers = new Set();
  importBlocks.forEach(block => {
    const raw = block.replace(/^import\s+/, '').replace(/\s+from\s+['"][^'"]+['"];?$/, '').replace(/[{}]/g, '');
    const names = raw.split(',');
    names.forEach(n => {
      const parts = n.trim().split(/\s+as\s+/);
      const name = parts[parts.length - 1].trim();
      if (name) importedIdentifiers.add(name);
    });
  });

  const tagMatches = [...code.matchAll(/<([A-Z][a-zA-Z0-9]+)[\s\/>]/g)].map(m => m[1]);
  const uniqueTags = [...new Set(tagMatches)];

  uniqueTags.forEach(tag => {
    const isDeclared = new RegExp('(function|const|let|var|class)\\s+' + tag + '\\b').test(code);
    if (!importedIdentifiers.has(tag) && !isDeclared && tag !== 'React') {
      realErrors.push({ file: path.relative(__dirname, f), tag });
    }
  });
});

console.log('ACTUAL MISSING JSX TAGS:');
console.log(JSON.stringify(realErrors, null, 2));
