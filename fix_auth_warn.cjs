const fs = require('fs');

let content = fs.readFileSync('server/auth.ts', 'utf8');

content = content.replace(
  'console.warn("Firestore role fetch failed", e.message);',
  '/* silently fallback */'
);

fs.writeFileSync('server/auth.ts', content);
