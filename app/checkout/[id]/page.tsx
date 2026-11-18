"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApp, customsKey, pickKey } from "@/lib/store";
import { customsForOccasion } from "@/lib/hooks";
import { formatShort } from "@/lib/dates";
import { destinationLabel, destinationOf, fullAddress } from "@/lib/countries";
import { pronounFor } from "@/lib/picks/explain";
import { DEMO_ADDRESS_STREET } from "@/lib/demo/seed";
import { AddressForm, addressLines } from "@/components/AddressForm";
import { AppBar } from "@/components/AppBar";
import { ArrivalBadge, BackLink, formatMoney } from "@/components/ui";
import type { Address, Arrival, Money, ShippingEstimate } from "@/lib/types";

type CheckoutState = {
  id: string;
  status: string;
  currency: string;
  subtotal?: Money;
  shipping?: Money;
  total?: Money;
  selectedOptionId?: string;
  groupId?: string;
  lineItemIds: string[];
  messages: { code?: string; content: string; severity?: string }[];
  continueUrl?: string;
};

const GREETINGS: Record<string, string> = {
  "lunar-new-year": "新年快乐",
  seollal: "새해 복 많이 받으세요",
  diwali: "Happy Diwali",
  "eid-al-fitr": "Eid Mubarak",
  "eid-al-adha": "Eid Mubarak",
  hanukkah: "Happy Hanukkah",
  christmas: "Merry Christmas",
  nowruz: "Nowruz Mobarak",
};

// requires_buyer_input / requires_buyer_review are normal: the buyer finishes on the shop's page.
const HANDOFF = ["recoverable", "requires_buyer_input", "requires_buyer_review"];

export default function Page() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}

function when(o: ShippingEstimate): string {
  if (!o.latest) return o.description ?? "No estimate from the shop";
  if (o.earliest && o.earliest !== o.latest) return `arrives ${formatShort(o.earliest)}–${formatShort(o.latest)}`;
  return `arrives ${formatShort(o.latest)}`;
}

