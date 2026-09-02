import { URL } from "url";
import net from "net";

export function validateWebhookUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // 1. Require HTTPS
    if (url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname;

    // 2. Reject localhost and loopback
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
      return false;
    }

    // 3. Reject private IPv4
    if (net.isIPv4(hostname)) {
      const parts = hostname.split(".").map(Number);
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 169 && parts[1] === 254) // Link local
      ) {
        return false;
      }
    }

    // 4. Reject common cloud metadata
    if (hostname === "169.254.169.254" || hostname.includes("metadata.google.internal") || hostname.includes("169.254")) {
      return false;
    }

    // 5. Allowlist check if configured
    const allowedHosts = process.env.WEBHOOK_ALLOWED_HOSTS;
    if (allowedHosts) {
      const allowedList = allowedHosts.split(",").map(h => h.trim());
      if (!allowedList.includes(hostname)) {
        return false;
      }
    }

    return true;
  } catch (e) {
    return false;
  }
}
