"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useApp } from "./store";
import type { Occasion, Person } from "./types";
import { HOLIDAY_BY_ID } from "./occasions/holidays";
import { customsFor } from "./occasions/customs";

/** Resolves the person (from the route) and the occasion (from ?occasion=). */
export function usePersonOccasion(): { person?: Person; occasion?: Occasion; occasionParam: string } {
  const { state, occasions } = useApp();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const occasionParam = search.get("occasion") ?? "";
  const person = params?.id ? state.people[params.id] : undefined;
  const occasion =
    occasions.find((o) => o.id === occasionParam) ??
    occasions.find((o) => person && o.personIds.includes(person.id));
  return { person, occasion, occasionParam };
}

export function customsForOccasion(o?: Occasion) {
  if (!o || o.kind === "birthday" || !o.holidayId) return [];
  return customsFor(HOLIDAY_BY_ID[o.holidayId]?.customs ?? []);
}
