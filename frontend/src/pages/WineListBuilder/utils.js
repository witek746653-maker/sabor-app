import { CATALOG, WINE_TYPE_LABEL, COUNTRY_FLAGS } from "./catalog";
// utils.js

export const emptyDraft = () => ({
    name: "",
    country: "",
    region: "",
    grapes: [], // Теперь это массив
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
    const availableGrapes = getGrapes(draft.country, draft.types);

    const regionOk = draft.region && regions.includes(draft.region);
    // Теперь мы НЕ фильтруем сорта строго, чтобы оставить пользовательские вводы
    const grapesOk = draft.grapes || [];

    return {
        ...draft,
        region: regionOk ? draft.region : "",
        grapes: grapesOk,
    };
}

export function toggleTypeWithRules(current, next) {
    const has = current.includes(next);
    let updated = has ? current.filter((t) => t !== next) : [...current, next];

    // Всегда должен быть выбран хотя бы один тип
    if (updated.length === 0) updated = ["white"];

    // Правило: Игристое (sparkling) может сочетаться ТОЛЬКО с белым, розовым или шампанским
    const hasSparkling = updated.includes("sparkling");
    const allowedExtras = ["white", "rose", "champagne"];

    if (hasSparkling) {
        // Оставляем только игристое + один разрешенный экстра-тип
        const extras = updated.filter(t => t !== "sparkling" && allowedExtras.includes(t));
        // Если пользователь выбрал что-то запрещенное (например красное) к игристому, 
        // или если выбрано слишком много - оставляем только последнее выбранное
        if (next === "sparkling") {
            // Если включили игристое - ищем старый разрешенный тип или оставляем только игристое
            const oldExtra = current.find(t => allowedExtras.includes(t)) || "white";
            updated = ["sparkling", oldExtra];
        } else if (allowedExtras.includes(next)) {
            // Если включили белый/розовый/шампанское к игристому
            updated = ["sparkling", next];
        } else {
            // Если включили что-то другое (красное и т.д.) - оно вытесняет всё остальное
            updated = [next];
        }
    } else {
        // Если игристого нет - разрешен только один тип (последний выбранный)
        updated = [next];
    }

    return updated;
}

export function buildTelegramText(items) {
    if (items.length === 0) return "Вина\n\n(Список пуст)";

    const lines = [];
    lines.push("Collection de Vins");
    lines.push("");

    items.forEach((w, idx) => {
        const loc = [w.country || "—", w.region || "—"].join(" • ");
        const types = w.types.map((t) => WINE_TYPE_LABEL[t]).join(" + ");
        const meta = [`${types}`];
        if (w.grapes && w.grapes.length) meta.push(`${w.grapes.join(" · ")}`);
        const tastes = w.tastes.length ? `Вкус: ${w.tastes.join(", ")}` : "";

        const quantityStr = w.quantity > 1 ? ` (x${w.quantity})` : "";

        lines.push(`${idx + 1}. ${w.name}${quantityStr}`);
        lines.push(`   ${loc}`);
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
