import { CATALOG, WINE_TYPE_LABEL, COUNTRY_FLAGS } from "./catalog";
// utils.js

export const emptyDraft = () => ({
    name: "",
    country: "",
    region: "",
    grape: "",
    types: ["white"],
    tastes: [],
    quantity: 1,
});

export function getRegions(country) {
    return CATALOG[country]?.regions ?? [];
}

function uniqueOrdered(list) {
    const set = new Set();
    const out = [];
    for (const x of list) {
        if (!set.has(x)) {
            set.add(x);
            out.push(x);
        }
    }
    return out;
}

export function getGrapes(country, types) {
    const c = CATALOG[country];
    if (!c) return [];

    const priority = [];
    const all = [];

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

export function isValidName(name) {
    return name.trim().length > 0;
}

export function normalizeDraftForCountryAndTypes(draft) {
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

export function toggleTypeWithRules(current, next) {
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

export function buildTelegramText(items) {
    if (items.length === 0) return "🍷 Вина\n\n(Список пуст)";

    const lines = [];
    lines.push("🍷 Вина");
    lines.push("");

    items.forEach((w, idx) => {
        const flag = COUNTRY_FLAGS[w.country] || "🌍";
        const loc = [w.country || "—", w.region || "—"].join(" • ");
        const types = w.types.map((t) => WINE_TYPE_LABEL[t]).join(" + ");
        const meta = [`🏷️ ${types}`];
        if (w.grape) meta.push(`🍇 ${w.grape}`);
        const tastes = w.tastes.length ? `✨ Вкус: ${w.tastes.join(", ")}` : "";

        const quantityStr = w.quantity > 1 ? ` (x${w.quantity})` : "";

        lines.push(`${idx + 1}. ${w.name}${quantityStr}`);
        lines.push(`   ${flag} ${loc}`);
        lines.push(`   ${meta.join(" • ")}`);
        if (tastes) lines.push(`   ${tastes}`);
        lines.push("");
    });

    return lines.join("\n").trim();
}

export function makeId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
