const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Imports
const importsToAdd = `
import { requireAuth, authorizeRoles } from "./server/auth";
import { getWalletBalance, creditWallet, debitWalletForManifest } from "./src/db/wallet-db";
import { sha256Canonical } from "./src/lib/crypto/canonicalJson";
import { validateWebhookUrl } from "./server/webhook-security";
`;

content = content.replace('import { config } from "dotenv";\nconfig();', 'import { config } from "dotenv";\nconfig();\n' + importsToAdd);

// 2. Stripe Webhook (raw body) BEFORE express.json()
const stripeWebhook = `
// Phase 3: Stripe Webhook must parse raw body
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (!endpointSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(\`Webhook Error: \${err.message}\`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    // Assuming our price is $5.00 for 1 token for simplicity, or decode amount/price mapping.
    // For now we'll just parse the metadata or assume 1 token = $5.00
    // Actually the checkout sends 'tokens' inside metadata if we want, but let's just do (amount_total / 500)
    const tokens = session.amount_total ? Math.floor(session.amount_total / 500) : 1;
    if (userId) {
      try {
        await creditWallet(userId, tokens, "Stripe Checkout", event.id);
      } catch (err) {
        console.error("Wallet credit error:", err.message);
      }
    }
  }
  res.send();
});
`;
content = content.replace('const app = express();', 'const app = express();\n' + stripeWebhook);


// 3. Remove mock userWallets
content = content.replace(/const userWallets: Record<string, number> = {[\s\S]*?};/, '');

// 4. Update wallet GET endpoint
content = content.replace(/app\.get\("\/api\/wallet\/:userId",.*?res\.json\({ balance }\);\n}\);/s, `app.get("/api/wallet/me", requireAuth, async (req, res) => {
  try {
    const balance = await getWalletBalance(req.user!.uid);
    res.json({ balance });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});`);

// 5. Update Checkout session endpoint
content = content.replace(/app\.post\("\/api\/checkout\/create-session".*?catch \(e: any\) {\n    res\.status\(500\)\.json\({ error: e\.message }\);\n  }\n}\);/s, `app.post("/api/checkout/create-session", requireAuth, async (req, res) => {
  if (process.env.ENABLE_BILLING !== "true") {
    return res.status(400).json({ error: "Billing is disabled in this environment." });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Server configuration error: Stripe key missing." });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Readiness Token',
              description: 'Enterprise Token to cryptographically seal and export delivery manifests.',
            },
            unit_amount: 500, // $5.00
          },
          quantity: req.body.tokens || 1,
        },
      ],
      mode: 'payment',
      success_url: \`\${req.protocol}://\${req.get('host')}/?success=true\`,
      cancel_url: \`\${req.protocol}://\${req.get('host')}/?canceled=true\`,
      metadata: {
        userId: req.user!.uid
      }
    });
    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});`);

// 6. Protect GET /api/projects/:id/events
content = content.replace(/app\.get\("\/api\/projects\/:id\/events", async \(req, res\) => {/g, 'app.get("/api/projects/:id/events", requireAuth, authorizeRoles("viewer", "operator", "approver", "admin"), async (req, res) => {');

// 7. Protect create project
content = content.replace(/app\.post\("\/api\/projects", async \(req, res\) => {/g, 'app.post("/api/projects", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {');

// 8. Protect GET /api/projects/:id
content = content.replace(/app\.get\("\/api\/projects\/:id", async \(req, res\) => {/g, 'app.get("/api/projects/:id", requireAuth, authorizeRoles("viewer", "operator", "approver", "admin"), async (req, res) => {');

// 9. Protect PUT /api/projects/:id
content = content.replace(/app\.put\("\/api\/projects\/:id", async \(req, res\) => {/g, 'app.put("/api/projects/:id", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {');

// 10. Protect DELETE /api/projects/:id
content = content.replace(/app\.delete\("\/api\/projects\/:id", async \(req, res\) => {/g, 'app.delete("/api/projects/:id", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {');

// 11. Protect POST transition
content = content.replace(/app\.post\("\/api\/projects\/:id\/transition", async \(req, res\) => {/g, 'app.post("/api/projects/:id/transition", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {');

// 12. Protect POST checks
content = content.replace(/app\.post\("\/api\/projects\/:id\/checks", async \(req, res\) => {/g, 'app.post("/api/projects/:id/checks", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {');

// 13. Protect POST approve
content = content.replace(/app\.post\("\/api\/projects\/:id\/approve", async \(req, res\) => {/g, 'app.post("/api/projects/:id/approve", requireAuth, authorizeRoles("approver", "admin"), async (req, res) => {');

// 14. Protect POST manifest
content = content.replace(/app\.post\("\/api\/projects\/:id\/manifest", async \(req, res\) => {/g, 'app.post("/api/projects/:id/manifest", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {');

// 15. Protect POST artwork
content = content.replace(/app\.post\("\/api\/projects\/:id\/artwork\/generate", async \(req, res\) => {/g, 'app.post("/api/projects/:id/artwork/generate", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {');

// 16. Protect POST summary
content = content.replace(/app\.post\("\/api\/projects\/:id\/summary", async \(req, res\) => {/g, 'app.post("/api/projects/:id/summary", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {');

// 17. Use req.user instead of req.body.actorId/actorRole across all applyStateTransition
content = content.replace(/\{ id: req\.body\.actorId \|\| "[^"]+", role: req\.body\.actorRole \|\| "[^"]+" \}/g, '{ id: req.user!.uid, role: req.user!.role }');
content = content.replace(/const actorId = req\.body\.actorId \|\| "approver_1";\n\s+const actorRole = req\.body\.actorRole \|\| "approver";/g, 'const actorId = req.user!.uid;\n  const actorRole = req.user!.role;');
content = content.replace(/\{ id: actorId, role: actorRole \}/g, '{ id: req.user!.uid, role: req.user!.role }');

// 18. Fix ownership logic on create/get/update
// I will just use sed or manually edit the functions in the file since regex is tricky for this.
// We'll write this script out and execute it.
fs.writeFileSync('server.ts', content);
