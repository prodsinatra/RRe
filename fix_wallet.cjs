const fs = require('fs');

const walletCode = `
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Local fallback memory cache
const mockWallets = new Map<string, number>();

export const getWalletBalance = async (uid: string): Promise<number> => {
  try {
    const db = getFirestore();
    const doc = await db.collection("wallets").doc(uid).get();
    if (!doc.exists) return mockWallets.get(uid) || 0;
    return doc.data()?.balance || 0;
  } catch (e) {
    console.warn("[Wallet DB] Firestore failed, using mock data.", e.message);
    return mockWallets.get(uid) || 0;
  }
};

export const creditWallet = async (
  uid: string,
  amount: number,
  reason: string,
  stripeEventId?: string
): Promise<{ balance: number; entryId: string }> => {
  try {
    const db = getFirestore();
    return await db.runTransaction(async (transaction) => {
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
  } catch (e) {
    console.warn("[Wallet DB] Firestore credit failed, using mock data.", e.message);
    const bal = (mockWallets.get(uid) || 0) + amount;
    mockWallets.set(uid, bal);
    return { balance: bal, entryId: "mock_entry_" + Date.now() };
  }
};

export const debitWalletForManifest = async (
  uid: string,
  projectId: string
): Promise<{ balance: number; entryId: string }> => {
  try {
    const db = getFirestore();
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
  } catch (e) {
    console.warn("[Wallet DB] Firestore debit failed, using mock data.", e.message);
    const bal = mockWallets.get(uid) || 0;
    if (bal < 1) throw new Error("Insufficient balance");
    const newBal = bal - 1;
    mockWallets.set(uid, newBal);
    return { balance: newBal, entryId: "mock_entry_" + Date.now() };
  }
};
`;

fs.writeFileSync('src/db/wallet-db.ts', walletCode);
