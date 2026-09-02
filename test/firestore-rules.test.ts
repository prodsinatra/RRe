/**
 * Firestore security rules tests.
 *
 * Runs against the Firestore emulator, which enforces firestore.rules exactly
 * as production does. These assertions encode the architectural fact that the
 * browser never talks to Firestore directly: every path must be closed to
 * client SDKs, signed in or not. The Express API is unaffected because the
 * Admin SDK bypasses rules.
 *
 * Run via: npm run test:rules
 */
import {
  initializeTestEnvironment,
  assertFails,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "node:fs";
import assert from "node:assert";

// Every collection the application actually uses, from firestore-db.ts,
// wallet-db.ts and server/auth.ts.
const PATHS = [
  "projects/proj_123456",
  "projects/proj_123456/events/evt_1",
  "policies/active",
  "wallets/user_abc",
  "wallets/user_abc/ledger/entry_1",
  "stripe_events/evt_stripe_1",
  "users/user_abc",
];

let testEnv: RulesTestEnvironment;

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-rre",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  const anonymous = testEnv.unauthenticatedContext().firestore();
  // A signed-in user is the case the previous rules allowed through.
  const signedIn = testEnv.authenticatedContext("user_abc").firestore();
  // Custom claims must not buy access either.
  const claimedAdmin = testEnv
    .authenticatedContext("user_admin", { role: "admin" })
    .firestore();

  const clients: Array<[string, ReturnType<typeof testEnv.unauthenticatedContext>["firestore"] extends () => infer R ? R : never]> = [
    ["unauthenticated", anonymous],
    ["signed in", signedIn],
    ["signed in with role=admin claim", claimedAdmin],
  ];

  for (const [label, db] of clients) {
    for (const path of PATHS) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), { tampered: true }));
    }
    // Listing a collection must fail too, not just reading one document.
    await assertFails(getDocs(collection(db, "projects")));
    await assertFails(getDocs(collection(db, "wallets")));
    console.log(`✅ ${label}: all ${PATHS.length} paths denied for read and write, collection listing denied.`);
  }

  // Guard against the test suite silently passing because the emulator
  // rejected everything for an unrelated reason: with rules disabled, the
  // same write must succeed.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "projects/proj_123456"), { title: "probe" });
    const snap = await getDoc(doc(ctx.firestore(), "projects/proj_123456"));
    assert(snap.exists(), "admin-context write must succeed, or the test proves nothing");
  });
  console.log("✅ Admin context (the Express API's access path) is unaffected by the rules.");

  await testEnv.cleanup();
  console.log("🎉 Firestore rules tests passed.");
}

main().catch(async (err) => {
  console.error("❌ Firestore rules tests failed:", err);
  if (testEnv) await testEnv.cleanup();
  process.exit(1);
});
