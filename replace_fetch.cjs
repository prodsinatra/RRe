const fs = require('fs');

const filesToUpdate = [
  "src/components/pages/ArtworkPage.tsx",
  "src/components/pages/ChecksPage.tsx",
  "src/components/pages/AssetsPage.tsx",
  "src/components/pages/ManifestPage.tsx",
  "src/components/pages/PoliciesPage.tsx",
  "src/components/pages/MetadataPage.tsx",
  "src/components/pages/ReviewPage.tsx",
  "src/components/pages/CreditsPage.tsx",
  "src/components/layout/ProjectLayout.tsx",
  "src/App.tsx",
  "src/lib/store.ts"
];

for (const file of filesToUpdate) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Calculate relative path for fetchApi.ts
  const depth = (file.match(/\//g) || []).length;
  let importPath = "";
  if (depth === 1) importPath = "./lib/fetchApi"; // src/App.tsx
  else if (depth === 2) importPath = "../fetchApi"; // src/lib/store.ts
  else if (depth === 3) importPath = "../../lib/fetchApi"; // src/components/layout/ProjectLayout.tsx
  else if (depth === 4) importPath = "../../../lib/fetchApi"; // src/components/pages/ArtworkPage.tsx
  
  // Replace fetch( with fetchApi(
  // but only if it's fetching "/api"
  content = content.replace(/fetch\((['"`]\/api.*?['"`])/g, 'fetchApi($1');
  
  // In store.ts, replace wallet route
  if (file === "src/lib/store.ts") {
    content = content.replace(/fetchApi\(`\/api\/wallet\/\$\{userId\}`\)/, 'fetchApi(`/api/wallet/me`)');
  }

  // Add import if not present and if fetchApi is used
  if (content.includes('fetchApi(') && !content.includes('fetchApi')) {
    // Wait, the first condition covers it.
  }
  
  if (content.includes('fetchApi(') && !content.includes('import { fetchApi }')) {
    content = `import { fetchApi } from "${importPath}";\n` + content;
  }
  
  fs.writeFileSync(file, content);
}
