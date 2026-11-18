// Step 0 probe: confirms auth + Global Catalog search work with the keys in .env.local.
// Run: node --env-file=.env.local scripts/probe-catalog.mjs "oolong tea gift"
// Never prints the token. Output is written to stdout only — nothing is saved.

const PROFILE =
  process.env.UCP_AGENT_PROFILE ??
  "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";

async function token() {
  const res = await fetch("https://api.shopify.com/auth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`auth ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).access_token;
}

async function rpc(tok, method, params) {
  const res = await fetch("https://catalog.shopify.com/api/ucp/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const query = process.argv[2] ?? "oolong tea gift";
const tok = await token();
console.log("auth: ok");

if (process.argv.includes("--tools")) {
  const tools = await rpc(tok, "tools/list", {});
  for (const t of tools.result.tools) console.log("tool:", t.name);
}

const out = await rpc(tok, "tools/call", {
  name: "search_catalog",
  arguments: {
    meta: { "ucp-agent": { profile: PROFILE } },
    catalog: {
      query,
      filters: {
        ships_to: { country: "CA", region: "ON" },
        price: { min: 5000, max: 8000 },
        available: true,
      },
      context: { address_country: "CA", address_region: "ON", currency: "CAD", language: "en-CA" },
      pagination: { limit: 5 },
    },
  },
});

const sc = out.result?.structuredContent ?? out.result;
if (process.argv.includes("--raw")) {
  console.log(JSON.stringify(sc, null, 2).slice(0, 6000));
} else {
  console.log("messages:", JSON.stringify(sc.messages ?? []));
  console.log("total:", sc.pagination?.total_count);
  for (const p of sc.products ?? []) {
    const v = p.variants?.[0] ?? {};
    console.log("\n-", p.title);
    console.log("  price:", JSON.stringify(p.price_range?.min), "| seller:", v.seller?.name, v.seller?.domain);
    console.log("  options:", (p.options ?? []).map((o) => `${o.name}=${o.values?.map((x) => x.label).join("/")}`).join("; "));
    console.log("  variant keys:", Object.keys(v).join(","));
    console.log("  fulfillment:", JSON.stringify(v.fulfillment ?? null).slice(0, 300));
    console.log("  media:", p.media?.length, "| rating:", JSON.stringify(p.rating ?? null));
  }
}
