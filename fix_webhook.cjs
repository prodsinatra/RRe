const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldWebhook = `async function broadcastToWebhook(message: string) {
  try {
    const policy = await getActivePolicy();
    if (!policy || !policy.webhookUrl) return;
    
    await fetch(policy.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
        system: "808 SZN Engine"
      })
    });
  } catch (error) {
    console.error("Webhook broadcast failed:", error);
  }
}`;

const newWebhook = `async function broadcastToWebhook(message: string) {
  try {
    const policy = await getActivePolicy();
    if (!policy || !policy.webhookUrl) return;

    if (!validateWebhookUrl(policy.webhookUrl)) {
      console.error("Webhook blocked: Invalid or prohibited URL.");
      return;
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await fetch(policy.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
        system: "808 SZN Engine"
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
  } catch (error: any) {
    console.error("Webhook broadcast failed:", error.name === 'AbortError' ? 'Timeout' : 'Error');
  }
}`;

content = content.replace(oldWebhook, newWebhook);

// Protect the policy endpoint and use Zod + URL validation
content = content.replace('app.put("/api/policies/active", async (req, res) => {', 'app.put("/api/policies/active", requireAuth, authorizeRoles("admin"), async (req, res, next) => {\n  if (!validateWebhookUrl(req.body.webhookUrl)) return res.status(400).json({ error: "Invalid webhook URL" });');

fs.writeFileSync('server.ts', content);
// Fix ZodError type
content = content.replace('details: err.errors', 'details: (err as z.ZodError).errors');
fs.writeFileSync('server.ts', content);
