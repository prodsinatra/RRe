const fs = require('fs');
let content = fs.readFileSync('server/auth.ts', 'utf8');

// Ensure that we catch firestore errors when fetching userDoc
content = content.replace(
  'const userDoc = await db.collection("users").doc(decodedToken.uid).get();\n      if (userDoc.exists) {',
  'let userDoc;\n      try { userDoc = await db.collection("users").doc(decodedToken.uid).get(); } catch (e) { console.warn("Firestore role fetch failed", e.message); }\n      if (userDoc && userDoc.exists) {'
);

fs.writeFileSync('server/auth.ts', content);
