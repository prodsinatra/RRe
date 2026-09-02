const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Imports
content = content.replace('import { validateWebhookUrl } from "./server/webhook-security.js";', 'import { validateWebhookUrl } from "./server/webhook-security.js";\nimport { CreateProjectSchema, UpdateProjectSchema, StateTransitionSchema, ArtworkGenerateSchema } from "./server/validators.js";\nimport { z } from "zod";');

// Error handler
const errorHandler = `
app.use((err: any, req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  console.error("Global Error:", err);
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: "Validation Error", details: err.errors });
  }
  res.status(500).json({ error: err.message || "Internal Server Error" });
});
`;

if (!content.includes('Global Error:')) {
  content = content.replace('// ==========================================\n// Vite Middleware', errorHandler + '\n// ==========================================\n// Vite Middleware');
}

// 1. Create project
const createProjRegex = /app\.post\("\/api\/projects", requireAuth, authorizeRoles\("operator", "admin"\), async \(req, res, next\) => \{\n  try \{\n    const newProj = await createProject\(req\.body\);/g;
// Actually the previous output was:
// app.post("/api/projects", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {
//   try {
//     const newProj = await createProject(req.body);
content = content.replace('app.post("/api/projects", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {\n  try {\n    const newProj = await createProject(req.body);', 'app.post("/api/projects", requireAuth, authorizeRoles("operator", "admin"), async (req, res, next) => {\n  try {\n    const validData = CreateProjectSchema.parse(req.body);\n    const newProj = await createProject({ ...validData, ownerId: req.user!.uid });');

// 2. Update project
content = content.replace('app.put("/api/projects/:id", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {\n  const proj = await getProject(req.params.id);\n  if (!proj) return res.status(404).json({ error: "Project not found" });\n\n  try {\n    const saved = await updateProject(req.params.id, req.body);', 'app.put("/api/projects/:id", requireAuth, authorizeRoles("operator", "admin"), async (req, res, next) => {\n  const proj = await getProject(req.params.id);\n  if (!proj) return res.status(404).json({ error: "Project not found" });\n\n  if (proj.ownerId !== req.user!.uid && req.user!.role !== "admin") {\n    return res.status(403).json({ error: "Forbidden: Not your project" });\n  }\n\n  try {\n    const validData = UpdateProjectSchema.parse(req.body);\n    const saved = await updateProject(req.params.id, validData);');

// 3. Delete project
content = content.replace('app.delete("/api/projects/:id", requireAuth, authorizeRoles("operator", "admin"), async (req, res) => {\n  const proj = await getProject(req.params.id);\n  if (!proj) return res.status(404).json({ error: "Project not found" });\n\n  try {\n    await deleteProject(req.params.id);', 'app.delete("/api/projects/:id", requireAuth, authorizeRoles("operator", "admin"), async (req, res, next) => {\n  const proj = await getProject(req.params.id);\n  if (!proj) return res.status(404).json({ error: "Project not found" });\n\n  if (proj.ownerId !== req.user!.uid && req.user!.role !== "admin") {\n    return res.status(403).json({ error: "Forbidden: Not your project" });\n  }\n\n  try {\n    await deleteProject(req.params.id);');

// Handle catch blocks to pass to next(err) where possible, but changing all of them is too complex for this script, standard res.status(500) will still work safely.

fs.writeFileSync('server.ts', content);
