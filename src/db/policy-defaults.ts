import { CheckPolicy } from "../types";

/**
 * Default check policy.
 *
 * Deliberately backend-agnostic: this module must not import any persistence
 * layer, so that the domain tests in run_tests.ts can load it without
 * initializing a database client.
 */
export const defaultPolicy: CheckPolicy = {
  id: "policy_01",
  version: "v1.0",
  requiredRoles: ["Producer", "Songwriter"],
  artworkDimensions: "3000x3000",
  artworkFileTypes: ["image/jpeg", "image/png"],
  assetNamingConvention: "^[A-Za-z0-9_]+_(MASTER|INST|CLEAN|STEM)_v[0-9]+\\.wav$",
  createdAt: new Date().toISOString()
};
