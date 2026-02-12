import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COUNTRIES, TASTE_TAGS, WINE_TYPE_LABEL, COUNTRY_FLAGS } from "./catalog";
import { buildTelegramText, emptyDraft, getGrapes, getRegions, isValidName, makeId, normalizeDraftForCountryAndTypes, toggleTypeWithRules } from "./utils";
import { toPng } from "html-to-image";
import bgImage from "../../assets/wine-bg.webp";
import wineBgPreview from "../../assets/wine-background.jpg";
import { useAuth } from "../../contexts/AuthContext";
import GuestBlocker from "../../components/GuestBlocker";


export default function WineListBuilderPage() {
    const navigate = useNavigate();
    const { isGuest } = useAuth();

    if (isGuest) {
        return (
            <div className="w-full min-h-screen aurora-bg p-8 flex flex-col items-center justify-center">
                <div className="w-full max-w-sm bg-white/60 dark:bg-[#fdfbf7]/80 backdrop-blur-md p-8 rounded-[32px] border border-white/20 shadow-2xl">
                    <GuestBlocker lines={5} message="Генератор доступен только после авторизации" />
                    <button
                        onClick={() => navigate('/tools')}
                        className="w-full mt-6 py-4 rounded-2xl bg-[#5a2d3d] text-white font-bold border border-[#4a1d2d] active:scale-95 transition-all text-xs uppercase tracking-widest"
                    >
                        Назад к инструментам
                    </button>
                </div>
            </div>
        );
    }

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
    const [isExportExpanded, setIsExportExpanded] = useState(false);

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
        <div className="w-full min-h-screen font-display text-[#181311] dark:text-gray-100 pb-40 aurora-bg relative overflow-hidden">
            {/* Декоративные фоновые изображения */}
            <div className="fixed inset-0 pointer-events-none z-[1]">
                <img
                    src={bgImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-100 scale-110 origin-top"
                />
            </div>

            <header className="sticky top-0 z-50 flex items-center bg-[#5a2d3d] dark:bg-[#5a2d3d] backdrop-blur-sm p-4 pb-2 justify-between border-b border-[#4a1d2d] shadow-lg mb-4">
                <button
                    onClick={() => navigate(-1)}
                    className="text-white flex size-10 items-center justify-center rounded-full hover:bg-white/10"
                    aria-label="Назад"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-white text-lg font-bold text-center flex-1">Генератор списка вин</h1>
                <div className="w-10"></div>
            </header>

            <div className="px-4 space-y-6 relative z-10">

                <section aria-label="Форма добавления вина" className="bg-white/60 dark:bg-[#fdfbf7]/80 backdrop-blur-md p-6 rounded-xl shadow-xl border border-white/20 space-y-6 [&_label]:text-[#5a2d3d]">
                    <div>
                        <label className="block text-sm font-semibold mb-2">
                            Название вина*:
                        </label>
                        <input
                            className="w-full p-2 border rounded-lg bg-white/10 dark:bg-white/5 backdrop-blur-sm border-white/30 dark:border-white/20 transition-all focus:bg-white/20 focus:border-primary"
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
                            className="w-full p-2 border rounded-lg bg-white/10 dark:bg-white/5 backdrop-blur-sm border-white/30 dark:border-white/20 transition-all focus:bg-white/20 focus:border-primary"
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
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-lg bg-white/10 dark:bg-white/5 backdrop-blur-sm border-white/30 dark:border-white/20 mb-2">
                                {grapes.map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => toggleGrape(g)}
                                        className={`px-3 py-1 rounded-full text-xs transition-all ${(draft.grapes || []).includes(g)
                                            ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 font-bold shadow-lg'
                                            : 'bg-white/10 dark:bg-white/5 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-white/10 border border-white/30 dark:border-white/20'
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
                                    className="flex-1 p-2 text-sm border rounded-lg bg-white/10 dark:bg-white/5 backdrop-blur-sm border-white/30 dark:border-white/20"
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
                                    className="size-10 flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 text-xl font-bold hover:from-yellow-400 hover:to-yellow-600 shadow-lg transition-all active:scale-95"
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
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-lg bg-white/10 dark:bg-white/5 backdrop-blur-sm border-white/30 dark:border-white/20 mb-2">
                                {regions.map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => selectRegion(r)}
                                        className={`px-3 py-1 rounded-full text-xs transition-all ${draft.region === r
                                            ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 font-bold shadow-lg'
                                            : 'bg-white/10 dark:bg-white/5 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-white/10 border border-white/30 dark:border-white/20'
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
                                    className="flex-1 p-2 text-sm border rounded-lg bg-white/10 dark:bg-white/5 backdrop-blur-sm border-white/30 dark:border-white/20 disabled:opacity-50"
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
                                    className="size-10 flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 text-xl font-bold hover:from-yellow-400 hover:to-yellow-600 shadow-lg transition-all active:scale-95 disabled:opacity-30"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="text-sm font-semibold text-[#5a2d3d]">Тип вина:</div>
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
                                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${draft.types.includes(t)
                                        ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 font-bold shadow-lg scale-105'
                                        : 'bg-white/10 dark:bg-white/5 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-white/10 border border-white/30 dark:border-white/20'
                                        }`}
                                >
                                    {WINE_TYPE_LABEL[t]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="text-sm font-semibold mb-2 text-[#5a2d3d]">Вкус:</div>
                        <div className="flex flex-wrap gap-2">
                            {TASTE_TAGS.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    aria-pressed={draft.tastes.includes(tag)}
                                    onClick={() => toggleTaste(tag)}
                                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${draft.tastes.includes(tag)
                                        ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 font-bold shadow-lg'
                                        : 'bg-white/10 dark:bg-white/5 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-white/10 border border-white/30 dark:border-white/20'
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
                            <label className="text-sm font-semibold">Количество (бутылок):</label>
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
                                    className="w-12 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 hover:from-yellow-400 hover:to-yellow-600 transition-colors shadow-lg font-bold text-xl"
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
                                className="flex-1 py-3 bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 rounded-3xl hover:from-yellow-400 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
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
                    <div className="flex items-center justify-between bg-white/40 dark:bg-[#1b1412]/40 backdrop-blur-md p-4 rounded-xl shadow-lg border border-white/20 dark:border-white/10">
                        <h2 className="text-xl font-bold text-[#5a2d3d]">Ваш список вин ({items.length})</h2>
                        <button
                            type="button"
                            onClick={requestClearList}
                            disabled={items.length === 0}
                            className="px-3 py-1 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50 text-xs font-bold shadow-lg transition-all active:scale-95"
                            style={{ backgroundColor: '#ef4444', opacity: 1 }}
                        >
                            Очистить список
                        </button>
                    </div>

                    {items.length === 0 ? (
                        <div className="text-center py-12 bg-white/40 dark:bg-[#1b1412]/40 backdrop-blur-md rounded-xl border border-white/20 dark:border-white/10 shadow-lg">
                            <p className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-medium">Список пуст. Добавьте первое вино через форму выше.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {items.map((w) => (
                                <article key={w.id} className="bg-white/40 dark:bg-[#1b1412]/40 backdrop-blur-md p-4 rounded-xl shadow-lg border border-white/20 dark:border-white/10 relative group [&_h3]:text-[#5a2d3d] [&_h3]:drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] [&_.text-sm]:text-black [&_.text-sm]:drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
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
                                            <div className="mt-2 text-sm bg-white/20 dark:bg-white/10 backdrop-blur-sm p-2 rounded-lg inline-block italic text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
                                                {w.tastes.join(" · ")}
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEdit(w.id)}
                                            className="p-2 bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/30 dark:hover:bg-white/20 text-blue-600 dark:text-blue-400 shadow-lg"
                                            title="Редактировать"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(w.id)}
                                            className="p-2 bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/30 dark:hover:bg-white/20 text-red-500 shadow-lg"
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

                {/* Панель экспорта и предпросмотра (Bottom Sheet) */}
                <div
                    className={`fixed bottom-0 left-0 right-0 bg-[#d4c4b0]/80 dark:bg-[#1b1412]/80 backdrop-blur-xl border-t border-white/20 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 rounded-t-[2.5rem] transition-all duration-500 ease-in-out ${isExportExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-60px)]'
                        } ${items.length === 0 ? 'translate-y-full' : ''}`}
                >
                    {/* Handle / Toggle */}
                    <button
                        onClick={() => setIsExportExpanded(!isExportExpanded)}
                        className="w-full h-[60px] flex items-center justify-between px-6 cursor-pointer group"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📤</span>
                            <h3 className="font-bold text-base text-[#3d1f1f] dark:text-white/90">Экспорт списка</h3>
                            <span className="px-2 py-0.5 bg-black/10 dark:bg-white/10 rounded-full text-[10px] font-bold">
                                {items.length}
                            </span>
                        </div>
                        <span className={`material-symbols-outlined transition-transform duration-500 ${isExportExpanded ? 'rotate-180' : ''}`}>
                            keyboard_arrow_up
                        </span>
                    </button>

                    <div className="w-full px-4 pb-8 space-y-4">
                        {/* Окно предпросмотра */}
                        {showPreview && items.length > 0 && (
                            <div className="p-4 bg-white/30 dark:bg-black/20 rounded-2xl border border-white/20 overflow-hidden animate-slideUp">
                                {exportMode === 'text' ? (
                                    <div className="relative">
                                        <pre className="text-[10px] break-all whitespace-pre-wrap font-mono p-4 bg-white/50 dark:bg-black/50 rounded-xl leading-relaxed">
                                            {buildTelegramText(items)}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 py-2">
                                        <div className="relative bg-white shadow-2xl rounded-sm overflow-hidden border border-gray-200" style={{ width: '240px', height: '320px' }}>
                                            {busy.png && !pngDataUrl ? (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                </div>
                                            ) : pngDataUrl ? (
                                                <img src={pngDataUrl} alt="Preview" className="w-full h-full object-contain" />
                                            ) : null}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 p-2 rounded-2xl">
                            <span className="text-xs font-bold uppercase tracking-wider ml-2 opacity-60">Формат</span>
                            <div className="flex bg-white/40 dark:bg-black/40 p-1 rounded-xl border border-white/20">
                                <button
                                    onClick={() => setExportMode("text")}
                                    className={`px-4 py-1.5 rounded-lg text-xs transition-all ${exportMode === "text" ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md font-bold" : "text-gray-600 dark:text-gray-400"}`}
                                >
                                    Text
                                </button>
                                <button
                                    onClick={() => setExportMode("image")}
                                    className={`px-4 py-1.5 rounded-lg text-xs transition-all ${exportMode === "image" ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md font-bold" : "text-gray-600 dark:text-gray-400"}`}
                                >
                                    Image
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => {
                                    setShowPreview(!showPreview);
                                    setIsExportExpanded(true);
                                }}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-3xl bg-[#5a2d3d] text-white shadow-lg active:scale-95 transition-all`}
                            >
                                <span className="text-xl">👁️</span>
                                <span className="text-[9px] font-bold uppercase">Превью</span>
                            </button>

                            <button
                                onClick={handleShare}
                                disabled={busy.png && exportMode === "image"}
                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl bg-[#5a2d3d] text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
                            >
                                {busy.png && exportMode === "image" ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : <span className="text-xl">📤</span>}
                                <span className="text-[9px] font-bold uppercase">Отправить</span>
                            </button>

                            <button
                                onClick={copyToClipboard}
                                disabled={busy.copy}
                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl bg-[#5a2d3d] text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
                            >
                                <span className="text-xl">{busy.copy ? "⌛" : "📋"}</span>
                                <span className="text-[9px] font-bold uppercase">Копия</span>
                            </button>
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
                            backgroundImage: `url(${wineBgPreview})`,

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
