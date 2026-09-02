const fs = require('fs');

// 1. Fix server.ts imports
let content = fs.readFileSync('server.ts', 'utf8');
if (!content.includes('import { requireAuth')) {
  const importsToAdd = `
import { requireAuth, authorizeRoles } from "./server/auth.js";
import { getWalletBalance, creditWallet, debitWalletForManifest } from "./src/db/wallet-db.js";
import { sha256Canonical } from "./src/lib/crypto/canonicalJson.js";
import { validateWebhookUrl } from "./server/webhook-security.js";
`;
  content = importsToAdd + content;
  fs.writeFileSync('server.ts', content);
}

// 2. Rewrite auth.ts
const authTs = `import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Request, Response, NextFunction } from "express";

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();

// Role definition
export type UserRole = "viewer" | "operator" | "approver" | "admin";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: UserRole;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    return;
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    
    // Resolve role: Custom claims > Firestore users/{uid} > "viewer"
    let role: UserRole = "viewer";
    if (decodedToken.role && ["viewer", "operator", "approver", "admin"].includes(decodedToken.role as string)) {
      role = decodedToken.role as UserRole;
    } else {
      const userDoc = await db.collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists) {
        const docRole = userDoc.data()?.role;
        if (docRole && ["viewer", "operator", "approver", "admin"].includes(docRole)) {
          role = docRole as UserRole;
        }
      }
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
    };
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
    return;
  }
};

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden: Insufficient permissions" });
      return;
    }
    next();
  };
};
`;
fs.writeFileSync('server/auth.ts', authTs);

// 3. Rewrite wallet-db.ts
const walletDbTs = `import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();

export const getWalletBalance = async (uid: string): Promise<number> => {
  const doc = await db.collection("wallets").doc(uid).get();
  if (!doc.exists) return 0;
  return doc.data()?.balance || 0;
};

export const creditWallet = async (
  uid: string,
  amount: number,
  reason: string,
  stripeEventId?: string
): Promise<{ balance: number; entryId: string }> => {
  return await db.runTransaction(async (transaction) => {
    // 1. Check if event was already processed
    if (stripeEventId) {
      const eventRef = db.collection("stripe_events").doc(stripeEventId);
      const eventDoc = await transaction.get(eventRef);
      if (eventDoc.exists) {
        throw new Error("Stripe event already processed");
      }
      transaction.set(eventRef, { processedAt: FieldValue.serverTimestamp() });
    }

    const walletRef = db.collection("wallets").doc(uid);
    const walletDoc = await transaction.get(walletRef);
    let newBalance = amount;

    if (walletDoc.exists) {
      newBalance = (walletDoc.data()?.balance || 0) + amount;
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.set(walletRef, {
        balance: newBalance,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const ledgerRef = walletRef.collection("ledger").doc();
    transaction.set(ledgerRef, {
      type: "credit",
      amount,
      balanceAfter: newBalance,
      reason,
      stripeEventId,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { balance: newBalance, entryId: ledgerRef.id };
  });
};

export const debitWalletForManifest = async (
  uid: string,
  projectId: string
): Promise<{ balance: number; entryId: string }> => {
  return await db.runTransaction(async (transaction) => {
    const walletRef = db.collection("wallets").doc(uid);
    const walletDoc = await transaction.get(walletRef);

    if (!walletDoc.exists) {
      throw new Error("Insufficient balance");
    }

    const currentBalance = walletDoc.data()?.balance || 0;
    if (currentBalance < 1) {
      throw new Error("Insufficient balance");
    }

    const newBalance = currentBalance - 1;
    transaction.update(walletRef, {
      balance: newBalance,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const ledgerRef = walletRef.collection("ledger").doc();
    transaction.set(ledgerRef, {
      type: "debit",
      amount: 1,
      balanceAfter: newBalance,
      reason: "Seal Delivery Manifest",
      projectId,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { balance: newBalance, entryId: ledgerRef.id };
  });
};
`;
fs.writeFileSync('src/db/wallet-db.ts', walletDbTs);
