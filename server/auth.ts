import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
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

// See the note in requireAuth. Closed unless explicitly opened, and never
// openable in production.
export const MOCK_AUTH_ENABLED =
  process.env.ALLOW_MOCK_AUTH === "true" && process.env.NODE_ENV !== "production";

if (MOCK_AUTH_ENABLED) {
  console.warn(
    "[auth] ALLOW_MOCK_AUTH is on: any `user_<role>_*` bearer token is accepted " +
      "without verification. Local development only — never set this where the " +
      "server is reachable by anyone else."
  );
}

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
    // Local-development escape hatch: a token of the form `user_<role>_<x>` is
    // accepted at face value, with the role read straight out of the string.
    //
    // This is an authentication bypass by construction, so it is double-gated:
    // it requires ALLOW_MOCK_AUTH=true to be set explicitly, and it is refused
    // outright when NODE_ENV is "production". Both default to closed.
    //
    // It exists only because the browser has no real sign-in yet: LoginPage is
    // a role picker and AuthContext fabricates a localStorage user whose id is
    // sent as the bearer token. Once Firebase Auth is wired into the client,
    // delete this branch and the flag with it.
    if (MOCK_AUTH_ENABLED && token.startsWith("user_")) {
      const parts = token.split("_");
      let role = (parts[1] || "viewer");
      if (!["viewer", "operator", "approver", "admin"].includes(role)) {
        role = "viewer";
      }
      req.user = {
        uid: token,
        email: `${role}@808szn.mock`,
        role: role as UserRole
      };
      return next();
    }

    const decodedToken = await getAuth().verifyIdToken(token);

    
    // Resolve role: Custom claims > Firestore users/{uid} > "viewer"
    let role: UserRole = "viewer";
    if (decodedToken.role && ["viewer", "operator", "approver", "admin"].includes(decodedToken.role as string)) {
      role = decodedToken.role as UserRole;
    } else {
      let userDoc;
      try { userDoc = await db.collection("users").doc(decodedToken.uid).get(); } catch (e) { /* silently fallback */ }
      if (userDoc && userDoc.exists) {
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
