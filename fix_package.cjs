const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.name = "808szn-release-readiness-engine";
pkg.scripts.test = "tsx run_tests.ts";
pkg.scripts.check = "npm run lint && npm run test && npm run build";
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
