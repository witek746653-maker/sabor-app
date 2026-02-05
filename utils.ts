// src/pages/wineListBuilder/utils.ts
import { CATALOG, TasteTag, WineType, WINE_TYPE_LABEL } from "./catalog";

export type WineItem = {
  id: string;
  name: string;
  country: string;
  region: string;
  grape: string;
  types: WineType[];
  tastes: TasteTag[];
};

export type WineDraft = Omit<WineItem, "id">;

export const emptyDraft = (): WineDraft => ({
  name: "",
  country: "",
  region: "",
  grape: "",
  types: ["white"],
  tastes: [],
});

export function getRegions(country: string): string[] {
  return CATALOG[country]?.regions ?? [];
}

function uniqueOrdered(list: string[]): string[] {
  const set = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    if (!set.has(x)) {
      set.add(x);
      out.push(x);
    }
  }
  return out;
}

export function getGrapes(country: string, types: WineType[]): string[] {
  const c = CATALOG[country];
  if (!c) return [];

  const priority: string[] = [];
  const all: string[] = [];

  for (const t of types) {
    const block = c.grapesByType[t];
    if (!block) continue;
    priority.push(...block.priority);
  }
  for (const t of types) {
    const block = c.grapesByType[t];
    if (!block) continue;
    all.push(...block.all);
  }

  return uniqueOrdered([...priority, ...all]);
}

export function isValidName(name: string): boolean {
  return name.trim().length > 0;
}

export function normalizeDraftForCountryAndTypes(draft: WineDraft): WineDraft {
  const regions = getRegions(draft.country);
  const grapes = getGrapes(draft.country, draft.types);

  const regionOk = draft.region && regions.includes(draft.region);
  const grapeOk = draft.grape && grapes.includes(draft.grape);

  return {
    ...draft,
    region: regionOk ? draft.region : "",
    grape: grapeOk ? draft.grape : "",
  };
}

export function toggleTypeWithRules(current: WineType[], next: WineType): WineType[] {
  const has = current.includes(next);
  let updated = has ? current.filter((t) => t !== next) : [...current, next];

  if (updated.length === 0) updated = ["white"];

  const sparklingSelected = updated.includes("sparkling");
  const max = sparklingSelected ? 2 : 1;

  if (updated.length > max) {
    const rest = updated.filter((t) => t !== next);
    updated = [next, ...rest].slice(0, max);
  }

  if (!updated.includes("sparkling") && updated.length > 1) {
    updated = [updated[0]];
  }

  return updated;
}

export function buildTelegramText(items: WineItem[]): string {
  if (items.length === 0) return "🍷 Вина\n\n(Список пуст)";

  const lines: string[] = [];
  lines.push("🍷 Вина");
  lines.push("");

  items.forEach((w, idx) => {
    const loc = [w.country || "—", w.region || "—"].join(" • ");
    const types = w.types.map((t) => WINE_TYPE_LABEL[t]).join(" + ");
    const meta = [`🏷️ ${types}`];
    if (w.grape) meta.push(`🍇 ${w.grape}`);
    const tastes = w.tastes.length ? `✨ Вкус: ${w.tastes.join(", ")}` : "";

    lines.push(`${idx + 1}. ${w.name}`);
    lines.push(`   🌍 ${loc}`);
    lines.push(`   ${meta.join(" • ")}`);
    if (tastes) lines.push(`   ${tastes}`);
    lines.push("");
  });

  return lines.join("\n").trim();
}

export function makeId(): string {
  return crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
