// Checkout calls must carry the buyer's IP in Shopify-Buyer-IP. Deployed, that's the
// visitor's address from the proxy headers. Running locally the request comes from
// 127.0.0.1, so in development only we look up this machine's public IP — which is
// the buyer's, since the buyer is the person running the app.

import "server-only";
import { cached, TTL } from "../cache";

function isPrivate(ip: string): boolean {
  return (
    !ip ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80") ||
    ip.startsWith("::ffff:127.")
  );
}

export async function buyerIp(headers: Headers): Promise<string | undefined> {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip") || "";
  if (candidate && !isPrivate(candidate)) return candidate;
  if (process.env.BUYER_IP) return process.env.BUYER_IP;
  if (process.env.NODE_ENV === "production") return undefined;
  try {
    return await cached("dev:public-ip", TTL.token, async () => {
      const res = await fetch("https://api.ipify.org", { cache: "no-store" });
      const ip = (await res.text()).trim();
      if (!/^[\d.:a-f]+$/i.test(ip)) throw new Error("bad ip");
      return ip;
    });
  } catch {
    return undefined;
  }
}
