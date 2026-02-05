// src/pages/WineListBuilderPage.tsx
import React, { useMemo, useRef, useState } from "react";
import { COUNTRIES, TASTE_TAGS, TasteTag, WINE_TYPE_LABEL, WineType } from "./wineListBuilder/catalog";
import {
  WineDraft,
  WineItem,
  buildTelegramText,
  emptyDraft,
  getGrapes,
  getRegions,
  isValidName,
  makeId,
  normalizeDraftForCountryAndTypes,
  toggleTypeWithRules,
} from "./wineListBuilder/utils";

import { toPng } from "html-to-image";

type EditState =
  | { open: false }
  | { open: true; id: string; draft: WineDraft };

export default function WineListBuilderPage() {
  const [items, setItems] = useState<WineItem[]>([]);
  const [draft, setDraft] = useState<WineDraft>(() => emptyDraft());
  const [nameError, setNameError] = useState<string>("");

  const [telegramText, setTelegramText] = useState<string>("");

  const [edit, setEdit] = useState<EditState>({ open: false });

  const previewRef = useRef<HTMLDivElement | null>(null);
  const [pngDataUrl, setPngDataUrl] = useState<string>("");
  const [busy, setBusy] = useState<{ png: boolean; copy: boolean }>({ png: false, copy: false });

  const regions = useMemo(() => getRegions(draft.country), [draft.country]);
  const grapes = useMemo(() => getGrapes(draft.country, draft.types), [draft.country, draft.types]);

  function updateDraft(patch: Partial<WineDraft>) {
    setDraft((prev) => {
      let next = { ...prev, ...patch };
      if (patch.country !== undefined || patch.types !== undefined) {
        next = normalizeDraftForCountryAndTypes(next);
      }
      return next;
    });

    if (patch.name !== undefined) {
      setNameError(isValidName(patch.name) ? "" : "Введите название вина");
    }
  }

  function toggleTaste(tag: TasteTag) {
    setDraft((prev) => {
      const exists = prev.tastes.includes(tag);
      const tastes = exists ? prev.tastes.filter((t) => t !== tag) : [...prev.tastes, tag];
      return { ...prev, tastes };
    });
  }

  function toggleType(nextType: WineType) {
    setDraft((prev) => {
      const types = toggleTypeWithRules(prev.types, nextType);
      return normalizeDraftForCountryAndTypes({ ...prev, types });
    });
  }

  function clearForm() {
    setDraft(emptyDraft());
    setNameError("");
  }

  function addToList() {
    if (!isValidName(draft.name)) {
      setNameError("Введите название вина");
      return;
    }
    const item: WineItem = { id: makeId(), ...draft, name: draft.name.trim() };
    setItems((prev) => [...prev, item]);
    clearForm();
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  function requestClearList() {
    const ok = window.confirm("Очистить весь список?");
    if (!ok) return;
    setItems([]);
    setTelegramText("");
    setPngDataUrl("");
  }

  function openEdit(id: string) {
    const current = items.find((x) => x.id === id);
    if (!current) return;
    const { id: _id, ...d } = current;
    setEdit({ open: true, id, draft: d });
  }

  function closeEdit() {
    setEdit({ open: false });
  }

  function updateEditDraft(patch: Partial<WineDraft>) {
    setEdit((prev) => {
      if (!prev.open) return prev;
      let nextDraft = { ...prev.draft, ...patch };
      if (patch.country !== undefined || patch.types !== undefined) {
        nextDraft = normalizeDraftForCountryAndTypes(nextDraft);
      }
      return { ...prev, draft: nextDraft };
    });
  }

  function toggleEditTaste(tag: TasteTag) {
    setEdit((prev) => {
      if (!prev.open) return prev;
      const exists = prev.draft.tastes.includes(tag);
      const tastes = exists ? prev.draft.tastes.filter((t) => t !== tag) : [...prev.draft.tastes, tag];
      return { ...prev, draft: { ...prev.draft, tastes } };
    });
  }

  function toggleEditType(nextType: WineType) {
    setEdit((prev) => {
      if (!prev.open) return prev;
      const types = toggleTypeWithRules(prev.draft.types, nextType);
      const nextDraft = normalizeDraftForCountryAndTypes({ ...prev.draft, types });
      return { ...prev, draft: nextDraft };
    });
  }

  function saveEdit() {
    if (!edit.open) return;
    if (!isValidName(edit.draft.name)) {
      alert("Введите название вина");
      return;
    }
    setItems((prev) =>
      prev.map((x) => (x.id === edit.id ? { id: x.id, ...edit.draft, name: edit.draft.name.trim() } : x))
    );
    closeEdit();
  }

  function generateTelegramText() {
    setTelegramText(buildTelegramText(items));
  }

  async function copyTelegramText() {
    setBusy((b) => ({ ...b, copy: true }));
    try {
      const text = telegramText || buildTelegramText(items);
      setTelegramText(text);
      await navigator.clipboard.writeText(text);
    } finally {
      setBusy((b) => ({ ...b, copy: false }));
    }
  }

  function telegramShare() {
    const text = telegramText || buildTelegramText(items);
    const url = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function buildPngFromPreview() {
    if (!previewRef.current) return;
    setBusy((b) => ({ ...b, png: true }));
    try {
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 2 });
      setPngDataUrl(dataUrl);
    } finally {
      setBusy((b) => ({ ...b, png: false }));
    }
  }

  async function sharePngOrDownload() {
    if (!pngDataUrl) await buildPngFromPreview();
    const dataUrl = pngDataUrl || "";
    if (!dataUrl) return;

    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "wine-list.png", { type: "image/png" });
      // @ts-expect-error
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // @ts-expect-error
        await navigator.share({ files: [file], title: "Wine List" });
        return;
      }
    } catch {
      // ignore
    }

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "wine-list.png";
    a.click();
  }

  const canAdd = isValidName(draft.name);

  return (
    <div>
      <h1>Генератор списка вин</h1>

      <section aria-label="Форма добавления вина">
        <div>
          <label>
            Название вина*:
            <input value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })} />
          </label>
          {nameError ? <div role="alert">{nameError}</div> : null}
        </div>

        <div>
          <label>
            Страна:
            <input list="countries" value={draft.country} onChange={(e) => updateDraft({ country: e.target.value })} />
            <datalist id="countries">
              {COUNTRIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
        </div>

        <div>
          <div>Тип вина:</div>
          <div>
            {(Object.keys(WINE_TYPE_LABEL) as WineType[]).map((t) => (
              <button key={t} type="button" aria-pressed={draft.types.includes(t)} onClick={() => toggleType(t)}>
                {WINE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <div>Выбрано: {draft.types.map((t) => WINE_TYPE_LABEL[t]).join(" + ")}</div>
        </div>

        <div>
          <div>Вкус:</div>
          <div>
            {TASTE_TAGS.map((tag) => (
              <button key={tag} type="button" aria-pressed={draft.tastes.includes(tag)} onClick={() => toggleTaste(tag)}>
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label>
            Сорт 🍇:
            <input
              list="grapes"
              value={draft.grape}
              onChange={(e) => updateDraft({ grape: e.target.value })}
              disabled={!draft.country}
            />
            <datalist id="grapes">
              {grapes.map((g) => <option key={g} value={g} />)}
            </datalist>
          </label>
        </div>

        <div>
          <label>
            Регион 📍:
            <input
              list="regions"
              value={draft.region}
              onChange={(e) => updateDraft({ region: e.target.value })}
              disabled={!draft.country}
            />
            <datalist id="regions">
              {regions.map((r) => <option key={r} value={r} />)}
            </datalist>
          </label>
        </div>

        <div>
          <button type="button" onClick={addToList} disabled={!canAdd}>Добавить в список</button>
          <button type="button" onClick={clearForm}>Очистить форму</button>
        </div>
      </section>

      <hr />

      <section aria-label="Список">
        <div>
          <h2>Список</h2>
          <button type="button" onClick={requestClearList} disabled={items.length === 0}>Очистить список</button>
        </div>

        {items.length === 0 ? (
          <p>(Пустой список) Добавь первое вино через форму выше.</p>
        ) : (
          <div>
            {items.map((w) => (
              <article key={w.id}>
                <h3>{w.name}</h3>
                <div>🌍 {w.country || "—"} • 📍 {w.region || "—"}</div>
                <div>🏷️ {w.types.map((t) => WINE_TYPE_LABEL[t]).join(" + ")} • 🍇 {w.grape || "—"}</div>
                <div>✨ Вкус: {w.tastes.length ? w.tastes.join(", ") : "—"}</div>
                <div>
                  <button type="button" onClick={() => openEdit(w.id)}>✏️ Редактировать</button>
                  <button type="button" onClick={() => removeItem(w.id)}>🗑️ Удалить</button>
                </div>
                <hr />
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Экспорт">
        <h2>Экспорт</h2>
        <div>
          <button type="button" onClick={generateTelegramText} disabled={items.length === 0}>Сформировать текст для Telegram</button>
          <button type="button" onClick={copyTelegramText} disabled={items.length === 0 || busy.copy}>Копировать</button>
          <button type="button" onClick={telegramShare} disabled={items.length === 0}>Отправить (текст)</button>
        </div>

        <div>
          <h3>Превью Telegram-текста</h3>
          <textarea value={telegramText} onChange={(e) => setTelegramText(e.target.value)} rows={10} />
        </div>

        <div>
          <button type="button" onClick={buildPngFromPreview} disabled={items.length === 0 || busy.png}>Преобразовать в PNG</button>
          <button type="button" onClick={sharePngOrDownload} disabled={items.length === 0}>Отправить / скачать PNG</button>
        </div>

        <div>
          <h3>Preview для PNG</h3>
          <div ref={previewRef} style={{ padding: 12, border: "1px solid #ccc" }}>
            <div>🍷 Вина</div>
            <ol>
              {items.map((w) => (
                <li key={w.id}>
                  <div>{w.name}</div>
                  <div>🌍 {w.country || "—"} • 📍 {w.region || "—"}</div>
                  <div>🏷️ {w.types.map((t) => WINE_TYPE_LABEL[t]).join(" + ")} • 🍇 {w.grape || "—"}</div>
                  {w.tastes.length ? <div>✨ {w.tastes.join(", ")}</div> : null}
                </li>
              ))}
            </ol>
          </div>

          {pngDataUrl ? <img src={pngDataUrl} alt="Wine list PNG preview" style={{ maxWidth: "100%" }} /> : null}
        </div>
      </section>

      {edit.open ? (
        <div role="dialog" aria-modal="true" onClick={closeEdit} style={{ position: "fixed", inset: 0 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", padding: 16 }}>
            <h2>Редактировать</h2>

            <label>
              Название*:
              <input value={edit.draft.name} onChange={(e) => updateEditDraft({ name: e.target.value })} />
            </label>

            <label>
              Страна:
              <input list="countries_edit" value={edit.draft.country} onChange={(e) => updateEditDraft({ country: e.target.value })} />
              <datalist id="countries_edit">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
            </label>

            <div>
              <div>Тип (2 только если есть ✨ Игристое):</div>
              {(Object.keys(WINE_TYPE_LABEL) as WineType[]).map((t) => (
                <button key={t} type="button" aria-pressed={edit.draft.types.includes(t)} onClick={() => toggleEditType(t)}>
                  {WINE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            <div>
              <div>Вкус:</div>
              {TASTE_TAGS.map((tag) => (
                <button key={tag} type="button" aria-pressed={edit.draft.tastes.includes(tag)} onClick={() => toggleEditTaste(tag)}>
                  {tag}
                </button>
              ))}
            </div>

            <label>
              Сорт 🍇:
              <input
                list="grapes_edit"
                value={edit.draft.grape}
                onChange={(e) => updateEditDraft({ grape: e.target.value })}
                disabled={!edit.draft.country}
              />
              <datalist id="grapes_edit">
                {getGrapes(edit.draft.country, edit.draft.types).map((g) => <option key={g} value={g} />)}
              </datalist>
            </label>

            <label>
              Регион 📍:
              <input
                list="regions_edit"
                value={edit.draft.region}
                onChange={(e) => updateEditDraft({ region: e.target.value })}
                disabled={!edit.draft.country}
              />
              <datalist id="regions_edit">{getRegions(edit.draft.country).map((r) => <option key={r} value={r} />)}</datalist>
            </label>

            <div>
              <button type="button" onClick={saveEdit}>Сохранить</button>
              <button type="button" onClick={closeEdit}>Отмена</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