function Checkout() {
  const { ready, state, occasions, today, updatePerson } = useApp();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const occasionId = search.get("occasion") ?? "";
  const asOfParam = search.get("asOf") ?? undefined;
  const person = state.people[params.id];
  const occasion = occasions.find((o) => o.id === occasionId);
  const pick = state.chosen[pickKey(params.id, occasionId)];
  const address = person ? fullAddress(person) : undefined;

  const [email, setEmail] = useState("");
  const [checkout, setCheckout] = useState<CheckoutState>();
  const [arrival, setArrival] = useState<Arrival>();
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [wrap, setWrap] = useState(true);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);

  const asOf = asOfParam ?? (today !== new Date().toISOString().slice(0, 10) ? today : undefined);
  const baseBody =
    person && occasion && pick && address
      ? {
          shopDomain: pick.shop.domain,
          variantId: pick.variantId,
          address,
          currency: person.budget.currency,
          occasionDate: occasion.date,
          occasionTitle: occasion.title,
          asOf,
        }
      : undefined;
  const addressKey = address ? JSON.stringify(address) : "";

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
      setCheckout(b.checkout);
      setArrival(b.arrival);
      return b as { checkout: CheckoutState; arrival: Arrival };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  // (Re)start the checkout whenever the gift or the street address changes.
  useEffect(() => {
    if (!ready || !baseBody) return;
    setCheckout(undefined);
    setArrival(undefined);
    call({ action: "create", ...baseBody }).then((b) => {
      if (!b) return;
      // Default to the cheapest option that arrives on time, which is what the badge promised.
      setSelected(b.arrival.best?.optionId ?? b.checkout.selectedOptionId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pick?.variantId, addressKey]);

  useEffect(() => {
    if (!person || !occasion) return;
    const g = (occasion.holidayId && GREETINGS[occasion.holidayId]) || (occasion.kind === "birthday" ? "Happy birthday" : `Happy ${occasion.title}`);
    setNote((n) => n || `${g}, ${person.name}!`);
  }, [person, occasion]);

  if (!ready) return <main className="screen"><div className="skeleton" style={{ height: 300 }} /></main>;
  if (!person || !occasion || !pick) {
    return (
      <main className="screen">
        <BackLink href="/" />
        <p>
          Choose a gift first. <Link href="/">Back to Coming up</Link>
        </p>
      </main>
    );
  }

  const pr = pronounFor(person.relationship);
  const dest = destinationOf(person);
  const picksHref = `/people/${person.id}/picks?occasion=${encodeURIComponent(occasion.id)}`;
  const rules = customsForOccasion(occasion);
  const savedCustoms = state.customs[customsKey(person.id, occasion)] ?? {};
  const wantsRedGold = rules.some((r) => r.id === "red-gold" && (savedCustoms[r.id] ?? r.defaultOn));
  const options = arrival?.options ?? [];
  const chosenOption = options.find((o) => o.optionId === selected);
  // update_checkout only when something changed: a different shipping option, or an email to add.
  const needsSync = !!checkout && !!selected && (selected !== checkout.selectedOptionId || !!email);
  const blocking = checkout?.messages.filter((m) => m.severity && !HANDOFF.includes(m.severity)) ?? [];
  const showCode = (m?: Money) => !!m && m.currency !== person.budget.currency;

  async function goToShop() {
    if (!checkout || !baseBody) return;
    let url = checkout.continueUrl;
    if (needsSync && checkout.groupId && selected) {
      const b = await call({
        action: "select",
        ...baseBody,
        buyerEmail: email || undefined,
        checkoutId: checkout.id,
        lineItemIds: checkout.lineItemIds,
        groupId: checkout.groupId,
        optionId: selected,
      });
      // If the shop won't take the update, the buyer can still pick shipping on its page.
      url = b?.checkout.continueUrl ?? checkout.continueUrl;
    }
    if (url) window.location.assign(url);
  }

  const subtotal = checkout?.subtotal ?? pick.price;
  const shippingCost = chosenOption?.cost ?? checkout?.shipping;
  const total: Money = { amount: subtotal.amount + (checkout ? shippingCost?.amount ?? 0 : 0), currency: subtotal.currency };

  const productImg = (size: number) =>
    pick.image ? (
      // Shopify CDN image, shown with its listing.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`${pick.image.url}${pick.image.url.includes("?") ? "&" : "?"}width=${size * 2}`} alt={pick.image.alt ?? pick.title} style={{ width: size, height: size, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
    ) : (
      <div className="thumb" style={{ width: size, height: size }} aria-hidden="true" />
    );

  const continueButton = (
    <button type="button" className="btn btn-dark" disabled={!checkout?.continueUrl || busy} onClick={goToShop}>
      {!address
        ? `Add ${pr.possessive} address to continue`
        : busy && checkout
          ? "Updating…"
          : `Continue to ${pick.shop.name} · ${formatMoney(total, { showCode: showCode(total) })} + tax`}
    </button>
  );
  const footnote = (
    <div className="xsmall muted" style={{ textAlign: "center" }}>
      Checkout and delivery dates come from the shop over UCP. You pay on the shop&apos;s own checkout page.
    </div>
  );

  return (
    <>
      <AppBar step={4} />
      <main className="screen" style={{ gap: 16 }}>
        <div className="topbar">
          <BackLink href={picksHref} />
          <div className="display" style={{ fontSize: 22 }}>Send to {person.name}</div>
        </div>

        <div className="card row mobile-only" style={{ padding: 12, gap: 12 }}>
          {productImg(64)}
          <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{pick.title}</div>
            <div className="xsmall muted">{pick.shop.name}</div>
          </div>
          <div style={{ fontWeight: 600 }}>{formatMoney(subtotal, { showCode: showCode(subtotal) })}</div>
        </div>

        <div className="cols">
          <div className="col" style={{ gap: 20 }}>
            <section className="stack" aria-labelledby="ship-h">
              <div id="ship-h" className="label">Ship to</div>
              {address && !editingAddress ? (
                <div className="card row small" style={{ alignItems: "flex-start", padding: "12px 14px" }}>
                  <div className="stack" style={{ gap: 2, flex: 1 }}>
                    {addressLines(address).map((l, i) => (
                      <span key={i} style={i === 0 ? { fontWeight: 600 } : { color: "var(--muted)" }}>
                        {l}
                      </span>
                    ))}
                  </div>
                  <button type="button" className="link-btn" onClick={() => setEditingAddress(true)}>
                    Edit
                  </button>
                </div>
              ) : (
                <div className="card stack-lg">
                  {!address && (
                    <div className="small">
                      The shop needs {pr.possessive} street address to quote delivery dates
                      {dest ? <> to <strong>{destinationLabel(dest)}</strong></> : null}.
                    </div>
                  )}
                  <AddressForm
                    initial={address ?? person.address ?? (dest ? ({ country: dest.country, region: dest.region } as Address) : undefined)}
                    possessive={pr.possessive}
                    wide
                    onSave={(a) => {
                      updatePerson(person.id, { address: a, shipTo: { country: a.country, region: a.region } });
                      setEditingAddress(false);
                    }}
                    onCancel={address ? () => setEditingAddress(false) : undefined}
                  />
                </div>
              )}
              {address?.street === DEMO_ADDRESS_STREET && !editingAddress && (
                <div className="warn xsmall">Demo address (Markham Civic Centre). Replace it with {pr.possessive} real address before you buy.</div>
              )}
            </section>

            {address && (
              <section className="stack" aria-labelledby="arrive-h">
                <div id="arrive-h" className="label">Arrives before {formatShort(occasion.date)}?</div>
                {busy && !checkout && [0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 52 }} />)}
                {error && (
                  <div className="warn" role="alert">
                    {error}
                  </div>
                )}
                {checkout && options.length === 0 && (
                  <div className="card small muted">The shop didn&apos;t share shipping options for this address. You&apos;ll see them on its checkout page.</div>
                )}
                {options.map((o) => (
                  <label key={o.optionId} className="radio-card">
                    <input type="radio" name="ship" checked={selected === o.optionId} onChange={() => setSelected(o.optionId)} />
                    <span className="stack" style={{ gap: 2, flex: 1 }}>
                      <span>{o.title}</span>
                      <span className="xsmall muted">
                        {when(o)}
                        {o.cost ? ` · ${o.cost.amount === 0 ? "free" : formatMoney(o.cost, { showCode: showCode(o.cost) })}` : ""}
                      </span>
                    </span>
                    <ArrivalBadge status={o.status} />
                  </label>
                ))}
                {arrival && options.length > 0 && (
                  <div className="xsmall muted">
                    Needs to arrive by {formatShort(arrival.deadline)}. Dates add 2 business days for the shop to pack; times are the shop&apos;s own estimates.
                  </div>
                )}
              </section>
            )}

            <section className="stack" aria-labelledby="gift-h">
              <div id="gift-h" className="label">Make it a gift</div>
              {wantsRedGold && (
                <label className="check">
                  <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
                  <span>
                    Remind me to ask for red or gold gift wrap
                    <span className="why">From your customs list. Shops offer wrap on their own checkout page, if at all.</span>
                  </span>
                </label>
              )}
              <label className="field">
                Gift note
                <textarea className="input" style={{ height: 64, resize: "none" }} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className="row xsmall muted" style={{ justifyContent: "space-between" }}>
                <span>Paste it into the shop&apos;s gift message box.</span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(note);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      /* clipboard blocked */
                    }
                  }}
                >
                  {copied ? "Copied" : "Copy note"}
                </button>
              </div>
              <label className="field">
                Your email (for the receipt, optional here)
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="The shop will ask if you leave this blank" />
              </label>
            </section>

            {blocking.length > 0 && (
              <div className="warn">
                {blocking.map((m, i) => (
                  <div key={i}>{m.content}</div>
                ))}
              </div>
            )}

            <div className="stack mobile-only" style={{ marginTop: "auto" }}>
              {continueButton}
              {footnote}
            </div>
          </div>

          <aside className="col aside desktop-only" style={{ flexDirection: "column" }} aria-label="Order summary">
            <div className="card stack-lg" style={{ padding: 20 }}>
              <div className="label">Order summary</div>
              <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                {productImg(88)}
                <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{pick.title}</div>
                  <div className="small muted">{pick.shop.name}</div>
                  <div className="xsmall" style={{ lineHeight: 1.35 }}>
                    <span style={{ fontWeight: 600, color: "var(--accent)" }}>Why: </span>
                    {pick.why}
                  </div>
                </div>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <div className="summary-row">
                  <span className="muted">Gift</span>
                  <span>{formatMoney(subtotal, { showCode: showCode(subtotal) })}</span>
                </div>
                <div className="summary-row">
                  <span className="muted">Shipping{chosenOption ? ` · ${chosenOption.title}` : ""}</span>
                  <span>{checkout && shippingCost ? (shippingCost.amount === 0 ? "Free" : formatMoney(shippingCost, { showCode: showCode(shippingCost) })) : "—"}</span>
                </div>
                <div className="summary-row">
                  <span className="muted">Tax</span>
                  <span className="muted">At the shop</span>
                </div>
                <div className="summary-row total">
                  <span>Total</span>
                  <span>{formatMoney(total, { showCode: showCode(total) })}</span>
                </div>
              </div>
              {chosenOption && (
                <div className="row small" style={{ gap: 8 }}>
                  <ArrivalBadge status={chosenOption.status} />
                  <span className="muted">
                    {when(chosenOption)} · needed by {formatShort(arrival!.deadline)}
                  </span>
                </div>
              )}
              {continueButton}
              {footnote}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
