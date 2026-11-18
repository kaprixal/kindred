"use client";

import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import { useApp, customsKey } from "@/lib/store";
import { customsForOccasion, usePersonOccasion } from "@/lib/hooks";
import { formatShort } from "@/lib/dates";
import { pronounFor } from "@/lib/picks/explain";
import { resizePhoto } from "@/lib/photos";
import { destinationOf, destinationOk, fullAddress } from "@/lib/countries";
import { DestinationFields } from "@/components/DestinationFields";
import { DEMO_ADDRESS_STREET } from "@/lib/demo/seed";
import { AddressForm, addressLines } from "@/components/AddressForm";
import { BackLink, Icon } from "@/components/ui";
import { AppBar } from "@/components/AppBar";
import type { Address, Person } from "@/lib/types";

export default function Page() {
  return (
    <Suspense>
      <WhoItsFor />
    </Suspense>
  );
}

function WhoItsFor() {
  const { ready, state, update, updatePerson } = useApp();
  const { person, occasion } = usePersonOccasion();
  const [newInterest, setNewInterest] = useState("");
  const [addingInterest, setAddingInterest] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [pending, setPending] = useState<{ dataUrl: string; caption: string }>();
  const [photoError, setPhotoError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) return <main className="screen"><div className="skeleton" style={{ height: 300 }} /></main>;
  if (!person) {
    return (
      <main className="screen">
        <BackLink href="/" />
        <p>We couldn&apos;t find that person. <Link href="/">Back to Coming up</Link></p>
      </main>
    );
  }

  const p: Person = person;
  const pr = pronounFor(p.relationship);
  const subjectIs = pr.subject === "they" ? "they're" : `${pr.subject}'s`;
  const rules = customsForOccasion(occasion);
  const key = occasion ? customsKey(p.id, occasion) : "";
  const saved = state.customs[key] ?? {};
  const isOn = (id: string, def: boolean) => saved[id] ?? def;
  const dest = destinationOf(p);
  const destOk = destinationOk(dest);
  const full = fullAddress(p);
  const hasSignals = p.interests.length > 0 || p.photos.length > 0;
  const budget = `$${p.budget.min}–${p.budget.max}`;
  const sub = [p.relationship, p.city, budget].filter(Boolean).join(" · ");

  function addInterest() {
    const v = newInterest.trim();
    if (v && !p.interests.some((i) => i.toLowerCase() === v.toLowerCase())) updatePerson(p.id, { interests: [...p.interests, v] });
    setNewInterest("");
    setAddingInterest(false);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPhotoError(undefined);
    try {
      setPending({ dataUrl: await resizePhoto(f), caption: "" });
    } catch {
      setPhotoError("Couldn't read that image. Try a JPEG or PNG.");
    }
  }

  const occasionLine = occasion ? `${occasion.kind === "birthday" ? "Birthday" : occasion.title} · ${formatShort(occasion.date)}` : "No occasion picked";
  const picksHref = `/people/${p.id}/picks?occasion=${encodeURIComponent(occasion?.id ?? "")}`;

  return (
    <>
    <AppBar step={2} />
    <main className="screen">
      <div className="topbar">
        <BackLink href="/" />
        <div className="small muted">{occasionLine}</div>
      </div>

      <div className="row" style={{ gap: 14 }}>
        <div className="avatar" aria-hidden="true">{p.name.charAt(0)}</div>
        <div className="stack" style={{ gap: 2, flex: 1 }}>
          <h1 style={{ fontSize: 26 }}>{p.name}</h1>
          <div className="small muted">{sub}</div>
        </div>
        <button type="button" className="link-btn" onClick={() => setEditingDetails((v) => !v)} aria-expanded={editingDetails}>
          Edit
        </button>
      </div>

      {editingDetails && (
        <div className="card stack-lg">
          <label className="field">
            Relationship
            <input className="input" value={p.relationship ?? ""} onChange={(e) => updatePerson(p.id, { relationship: e.target.value })} placeholder="e.g. Grandmother" />
          </label>
          <label className="field">
            City (for your reference)
            <input className="input" value={p.city ?? ""} onChange={(e) => updatePerson(p.id, { city: e.target.value })} />
          </label>
          <div className="row">
            <label className="field" style={{ flex: 1 }}>
              Budget from ({p.budget.currency})
              <input className="input" type="number" min={0} value={p.budget.min} onChange={(e) => updatePerson(p.id, { budget: { ...p.budget, min: Number(e.target.value) } })} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              to
              <input className="input" type="number" min={0} value={p.budget.max} onChange={(e) => updatePerson(p.id, { budget: { ...p.budget, max: Number(e.target.value) } })} />
            </label>
          </div>
          <p className="xsmall muted" style={{ margin: 0 }}>Pronouns in the app follow the relationship (grandmother → she). Anything else uses they.</p>
        </div>
      )}

      <div className="cols">
      <div className="col">
      <section className="stack" aria-labelledby="into-h">
        <div id="into-h" className="label">What {subjectIs} into</div>
        <div className="wrap">
          {p.interests.map((i) => (
            <span key={i} className="tag">
              {i}
              <button type="button" aria-label={`Remove ${i}`} onClick={() => updatePerson(p.id, { interests: p.interests.filter((x) => x !== i) })}>
                <Icon name="x" size={14} />
              </button>
            </span>
          ))}
          {addingInterest ? (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                addInterest();
              }}
            >
              <label className="sr-only" htmlFor="new-interest">New interest</label>
              <input id="new-interest" autoFocus className="input" style={{ minHeight: 36, width: 160 }} value={newInterest} onChange={(e) => setNewInterest(e.target.value)} placeholder="e.g. Mahjong" onBlur={addInterest} />
            </form>
          ) : (
            <button type="button" className="chip chip-dashed" onClick={() => setAddingInterest(true)}>
              + Add
            </button>
          )}
        </div>
      </section>

      <section className="stack" aria-labelledby="photos-h">
        <div id="photos-h" className="label">Photos of things {pr.subject} {pr.subject === "they" ? "love" : "loves"}</div>
        <div className="photo-grid">
          {p.photos.map((ph) => (
            <div key={ph.id} className="photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.dataUrl} alt={ph.caption} />
              <div className="cap">{ph.caption}</div>
              <button type="button" className="rm" aria-label={`Remove photo: ${ph.caption}`} onClick={() => updatePerson(p.id, { photos: p.photos.filter((x) => x.id !== ph.id) })}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          {p.photos.length < 3 && !pending && (
            <button type="button" className="photo-add" onClick={() => fileRef.current?.click()}>
              + Add
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onPhoto} aria-label="Add a photo" />
        {pending && (
          <form
            className="card row"
            style={{ gap: 12, alignItems: "flex-end" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!pending.caption.trim()) return;
              updatePerson(p.id, { photos: [...p.photos, { id: `ph${Date.now()}`, caption: pending.caption.trim(), dataUrl: pending.dataUrl }] });
              setPending(undefined);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.dataUrl} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10 }} />
            <label className="field" style={{ flex: 1 }}>
              What is it?
              <input className="input" autoFocus value={pending.caption} onChange={(e) => setPending({ ...pending, caption: e.target.value })} placeholder={`e.g. ${pr.possessive} blue-and-white teapot`} />
            </label>
            <button type="submit" className="btn-sm" style={{ minHeight: 44 }} disabled={!pending.caption.trim()}>
              Save
            </button>
          </form>
        )}
        {photoError && <span className="error">{photoError}</span>}
        <div className="xsmall muted">We search Shopify for products that look like these. Photos stay in this browser except during that search.</div>
      </section>

      {occasion && (
        <section className="card stack-lg" aria-labelledby="customs-h">
          <div className="stack" style={{ gap: 3 }}>
            <div id="customs-h" style={{ fontWeight: 600, fontSize: 15 }}>
              {rules.length ? `Gift customs for ${occasion.title}` : "Anything to avoid?"}
            </div>
            {rules.length > 0 && <div className="xsmall muted">Keep the ones that apply to your family.</div>}
          </div>
          {rules.map((r) => (
            <label key={r.id} className="check">
              <input
                type="checkbox"
                checked={isOn(r.id, r.defaultOn)}
                onChange={(e) => update((s) => ({ ...s, customs: { ...s.customs, [key]: { ...(s.customs[key] ?? {}), [r.id]: e.target.checked } } }))}
              />
              <span>
                {r.label}
                {r.reason && <span className="why">{r.reason}</span>}
              </span>
            </label>
          ))}
          <label className="field">
            {rules.length ? "Anything else to avoid?" : "Separate with commas"}
            <input className="input" value={p.avoidText ?? ""} onChange={(e) => updatePerson(p.id, { avoidText: e.target.value })} placeholder={`e.g. ${pr.subject} ${pr.subject === "they" ? "don't" : "doesn't"} drink, no wool`} />
          </label>
        </section>
      )}
      </div>

      <aside className="col aside">
      <section className="stack" aria-labelledby="addr-h" id="address">
        <div id="addr-h" className="label">Where it&apos;s going</div>
        <div className="card stack-lg">
          <DestinationFields
            value={dest}
            onChange={(d) => {
              // A saved street address in another country/province no longer applies.
              const stale = p.address && (p.address.country !== d.country || (d.region && p.address.region !== d.region));
              updatePerson(p.id, { shipTo: d, ...(stale ? { address: undefined } : {}) });
            }}
          />
          <div className="xsmall muted">We only show shops that ship here.</div>

          {full && !editingAddress && (
            <div className="row" style={{ alignItems: "flex-start", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div className="stack small" style={{ gap: 2, flex: 1, lineHeight: 1.4 }}>
                <span className="xsmall muted">Full address · for exact delivery dates</span>
                {addressLines(full).slice(0, 3).map((l, i) => (
                  <span key={i} style={i === 0 ? { fontWeight: 600 } : { color: "var(--muted)" }}>
                    {l}
                  </span>
                ))}
              </div>
              <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
                <button type="button" className="link-btn" onClick={() => setEditingAddress(true)}>
                  Edit
                </button>
                <button type="button" className="link-btn" style={{ color: "var(--muted)", fontWeight: 500 }} onClick={() => updatePerson(p.id, { address: undefined })}>
                  Remove
                </button>
              </div>
            </div>
          )}
          {editingAddress && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <AddressForm
                initial={full ?? (dest ? { country: dest.country, region: dest.region } as Address : undefined)}
                possessive={pr.possessive}
                onSave={(a) => {
                  updatePerson(p.id, { address: a, shipTo: { country: a.country, region: a.region } });
                  setEditingAddress(false);
                }}
                onCancel={() => setEditingAddress(false)}
              />
            </div>
          )}
          {!full && !editingAddress && destOk && (
            <button type="button" className="link-btn" style={{ alignSelf: "flex-start", textAlign: "left" }} onClick={() => setEditingAddress(true)}>
              + Add {pr.possessive} street address for exact delivery dates (optional)
            </button>
          )}
        </div>
        {full?.street === DEMO_ADDRESS_STREET && !editingAddress && (
          <div className="warn xsmall">Demo address (Markham Civic Centre). Replace it with {pr.possessive} real address before you buy.</div>
        )}
        {!full && destOk && <div className="xsmall muted">Without it, you&apos;ll see delivery dates at checkout instead.</div>}
      </section>

      <div className="stack" style={{ marginTop: "auto" }}>
        {!hasSignals && <div className="xsmall muted" style={{ textAlign: "center" }}>Add an interest or a photo so we know what to look for.</div>}
        {hasSignals && !destOk && <div className="xsmall muted" style={{ textAlign: "center" }}>Choose where it&apos;s going so we only show shops that ship there.</div>}
        {hasSignals && destOk && occasion ? (
          <Link href={picksHref} className="btn">
            Find gifts for {p.name}
          </Link>
        ) : (
          <button type="button" className="btn" disabled>
            Find gifts for {p.name}
          </button>
        )}
      </div>
      </aside>
      </div>
    </main>
    </>
  );
}
