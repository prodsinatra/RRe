const fs = require('fs');

let content = fs.readFileSync('run_tests.ts', 'utf8');
content = content.replace(
  'function testWebhookSecurity() {',
  'function testWebhookSecurity() {\n  const oldHosts = process.env.WEBHOOK_ALLOWED_HOSTS;\n  delete process.env.WEBHOOK_ALLOWED_HOSTS;'
);
content = content.replace(
  'console.log("✅ Webhook SSRF security tests passed.");',
  'console.log("✅ Webhook SSRF security tests passed.");\n  if (oldHosts !== undefined) process.env.WEBHOOK_ALLOWED_HOSTS = oldHosts;'
);

fs.writeFileSync('run_tests.ts', content);
