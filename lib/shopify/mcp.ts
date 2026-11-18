// Server-only client for Shopify's UCP MCP endpoints (JSON-RPC 2.0 over HTTP).
//   Global Catalog: https://catalog.shopify.com/api/ucp/mcp      (Bearer token)
//   Checkout:       https://{shop-domain}/api/ucp/mcp            (Bearer token + Shopify-Buyer-IP)

import "server-only";
import { cached, forget, TTL } from "../cache";

export const CATALOG_ENDPOINT = "https://catalog.shopify.com/api/ucp/mcp";

// The agent profile Shopify hosts for its examples. A production agent hosts its own at
// /.well-known/ucp on a public domain; set UCP_AGENT_PROFILE once that exists.
export const AGENT_PROFILE =
  process.env.UCP_AGENT_PROFILE ??
  "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";

export class ShopifyError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
  }
}

export function hasCredentials(): boolean {
  return !!(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);
}

export async function accessToken(): Promise<string> {
  if (!hasCredentials()) throw new ShopifyError("Missing SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET", 401, "no_credentials");
  return cached("shopify:token", TTL.token, async () => {
    const res = await fetch("https://api.shopify.com/auth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new ShopifyError(`Shopify auth failed (${res.status})`, res.status, "auth_failed");
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) throw new ShopifyError("Shopify auth returned no token", 500, "auth_failed");
    return body.access_token;
  });
}

type CallOptions = { buyerIp?: string; retries?: number; idempotencyKey?: string };

let rpcId = 0;

export async function callTool<T = Record<string, unknown>>(
  endpoint: string,
  tool: string,
  args: Record<string, unknown>,
  opts: CallOptions = {},
): Promise<T> {
  const token = await accessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (opts.buyerIp) headers["Shopify-Buyer-IP"] = opts.buyerIp;

  const meta: Record<string, unknown> = { "ucp-agent": { profile: AGENT_PROFILE } };
  if (opts.idempotencyKey) meta["idempotency-key"] = opts.idempotencyKey;

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: ++rpcId,
    method: "tools/call",
    params: { name: tool, arguments: { meta, ...args } },
  });

  const res = await fetch(endpoint, { method: "POST", headers, body, cache: "no-store" });

  if (res.status === 401) forget("shopify:token");
  if (res.status === 429 && (opts.retries ?? 1) > 0) {
    const wait = Math.min(Number(res.headers.get("Retry-After") ?? 1), 5) * 1000;
    await new Promise((r) => setTimeout(r, wait + Math.random() * 250));
    return callTool<T>(endpoint, tool, args, { ...opts, retries: (opts.retries ?? 1) - 1 });
  }

  const text = await res.text();
  let json: { result?: { structuredContent?: T; isError?: boolean; content?: { text?: string }[] }; error?: { message?: string; data?: unknown } };
  try {
    json = JSON.parse(text);
  } catch {
    throw new ShopifyError(`${tool}: HTTP ${res.status}`, res.status);
  }
  if (json.error) {
    const detail = typeof json.error.data === "string" ? `: ${json.error.data}` : "";
    throw new ShopifyError(`${tool}: ${json.error.message ?? "error"}${detail}`, res.status, json.error.message);
  }
  if (!res.ok) throw new ShopifyError(`${tool}: HTTP ${res.status}`, res.status);
  const sc = json.result?.structuredContent;
  if (!sc) {
    const msg = json.result?.content?.[0]?.text ?? "empty result";
    throw new ShopifyError(`${tool}: ${msg.slice(0, 200)}`, res.status);
  }
  return sc;
}
