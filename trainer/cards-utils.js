window.__cardEditorUtils = {
  createEmptyCard() { return { id: '', title: '', menu: '', section: '' }; },
  normalizeCardData(c) { return c; },
  serializeCardData(c) { return c; },
  getValueByPath(obj, path) { return path.reduce((o,k)=>o?.[k], obj); },
  setValueByPath(obj, path, value) {
    let o = obj;
    path.slice(0, -1).forEach(k => o = o[k] ??= {});
    o[path.at(-1)] = value;
  },
  collectOptionValues(cards, path) {
    const vals = new Set();
    cards.forEach(c => {
      const v = path.reduce((o,k)=>o?.[k], c);
      if (Array.isArray(v)) v.forEach(x => vals.add(x));
    });
    return Array.from(vals);
  },
  cloneCardData(c) { return JSON.parse(JSON.stringify(c)); },
  async rebuildCardsFromEditorData() {
    if (window.loadCards) await window.loadCards();
  }
};
