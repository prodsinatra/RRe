import crypto from "crypto";

export function canonicalize(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) || "null";
  }

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }

  const keys = Object.keys(value).sort();
  let objStr = "";
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const valStr = canonicalize(value[key]);
    if (valStr !== undefined) {
      if (objStr.length > 0) objStr += ",";
      objStr += JSON.stringify(key) + ":" + valStr;
    }
  }
  return "{" + objStr + "}";
}

export function sha256Canonical(value: any): string {
  const canonicalStr = canonicalize(value);
  return crypto.createHash("sha256").update(canonicalStr).digest("hex");
}
