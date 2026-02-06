import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COUNTRIES, TASTE_TAGS, WINE_TYPE_LABEL, COUNTRY_FLAGS } from "./catalog";
import {
    buildTelegramText,
    emptyDraft,
    getGrapes,
    getRegions,
    isValidName,
    makeId,
    normalizeDraftForCountryAndTypes,
    toggleTypeWithRules,
} from "./utils";

import { toPng } from "html-to-image";

export default function WineListBuilderPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState(() => {
        const saved = localStorage.getItem("sabor_wine_list_v1");
        return saved ? JSON.parse(saved) : [];
    });
    const [draft, setDraft] = useState(() => emptyDraft());
    const [customGrape, setCustomGrape] = useState(""); // Текст в поле своего сорта
    const [customRegion, setCustomRegion] = useState(""); // Текст в поле своего региона
    const [nameError, setNameError] = useState("");

    const [edit, setEdit] = useState({ open: false });
    const [editCustomGrape, setEditCustomGrape] = useState(""); // Для модалки редактирования
    const [editCustomRegion, setEditCustomRegion] = useState(""); // Для модалки редактирования

    const previewRef = useRef(null);
    const [pngDataUrl, setPngDataUrl] = useState("");
    const [busy, setBusy] = useState({ png: false, copy: false });
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const regions = useMemo(() => getRegions(draft.country), [draft.country]);
    const grapes = useMemo(() => getGrapes(draft.country, draft.types), [draft.country, draft.types]);

    function updateDraft(patch) {
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

    function toggleTaste(tag) {
        setDraft((prev) => {
            const exists = prev.tastes.includes(tag);
            const tastes = exists ? prev.tastes.filter((t) => t !== tag) : [...prev.tastes, tag];
            return { ...prev, tastes };
        });
    }

    function toggleGrape(g) {
        setDraft((prev) => {
            const exists = (prev.grapes || []).includes(g);
            const grapes = exists ? prev.grapes.filter((x) => x !== g) : [...(prev.grapes || []), g];
            return { ...prev, grapes };
        });
    }

    function selectRegion(r) {
        setDraft((prev) => ({
            ...prev,
            region: prev.region === r ? "" : r
        }));
    }

    function toggleType(nextType) {
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

        const currentGrapes = [...(draft.grapes || [])];
        const cg = customGrape.trim();
        if (cg && !currentGrapes.includes(cg)) {
            currentGrapes.push(cg);
        }

        let finalRegion = draft.region;
        const cr = customRegion.trim();
        if (cr) {
            finalRegion = cr;
        }

        const item = { id: makeId(), ...draft, grapes: currentGrapes, region: finalRegion, name: draft.name.trim() };
        setItems((prev) => [...prev, item]);
        setPngDataUrl("");
        setCustomGrape("");
        setCustomRegion("");
        clearForm();
    }

    function removeItem(id) {
        setItems((prev) => prev.filter((x) => x.id !== id));
        setPngDataUrl(""); // Сбрасываем старую картинку
    }

    function requestClearList() {
        const ok = window.confirm("Очистить весь список?");
        if (!ok) return;
        setItems([]);
        setPngDataUrl("");
    }

    function openEdit(id) {
        const current = items.find((x) => x.id === id);
        if (!current) return;
        const { id: _id, ...d } = current;
        setEdit({ open: true, id, draft: d });
    }

    function closeEdit() {
        setEdit({ open: false });
    }

    function updateEditDraft(patch) {
        setEdit((prev) => {
            if (!prev.open) return prev;
            let nextDraft = { ...prev.draft, ...patch };
            if (patch.country !== undefined || patch.types !== undefined) {
                nextDraft = normalizeDraftForCountryAndTypes(nextDraft);
            }
            return { ...prev, draft: nextDraft };
        });
    }

    function toggleEditTaste(tag) {
        setEdit((prev) => {
            if (!prev.open) return prev;
            const exists = prev.draft.tastes.includes(tag);
            const tastes = exists ? prev.draft.tastes.filter((t) => t !== tag) : [...prev.draft.tastes, tag];
            return { ...prev, draft: { ...prev.draft, tastes } };
        });
    }

    function toggleEditGrape(g) {
        setEdit((prev) => {
            if (!prev.open) return prev;
            const exists = (prev.draft.grapes || []).includes(g);
            const grapes = exists ? prev.draft.grapes.filter((x) => x !== g) : [...(prev.draft.grapes || []), g];
            return { ...prev, draft: { ...prev.draft, grapes } };
        });
    }

    function toggleEditType(nextType) {
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

        const currentGrapes = [...(edit.draft.grapes || [])];
        const cg = editCustomGrape.trim();
        if (cg && !currentGrapes.includes(cg)) {
            currentGrapes.push(cg);
        }

        let finalRegion = edit.draft.region;
        const cr = editCustomRegion.trim();
        if (cr) {
            finalRegion = cr;
        }

        setItems((prev) =>
            prev.map((x) => (x.id === edit.id ? { id: x.id, ...edit.draft, grapes: currentGrapes, region: finalRegion, name: edit.draft.name.trim() } : x))
        );
        setEditCustomGrape("");
        setEditCustomRegion("");
        closeEdit();
    }

    async function copyTelegramText() {
        setBusy((b) => ({ ...b, copy: true }));
        try {
            const text = buildTelegramText(items);
            await navigator.clipboard.writeText(text);
        } finally {
            setBusy((b) => ({ ...b, copy: false }));
        }
    }

    async function buildPngFromPreview() {
        if (!previewRef.current) return null;
        setBusy((b) => ({ ...b, png: true }));
        try {
            const dataUrl = await toPng(previewRef.current, {
                cacheBust: false, // Отключаем для скорости
                pixelRatio: 1.5,
                skipFonts: true, // Игнорируем внешние шрифты для скорости и отсутствия ошибок
                fontEmbedCSS: '',
                filter: (node) => {
                    if (node.tagName === 'LINK') return false;
                    return true;
                }
            });
            setPngDataUrl(dataUrl);
            return dataUrl;
        } catch (err) {
            console.error("PNG generation failed", err);
            return null;
        } finally {
            setBusy((b) => ({ ...b, png: false }));
        }
    }

    async function sharePngOrDownload() {
        const url = pngDataUrl;
        if (!url) {
            // Если картинка еще не готова, пробуем быстро сгенерировать
            const freshUrl = await buildPngFromPreview();
            if (!freshUrl) return;
            proceedToShare(freshUrl);
        } else {
            proceedToShare(url);
        }
    }

    async function proceedToShare(url) {
        try {
            // Конвертируем base64 в Blob синхронно, чтобы не терять user gesture
            const parts = url.split(',');
            const byteString = atob(parts[1]);
            const mimeString = parts[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });
            const file = new File([blob], "wine-list.png", { type: "image/png" });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Wine List"
                });
            } else {
                downloadFallback(url);
            }
        } catch (err) {
            if (err.name !== "AbortError") {
                console.error("Share failed:", err);
                downloadFallback(url);
            }
        }
    }

    function downloadFallback(url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = "wine-list.png";
        a.click();
    }

    async function copyToClipboard() {
        if (exportMode === "text") {
            await copyTelegramText();
            alert("Текст скопирован!");
        } else {
            setBusy((b) => ({ ...b, copy: true }));
            try {
                if (!pngDataUrl) await buildPngFromPreview();
                const res = await fetch(pngDataUrl);
                const blob = await res.blob();
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);
                alert("Изображение скопировано!");
            } catch (err) {
                console.error(err);
                alert("Не удалось скопировать изображение");
            } finally {
                setBusy((b) => ({ ...b, copy: false }));
            }
        }
    }

    function handleShare() {
        if (exportMode === "text") {
            setShowShareMenu(true);
        } else {
            sharePngOrDownload();
        }
    }

    async function sendDirect(target) {
        const text = buildTelegramText(items);
        setShowShareMenu(false);

        if (target === "telegram") {
            window.location.href = `tg://msg?text=${encodeURIComponent(text)}`;
        } else if (target === "whatsapp") {
            window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
        } else if (target === "system") {
            if (navigator.share) {
                try {
                    await navigator.share({ text });
                } catch (err) {
                    if (err.name !== "AbortError") console.error(err);
                }
            } else {
                const url = `https://t.me/share/url?text=${encodeURIComponent(text)}`;
                window.open(url, "_blank");
            }
        }
    }

    const [exportMode, setExportMode] = useState("text"); // "text" or "image"

    // Сохранение в localStorage
    useEffect(() => {
        localStorage.setItem("sabor_wine_list_v1", JSON.stringify(items));
    }, [items]);

    // Предварительная генерация картинки при смене режима или списка
    useEffect(() => {
        if (exportMode === "image" && items.length > 0) {
            buildPngFromPreview();
        }
    }, [exportMode, items]);

    const canAdd = isValidName(draft.name);

    return (
        <div className="w-full min-h-screen font-display text-[#181311] dark:text-gray-100 pb-40 aurora-bg">
            <header className="sticky top-0 z-50 flex items-center bg-white/95 dark:bg-[#181311]/95 backdrop-blur-sm p-4 pb-2 justify-between border-b border-orange-100/50 dark:border-gray-800 shadow-sm mb-4">
                <button
                    onClick={() => navigate(-1)}
                    className="text-[#181311] dark:text-white flex size-10 items-center justify-center rounded-full hover:bg-orange-50 dark:hover:bg-white/5"
                    aria-label="Назад"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-[#181311] dark:text-white text-lg font-bold text-center flex-1">Генератор списка вин</h1>
                <div className="w-10"></div>
            </header>

            <div className="px-4 space-y-6">

                <section aria-label="Форма добавления вина" className="bg-white dark:bg-[#1b1412] p-6 rounded-xl shadow-sm border border-orange-100/50 dark:border-gray-800 space-y-6">
                    <div>
                        <label className="block text-sm font-semibold mb-2">
                            Название вина*:
                        </label>
                        <input
                            className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-[#2a201d] dark:border-gray-700"
                            value={draft.name}
                            onChange={(e) => updateDraft({ name: e.target.value })}
                            placeholder="Например: Riesling Estate"
                        />
                        {nameError && <div role="alert" className="text-red-500 text-xs mt-1">{nameError}</div>}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-semibold">Страна:</label>
                            <div className="group relative">
                                <span className="cursor-help text-xs bg-gray-200 dark:bg-gray-700 w-4 h-4 rounded-full flex items-center justify-center opacity-60">?</span>
                                <div className="absolute left-0 bottom-full mb-2 w-[calc(100vw-2rem)] max-w-64 p-3 bg-black text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl leading-relaxed whitespace-normal text-left">
                                    Выбор страны открывает доступ к списку её регионов и характерных сортов винограда.
                                </div>
                            </div>
                        </div>
                        <input
                            list="countries"
                            className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-[#2a201d] dark:border-gray-700"
                            value={draft.country}
                            onChange={(e) => updateDraft({ country: e.target.value })}
                            placeholder="Выберите страну..."
                        />
                        <datalist id="countries">
                            {COUNTRIES.map((c) => <option key={c} value={c} />)}
                        </datalist>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-sm font-semibold">Сорта винограда 🍇:</label>
                                <div className="group relative">
                                    <span className="cursor-help text-xs bg-gray-200 dark:bg-gray-700 w-4 h-4 rounded-full flex items-center justify-center opacity-60">?</span>
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-[calc(100vw-2rem)] max-w-64 p-3 bg-black text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl leading-relaxed whitespace-normal text-center">
                                        Выберите из списка или введите свой сорт, если его нет. Можно выбрать несколько для купажа.
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-lg bg-gray-50 dark:bg-[#2a201d] dark:border-gray-700 mb-2">
                                {grapes.map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => toggleGrape(g)}
                                        className={`px-3 py-1 rounded-full text-xs transition-colors ${(draft.grapes || []).includes(g)
                                            ? 'bg-primary text-white font-medium'
                                            : 'bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border dark:border-gray-700'
                                            }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                                {(draft.grapes || []).filter(g => !grapes.includes(g)).map(cg => (
                                    <button
                                        key={cg}
                                        type="button"
                                        onClick={() => toggleGrape(cg)}
                                        className="px-3 py-1 rounded-full text-xs bg-primary text-white font-medium flex items-center gap-1"
                                    >
                                        {cg} ✕
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Свой сорт..."
                                    className="flex-1 p-2 text-sm border rounded-lg bg-white dark:bg-[#120d0b] dark:border-gray-700"
                                    value={customGrape}
                                    onChange={(e) => setCustomGrape(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = customGrape.trim();
                                            if (val && !(draft.grapes || []).includes(val)) {
                                                toggleGrape(val);
                                                setCustomGrape("");
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const val = customGrape.trim();
                                        if (val && !(draft.grapes || []).includes(val)) {
                                            toggleGrape(val);
                                            setCustomGrape("");
                                        }
                                    }}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-sm font-semibold">Регион 📍:</label>
                                <div className="group relative">
                                    <span className="cursor-help text-xs bg-gray-200 dark:bg-gray-700 w-4 h-4 rounded-full flex items-center justify-center opacity-60">?</span>
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-[calc(100vw-2rem)] max-w-64 p-3 bg-black text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl leading-relaxed whitespace-normal text-center">
                                        Необязательно. Помогает уточнить происхождение вина (например, Бургундия или Кахетия).
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-lg bg-gray-50 dark:bg-[#2a201d] dark:border-gray-700 mb-2">
                                {regions.map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => selectRegion(r)}
                                        className={`px-3 py-1 rounded-full text-xs transition-colors ${draft.region === r
                                            ? 'bg-primary text-white font-medium'
                                            : 'bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border dark:border-gray-700'
                                            }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                                {draft.region && !regions.includes(draft.region) && (
                                    <button
                                        type="button"
                                        onClick={() => selectRegion(draft.region)}
                                        className="px-3 py-1 rounded-full text-xs bg-primary text-white font-medium flex items-center gap-1"
                                    >
                                        {draft.region} ✕
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Свой регион..."
                                    className="flex-1 p-2 text-sm border rounded-lg bg-white dark:bg-[#120d0b] dark:border-gray-700 disabled:opacity-50"
                                    value={customRegion}
                                    onChange={(e) => setCustomRegion(e.target.value)}
                                    disabled={!draft.country}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = customRegion.trim();
                                            if (val) {
                                                selectRegion(val);
                                                setCustomRegion("");
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const val = customRegion.trim();
                                        if (val) {
                                            selectRegion(val);
                                            setCustomRegion("");
                                        }
                                    }}
                                    disabled={!draft.country}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="text-sm font-semibold">Тип вина:</div>
                            <div className="group relative">
                                <span className="cursor-help text-xs bg-gray-200 dark:bg-gray-700 w-4 h-4 rounded-full flex items-center justify-center opacity-60">?</span>
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-[calc(100vw-2rem)] max-w-64 p-3 bg-black text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl leading-relaxed whitespace-normal text-center">
                                    Вы можете сочетать Игристое с Белым или Розовым. Другие типы выбираются только по одному.
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(WINE_TYPE_LABEL).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    aria-pressed={draft.types.includes(t)}
                                    onClick={() => toggleType(t)}
                                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${draft.types.includes(t)
                                        ? 'bg-primary text-white font-medium'
                                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {WINE_TYPE_LABEL[t]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="text-sm font-semibold mb-2">Вкус:</div>
                        <div className="flex flex-wrap gap-2">
                            {TASTE_TAGS.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    aria-pressed={draft.tastes.includes(tag)}
                                    onClick={() => toggleTaste(tag)}
                                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${draft.tastes.includes(tag)
                                        ? 'bg-primary text-white font-medium'
                                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>


                    <div className="pt-4 flex flex-col gap-4">
                        {/* Quantity Counter */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold">Quantity (Bottles)</label>
                            <div className="flex bg-gray-800/5 dark:bg-gray-800 rounded-full p-1 w-48 border border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => updateDraft({ quantity: Math.max(1, (draft.quantity || 1) - 1) })}
                                    className="w-12 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 transition-colors"
                                >
                                    −
                                </button>
                                <div className="flex-1 flex items-center justify-center font-bold text-lg">
                                    {draft.quantity || 1}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateDraft({ quantity: (draft.quantity || 1) + 1 })}
                                    className="w-12 h-10 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-dark transition-colors shadow-sm"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={addToList}
                                disabled={!canAdd}
                                className="flex-1 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg shadow-sm"
                            >
                                Добавить в список
                            </button>
                            <button
                                type="button"
                                onClick={clearForm}
                                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                            >
                                Очистить
                            </button>
                        </div>
                    </div>
                </section>

                <section aria-label="Список" className="mt-12 space-y-6 pb-20">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Ваш список вин ({items.length})</h2>
                        <button
                            type="button"
                            onClick={requestClearList}
                            disabled={items.length === 0}
                            className="text-red-500 hover:text-red-600 disabled:opacity-50 text-sm font-medium"
                        >
                            Очистить список
                        </button>
                    </div>

                    {items.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            <p className="text-gray-500">Список пуст. Добавьте первое вино через форму выше.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {items.map((w) => (
                                <article key={w.id} className="bg-white dark:bg-[#1b1412] p-4 rounded-xl shadow-sm border border-orange-100/50 dark:border-gray-800 relative group">
                                    <div className="pr-20">
                                        <h3 className="font-bold text-lg break-words overflow-hidden">
                                            {w.name}
                                            {w.quantity > 1 && <span className="ml-2 text-primary text-sm whitespace-nowrap">(x{w.quantity})</span>}
                                        </h3>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {w.country} {w.region && `· ${w.region}`}
                                        </div>
                                        <div className="text-sm mt-1">
                                            {w.types.map((t) => WINE_TYPE_LABEL[t]).join(" + ")} {w.grapes && w.grapes.length > 0 && `· ${w.grapes.join(" · ")}`}
                                        </div>
                                        {w.tastes.length > 0 && (
                                            <div className="mt-2 text-sm bg-gray-50 dark:bg-white/5 p-2 rounded-lg inline-block italic">
                                                {w.tastes.join(" · ")}
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEdit(w.id)}
                                            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                            title="Редактировать"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(w.id)}
                                            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                                            title="Удалить"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                {/* Панель экспорта и предпросмотра */}
                <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1b1412] border-t dark:border-gray-800 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] z-40">
                    <div className="w-full">
                        {/* Окно предпросмотра (раскрывается вверх) */}
                        {showPreview && items.length > 0 && (
                            <div className="p-4 bg-gray-50/50 dark:bg-[#120d0b] border-b dark:border-gray-800 max-h-[60vh] overflow-auto">
                                {exportMode === 'text' ? (
                                    <div className="relative">
                                        <pre className="text-[10px] break-all whitespace-pre-wrap font-mono p-4 bg-white dark:bg-black/30 rounded-xl border dark:border-gray-700 leading-relaxed shadow-inner">
                                            {buildTelegramText(items)}
                                        </pre>
                                        <div className="absolute top-2 right-2 text-[8px] text-gray-400 uppercase font-bold tracking-widest">
                                            Telegram Text
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 py-2">
                                        <div className="relative bg-white shadow-2xl rounded-sm overflow-hidden border border-gray-200 dark:border-gray-700" style={{
                                            width: '260px',
                                            height: '346px',
                                        }}>
                                            {busy.png && !pngDataUrl ? (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                    <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">Drawing...</span>
                                                </div>
                                            ) : pngDataUrl ? (
                                                <img src={pngDataUrl} alt="Preview" className="w-full h-full object-contain" />
                                            ) : null}
                                        </div>
                                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">675x900 Image</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-base">Экспорт списка</h3>
                                <div className="bg-gray-100 dark:bg-white/5 p-1 rounded-full flex text-xs border dark:border-gray-800">
                                    <button
                                        onClick={() => setExportMode("text")}
                                        className={`px-4 py-1.5 rounded-full transition-all ${exportMode === "text" ? "bg-primary text-white shadow-sm font-medium" : "text-gray-500"}`}
                                    >
                                        Text
                                    </button>
                                    <button
                                        onClick={() => setExportMode("image")}
                                        className={`px-4 py-1.5 rounded-full transition-all ${exportMode === "image" ? "bg-primary text-white shadow-sm font-medium" : "text-gray-500"}`}
                                    >
                                        Image
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    disabled={items.length === 0}
                                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all border ${showPreview ? 'bg-primary/10 border-primary text-primary' : 'bg-gray-50 dark:bg-white/5 border-transparent'}`}
                                >
                                    <span className="text-xl">👁️</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Preview</span>
                                </button>

                                <button
                                    onClick={handleShare}
                                    disabled={items.length === 0 || (exportMode === "image" && busy.png)}
                                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all group disabled:opacity-50"
                                >
                                    <div className="text-xl group-hover:scale-110 transition-transform">
                                        {busy.png && exportMode === "image" ? (
                                            <div className="w-5 h-5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                                        ) : "📤"}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Send</span>
                                </button>

                                <button
                                    onClick={copyToClipboard}
                                    disabled={busy.copy || items.length === 0}
                                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-all group disabled:opacity-50"
                                >
                                    <span className="text-xl group-hover:scale-110 transition-transform">📋</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wide">{busy.copy ? "..." : "Copy"}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>




                {/* Hidden stuff for generation */}
                <div className="fixed left-[-9999px] top-0">
                    <textarea
                        readOnly
                        value={buildTelegramText(items)}
                    />
                    <div
                        ref={previewRef}
                        className="preview-container"
                        style={{
                            width: '675px',
                            height: '900px',
                            backgroundImage: 'url(/images/wine-background.jpg)',
                            backgroundSize: '100% 100%',
                            backgroundRepeat: 'no-repeat',
                            position: 'relative',
                            color: '#1a0d08', // Основной почти черный цвет для контраста
                            fontFamily: '"Georgia", serif',
                            boxSizing: 'border-box',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            left: '42px',
                            top: '55px',
                            width: '436px',
                            height: '790px',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '15px 50px',
                            boxSizing: 'border-box',
                            textAlign: 'center'
                        }}>
                            {/* Супер-компактный хедер */}
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{
                                    fontSize: '22px',
                                    letterSpacing: '2px',
                                    textTransform: 'uppercase',
                                    color: '#1a0d08',
                                    fontWeight: 'bold'
                                }}>
                                    Collection de Vins
                                </div>
                                <div style={{
                                    fontSize: '10px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '3px',
                                    color: '#4a2c2a',
                                    fontWeight: 'bold'
                                }}>
                                    Personal Selection
                                </div>
                            </div>

                            {/* Уплотненный список с высокой контрастностью */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '5px',
                                flex: 1,
                                overflow: 'hidden',
                                justifyContent: 'flex-start'
                            }}>
                                {items.map((w, i) => (
                                    <div key={w.id} style={{
                                        lineHeight: '1.25',
                                        textAlign: 'center'
                                    }}>
                                        {/* Line 1: Index + Name + Quantity (Linked by non-breaking spaces) */}
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            color: '#6b3e23',
                                            wordWrap: 'break-word',
                                            lineHeight: '1.2'
                                        }}>
                                            {`${i + 1}.\u00A0${w.name}${w.quantity > 1 ? `\u00A0(x${w.quantity})` : ''}`}
                                        </div>

                                        {/* Line 2: Geog (No emojis) */}
                                        <div style={{ fontSize: '11px', color: '#1a0d08', fontWeight: 'bold' }}>
                                            {w.country}{w.region && ` · ${w.region}`}
                                        </div>

                                        {/* Line 3: Type/Grape */}
                                        <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#4a2c2a', fontWeight: 'bold' }}>
                                            {w.types.map((t) => WINE_TYPE_LABEL[t]).join("/")}{w.grapes && w.grapes.length > 0 && ` · ${w.grapes.join(" · ")}`}
                                        </div>

                                        {/* Line 4: Tastes */}
                                        {w.tastes.length > 0 && (
                                            <div style={{ fontSize: '10px', color: '#1a0d08', fontWeight: 'bold' }}>
                                                {w.tastes.join(" · ")}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Контрастный футер */}
                            <div style={{
                                marginTop: '10px',
                                fontSize: '15px',
                                fontFamily: '"Brush Script MT", cursive',
                                color: '#1a0d08',
                                fontWeight: 'bold'
                            }}>
                                Sabor • {new Date().toLocaleDateString('ru-RU')}
                            </div>
                        </div>
                    </div>
                </div>


                {
                    edit.open && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity" onClick={closeEdit}>
                            <div className="bg-white dark:bg-[#1b1412] w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold">Редактировать вино</h2>
                                    <button onClick={closeEdit} className="text-gray-500 hover:text-gray-700">
                                        ✕
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Название*:</label>
                                        <input
                                            className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-[#2a201d] dark:border-gray-700"
                                            value={edit.draft.name}
                                            onChange={(e) => updateEditDraft({ name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Страна:</label>
                                        <input
                                            list="countries_edit"
                                            className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-[#2a201d] dark:border-gray-700"
                                            value={edit.draft.country}
                                            onChange={(e) => updateEditDraft({ country: e.target.value })}
                                        />
                                        <datalist id="countries_edit">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-semibold mb-2">Сорт (мультивыбор) 🍇:</label>
                                            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-[#2a201d] dark:border-gray-700 mb-2">
                                                {getGrapes(edit.draft.country, edit.draft.types).map((g) => (
                                                    <button
                                                        key={g}
                                                        type="button"
                                                        onClick={() => toggleEditGrape(g)}
                                                        className={`px-3 py-1 rounded-full text-xs transition-colors ${(edit.draft.grapes || []).includes(g)
                                                            ? 'bg-primary text-white font-medium'
                                                            : 'bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border dark:border-gray-700'
                                                            }`}
                                                    >
                                                        {g}
                                                    </button>
                                                ))}
                                                {(edit.draft.grapes || []).filter(g => !getGrapes(edit.draft.country, edit.draft.types).includes(g)).map(cg => (
                                                    <button
                                                        key={cg}
                                                        type="button"
                                                        onClick={() => toggleEditGrape(cg)}
                                                        className="px-3 py-1 rounded-full text-xs bg-primary text-white font-medium flex items-center gap-1"
                                                    >
                                                        {cg} ✕
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Свой сорт..."
                                                    className="flex-1 p-2 text-sm border rounded-lg bg-white dark:bg-[#120d0b] dark:border-gray-700"
                                                    value={editCustomGrape}
                                                    onChange={(e) => setEditCustomGrape(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const val = editCustomGrape.trim();
                                                            if (val && !(edit.draft.grapes || []).includes(val)) {
                                                                toggleEditGrape(val);
                                                                setEditCustomGrape("");
                                                            }
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const val = editCustomGrape.trim();
                                                        if (val && !(edit.draft.grapes || []).includes(val)) {
                                                            toggleEditGrape(val);
                                                            setEditCustomGrape("");
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold mb-2">Регион 📍:</label>
                                            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-[#2a201d] dark:border-gray-700 mb-2">
                                                {getRegions(edit.draft.country).map((r) => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() => updateEditDraft({ region: edit.draft.region === r ? "" : r })}
                                                        className={`px-3 py-1 rounded-full text-xs transition-colors ${edit.draft.region === r
                                                            ? 'bg-primary text-white font-medium'
                                                            : 'bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border dark:border-gray-700'
                                                            }`}
                                                    >
                                                        {r}
                                                    </button>
                                                ))}
                                                {edit.draft.region && !getRegions(edit.draft.country).includes(edit.draft.region) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => updateEditDraft({ region: "" })}
                                                        className="px-3 py-1 rounded-full text-xs bg-primary text-white font-medium flex items-center gap-1"
                                                    >
                                                        {edit.draft.region} ✕
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Свой регион..."
                                                    className="flex-1 p-2 text-sm border rounded-lg bg-white dark:bg-[#120d0b] dark:border-gray-700"
                                                    value={editCustomRegion}
                                                    onChange={(e) => setEditCustomRegion(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const val = editCustomRegion.trim();
                                                            if (val) {
                                                                updateEditDraft({ region: val });
                                                                setEditCustomRegion("");
                                                            }
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const val = editCustomRegion.trim();
                                                        if (val) {
                                                            updateEditDraft({ region: val });
                                                            setEditCustomRegion("");
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-sm font-semibold mb-2">Тип:</div>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.keys(WINE_TYPE_LABEL).map((t) => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    aria-pressed={edit.draft.types.includes(t)}
                                                    onClick={() => toggleEditType(t)}
                                                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${edit.draft.types.includes(t)
                                                        ? 'bg-primary text-white'
                                                        : 'bg-gray-100 dark:bg-gray-800'
                                                        }`}
                                                >
                                                    {WINE_TYPE_LABEL[t]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-sm font-semibold mb-2">Вкус:</div>
                                        <div className="flex flex-wrap gap-2">
                                            {TASTE_TAGS.map((tag) => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    aria-pressed={edit.draft.tastes.includes(tag)}
                                                    onClick={() => toggleEditTaste(tag)}
                                                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${edit.draft.tastes.includes(tag)
                                                        ? 'bg-primary text-white'
                                                        : 'bg-gray-100 dark:bg-gray-800'
                                                        }`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <label className="block text-sm font-semibold mb-2">Количество:</label>
                                        <div className="flex items-center gap-4">
                                            <button
                                                type="button"
                                                onClick={() => updateEditDraft({ quantity: Math.max(1, (edit.draft.quantity || 1) - 1) })}
                                                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
                                            >
                                                −
                                            </button>
                                            <span className="font-bold text-lg">{edit.draft.quantity || 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => updateEditDraft({ quantity: (edit.draft.quantity || 1) + 1 })}
                                                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                                        <button
                                            type="button"
                                            onClick={closeEdit}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                        >
                                            Отмена
                                        </button>
                                        <button
                                            type="button"
                                            onClick={saveEdit}
                                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                                        >
                                            Сохранить
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Share Menu Overlay */}
                {showShareMenu && (
                    <div
                        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={() => setShowShareMenu(false)}
                    >
                        <div
                            className="bg-white dark:bg-[#1b1412] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 border-b dark:border-gray-800 flex justify-between items-center">
                                <span className="font-bold text-lg">Куда отправить?</span>
                                <button onClick={() => setShowShareMenu(false)} className="text-gray-400 p-1">✕</button>
                            </div>
                            <div className="p-4 grid grid-cols-3 gap-4">
                                <button
                                    onClick={() => sendDirect("telegram")}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className="w-14 h-14 bg-[#24A1DE] rounded-2xl flex items-center justify-center text-white shadow-lg group-active:scale-90 transition-transform">
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M11.944 0C5.347 0 0 5.347 0 11.944c0 6.597 5.347 11.944 11.944 11.944 6.597 0 11.944-5.347 11.944-11.944C23.888 5.347 18.541 0 11.944 0zm5.187 8.35c-.171 1.833-.912 6.225-1.284 8.216-.157.844-.467 1.127-.768 1.155-.655.06-1.153-.434-1.789-.851-1-.655-1.565-1.062-2.536-1.701-1.121-.738-.394-1.144.245-1.807.167-.174 3.067-2.812 3.123-3.049.007-.03.013-.14-.052-.197s-.162-.038-.232-.022c-.1.023-1.688 1.074-4.766 3.15-.451.31-.859.462-1.221.454-.4-.009-1.168-.227-1.739-.412-.7-.227-1.257-.347-1.209-.733.025-.201.302-.407.828-.619 3.235-1.408 5.392-2.338 6.471-2.79 3.081-1.289 3.721-1.513 4.138-1.52.091-.002.296.02.428.128.111.09.141.211.15.305.011.104.015.313.003.434z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-medium">Telegram</span>
                                </button>

                                <button
                                    onClick={() => sendDirect("whatsapp")}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className="w-14 h-14 bg-[#25D366] rounded-2xl flex items-center justify-center text-white shadow-lg group-active:scale-90 transition-transform">
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-medium">WhatsApp</span>
                                </button>

                                <button
                                    onClick={() => sendDirect("system")}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-sm group-active:scale-90 transition-transform">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="18" cy="5" r="3" />
                                            <circle cx="6" cy="12" r="3" />
                                            <circle cx="18" cy="19" r="3" />
                                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-medium">Другое</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
