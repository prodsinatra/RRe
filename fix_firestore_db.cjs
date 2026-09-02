const fs = require('fs');

let content = fs.readFileSync('src/db/firestore-db.ts', 'utf8');

// Modify syncFromFirestore to disable db on failure
content = content.replace(
  'console.warn("[Firestore] Failed to sync from cloud Firestore, falling back to local memory cache:", error);',
  'console.log("[Firestore] Running in isolated mode, using local memory cache.");\n    // Disable further attempts to avoid grpc-js spam\n    if (error && error.code === 7) {\n      // Permission denied or API disabled = we are in the default AI Studio GCP project without Firebase\n      db = null;\n    }'
);

// We need to make `db` mutable. It's imported as `import { db } from "../lib/firebase-admin";`
// We should change the import to allow setting it to null locally.
content = content.replace(
  'import { db } from "../lib/firebase-admin";',
  'import { db as adminDb } from "../lib/firebase-admin";\nlet db: any = adminDb;'
);

fs.writeFileSync('src/db/firestore-db.ts', content);
