"use client";

import { useState } from "react";
import { COUNTRIES, COUNTRY_BY_CODE, countryName, validateAddress } from "@/lib/countries";
import type { Address } from "@/lib/types";

export function addressLines(a: Address): string[] {
  const rule = COUNTRY_BY_CODE[a.country];
  const cityLine = [a.locality, rule?.region !== "none" ? a.region : undefined, a.postalCode].filter(Boolean).join(" ");
  return [`${a.firstName} ${a.lastName}`.trim(), [a.street, a.extended].filter(Boolean).join(", "), cityLine, countryName(a.country)].filter(Boolean);
}

export function AddressForm({
  initial,
  onSave,
  onCancel,
  possessive = "their",
  wide = false,
}: {
  initial?: Address;
  onSave: (a: Address) => void;
  onCancel?: () => void;
  possessive?: string;
  /** Two-column layout on desktop (for wide containers). */
  wide?: boolean;
}) {
  const [a, setA] = useState<Partial<Address>>(initial ?? { country: "CA" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const rule = a.country ? COUNTRY_BY_CODE[a.country] : undefined;
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setA((x) => ({ ...x, [k]: e.target.value }));

  function field(k: keyof Address, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, span2 = false) {
    return (
      <label className={`field${span2 ? " span-2" : ""}`}>
        {label}
        <input className="input" value={(a[k] as string) ?? ""} onChange={set(k)} aria-invalid={!!errors[k]} {...props} />
        {errors[k] && <span className="error">{errors[k]}</span>}
      </label>
    );
  }

  return (
    <form
      className={`stack-lg addr-form${wide ? " wide" : ""}`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const errs = validateAddress(a);
        setErrors(errs);
        if (Object.keys(errs).length) return;
        const clean: Address = {
          firstName: a.firstName!.trim(),
          lastName: a.lastName!.trim(),
          phone: a.phone!.trim(),
          country: a.country!,
          street: a.street!.trim(),
          extended: a.extended?.trim() || undefined,
          locality: a.locality!.trim(),
          region: rule?.region === "none" ? undefined : a.region?.trim() || undefined,
          postalCode: rule?.postal === "none" ? undefined : a.postalCode?.trim() || undefined,
        };
        onSave(clean);
      }}
    >
      <label className="field span-2">
        Country or region
        <select className="input" value={a.country ?? ""} onChange={(e) => setA((x) => ({ ...x, country: e.target.value, region: undefined }))}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row span-2" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>{field("firstName", "First name", { autoComplete: "off" })}</div>
        <div style={{ flex: 1 }}>{field("lastName", "Last name", { autoComplete: "off" })}</div>
      </div>
      {field("street", "Street address", { autoComplete: "off" }, true)}
      {field("extended", "Apartment, unit, c/o (optional)", { autoComplete: "off" })}
      {field("locality", "City or town", { autoComplete: "off" })}
      {rule?.region === "select" && (
        <label className="field">
          {rule.regionLabel}
          <select className="input" value={a.region ?? ""} onChange={set("region")} aria-invalid={!!errors.region}>
            <option value="" disabled>
              Choose…
            </option>
            {rule.regions!.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          {errors.region && <span className="error">{errors.region}</span>}
        </label>
      )}
      {rule?.region === "text" && field("region", `${rule.regionLabel ?? "Region"} (optional)`)}
      {rule?.postal !== "none" &&
        field("postalCode", `${rule?.postalLabel ?? "Postal code"}${rule?.postal === "optional" ? " (optional)" : ""}`, { autoComplete: "off" })}
      {rule?.postal === "none" && <p className="xsmall muted span-2" style={{ margin: 0 }}>{rule.name} doesn&apos;t use postal codes, so we won&apos;t ask.</p>}
      {field("phone", `${possessive.charAt(0).toUpperCase()}${possessive.slice(1)} phone number`, { type: "tel", autoComplete: "off", placeholder: "Carriers use this for delivery" })}
      <div className="row span-2">
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel} style={{ minHeight: 44, flex: 1, fontSize: 14 }}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn" style={{ minHeight: 44, padding: 10, fontSize: 14, flex: 2 }}>
          Save address
        </button>
      </div>
    </form>
  );
}
