import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import config from "../../firebase-applet-config.json";

let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

try {
  if (getApps().length === 0) {
    initializeApp({
      projectId: config.projectId || "reliable-jet-341703"
    });
  }
  adminDb = getFirestore();
  adminAuth = getAuth();
} catch (error) {
  console.warn("[FirebaseAdmin] Failed to initialize native Firebase Admin, will use fallback persistence adapter:", error);
}

export const db = adminDb;
export const auth = adminAuth;

