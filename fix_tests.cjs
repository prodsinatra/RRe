const fs = require('fs');
let content = fs.readFileSync('run_tests.ts', 'utf8');
content = content.replace(/const { sha256Canonical } = .*;/g, '');
fs.writeFileSync('run_tests.ts', content);
