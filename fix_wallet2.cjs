const fs = require('fs');

let content = fs.readFileSync('src/db/wallet-db.ts', 'utf8');

content = content.replace(
  '// Local fallback memory cache',
  'let isFirestoreAvailable = true;\n// Local fallback memory cache'
);

content = content.replace(
  'console.warn("[Wallet DB] Firestore failed, using mock data.", e.message);',
  'if (e.code === 7 || e.message.includes("Firestore disabled")) { isFirestoreAvailable = false; }\n    // console.warn("[Wallet DB] Firestore failed, using mock data.", e.message);'
);

content = content.replace(
  'console.warn("[Wallet DB] Firestore credit failed, using mock data.", e.message);',
  'if (e.code === 7 || e.message.includes("Firestore disabled")) { isFirestoreAvailable = false; }\n    // console.warn("[Wallet DB] Firestore credit failed, using mock data.", e.message);'
);

content = content.replace(
  'console.warn("[Wallet DB] Firestore debit failed, using mock data.", e.message);',
  'if (e.code === 7 || e.message.includes("Firestore disabled")) { isFirestoreAvailable = false; }\n    // console.warn("[Wallet DB] Firestore debit failed, using mock data.", e.message);'
);

content = content.replace(/const db = getFirestore\(\);/g, 'if (!isFirestoreAvailable) throw new Error("Firestore disabled");\n    const db = getFirestore();');

fs.writeFileSync('src/db/wallet-db.ts', content);
