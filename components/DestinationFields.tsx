"use client";

import { COUNTRIES, COUNTRY_BY_CODE } from "@/lib/countries";
import type { Destination } from "@/lib/types";

/** Country + province/state: the only location input the picks need. */
export function DestinationFields({ value, onChange }: { value?: Destination; onChange: (d: Destination) => void }) {
  const country = value?.country ?? "";
  const rule = country ? COUNTRY_BY_CODE[country] : undefined;
  return (
    <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
      <label className="field" style={{ flex: "1 1 160px" }}>
        Country or region
        <select className="input" value={country} onChange={(e) => onChange({ country: e.target.value })}>
          <option value="" disabled>
            Choose…
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {rule?.region === "select" && (
        <label className="field" style={{ flex: "1 1 160px" }}>
          {rule.regionLabel}
          <select className="input" value={value?.region ?? ""} onChange={(e) => onChange({ country, region: e.target.value })}>
            <option value="" disabled>
              Choose…
            </option>
            {rule.regions!.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {rule?.region === "text" && (
        <label className="field" style={{ flex: "1 1 160px" }}>
          {rule.regionLabel} (optional)
          <input className="input" value={value?.region ?? ""} onChange={(e) => onChange({ country, region: e.target.value || undefined })} />
        </label>
      )}
    </div>
  );
}
