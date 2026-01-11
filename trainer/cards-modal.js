const STYLE_ID = 'card-editor-modal-styles';
const TEMPLATE_ID = 'card-editor-template';

const STYLE_CONTENT = `
#cardEditorBackdrop { position: fixed; inset: 0; background: rgba(60,40,20,.45); display: none; align-items: center; justify-content: center; padding: 16px; z-index: 999 }
#cardEditorBackdrop.show { display: flex }
#cardEditorBackdrop .modal { width: min(960px, 100%); max-height: min(92vh, 860px); display: flex; flex-direction: column; box-shadow: var(--shadow-lg) }
#cardEditorBackdrop .modal header { display: flex; align-items: center; justify-content: space-between; gap: 12px }
#cardEditorBackdrop .modal .content { flex: 1 1 auto; overflow: auto; display: flex; flex-direction: column; gap: 16px }

/* Плавность визуально */
.card-editor-fields input[type="text"]{ transition: width .15s ease; }
.card-editor-fields textarea{ overflow:hidden; resize:none; }

.card-editor-fields{
  display:grid;
  gap:12px 14px;
  grid-template-columns: repeat(3, minmax(260px,1fr));
}
@media (max-width: 1400px){
  .card-editor-fields{ grid-template-columns: repeat(2, minmax(260px,1fr)); }
}
@media (max-width: 680px){
  .card-editor-fields{ grid-template-columns: 1fr; }
}


/* Элементы поля остаются вертикальными, но занимают ячейку сетки */
.card-editor-fields .row{ display:flex; flex-direction:column; gap:6px }

/* Компактные контролы */
.card-editor-fields input[type="text"],
.card-editor-fields input[type="password"],
.card-editor-fields textarea,
.card-editor-fields select{ padding:8px 10px; border-radius:10px; border:1px solid var(--border); background:#fffdf7 }


/* Высота мультиселектов чуть меньше */
.card-editor-multi select{ min-height:100px }

/* Растягиваем «большие» поля на всю ширину гридов */
.card-editor-fields .row:has(#ce-contains),
.card-editor-fields .row:has(#ce-features),
.card-editor-fields .row:has(#ce-ru-desc),
.card-editor-fields .row:has(#ce-en-desc),
.card-editor-fields .row:has(#ce-raw-html),
.card-editor-fields .row:has(#ce-html){ grid-column: 1 / -1; }

/* Панель действий прилипает к низу */
.card-editor-actions{ display:flex; align-items:center; justify-content:flex-end; gap:8px }
.card-editor-actions .card-editor-status{ margin-right:auto; padding-right:12px; font-size:13px; color:var(--muted) }

/* Узкие экраны */
@media (max-width: 600px){
  #cardEditorBackdrop { padding: 12px }
  #cardEditorBackdrop .modal { width: min(360px, 100%); max-height: 96vh }
}
#cardEditorBackdrop .card-editor-fields textarea,
#cardEditorBackdrop .card-editor-fields input[type="text"] {
  width: 100% !important;
  white-space: pre-wrap !important;   /* пробелы сохраняются */
  overflow-wrap: anywhere !important; /* длинные слова переносятся при нужде */
  word-break: normal !important;      /* не лезем внутрь слов без причины */
}

`;


const TEMPLATE_CONTENT = `
<div class="backdrop" id="cardEditorBackdrop" role="dialog" aria-modal="true" aria-hidden="true">
  <div class="modal card-editor-modal" role="document">
    <header>
      <h2 id="cardEditorTitle">Карточка меню</h2>
      <button type="button" class="ghost" id="cardEditorClose">Закрыть</button>
    </header>
    <div class="content">
      <div class="row">
        <label for="cardEditorMode">Режим</label>
        <select id="cardEditorMode">
          <option value="new" selected>Создать новую карточку</option>
          <option value="edit">Редактировать существующую</option>
        </select>
      </div>
      <div class="row" id="cardEditorSelectRow" style="display:none;">
        <label for="cardEditorSelect">Выберите карточку</label>
        <select id="cardEditorSelect"></select>
      </div>
      <div class="row" id="cardEditorTokenRow">
        <label>GitHub (owner/repo · ветка · токен)</label>
        <div class="card-editor-github" style="display:grid; gap:6px; grid-template-columns: repeat(auto-fit, minmax(140px,1fr));">
          <input type="text" id="cardEditorOwner" placeholder="owner" />
          <input type="text" id="cardEditorRepo" placeholder="repo" />
          <input type="text" id="cardEditorBranch" placeholder="branch" />
          <input type="password" id="cardEditorToken" placeholder="token" autocomplete="off" />
        </div>
      </div>
      <div class="card-editor-fields" id="cardEditorFields"></div>
    </div>
    <div class="card-editor-actions">
      <span class="card-editor-status" id="cardEditorStatus"></span>
      <button type="button" class="ghost" id="cardEditorCancel">Отмена</button>
      <button type="button" class="primary" id="cardEditorSave">Сохранить</button>
    </div>
  </div>
</div>
`;

function ensureStyles(){
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_CONTENT;
  document.head.appendChild(style);
}

function ensureTemplate(){
  if (document.getElementById('cardEditorBackdrop')) return;
  const tpl = document.createElement('template');
  tpl.id = TEMPLATE_ID;
  tpl.innerHTML = TEMPLATE_CONTENT;
  document.body.appendChild(tpl.content.cloneNode(true));
}

function ready(fn){
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function initCardEditor(){
  if (window.__cardEditorModalInitialized) return;
  const utils = window.__cardEditorUtils || {};
  const {
    createEmptyCard,
    normalizeCardData,
    serializeCardData,
    getValueByPath,
    setValueByPath,
    collectOptionValues,
    cloneCardData,
    rebuildCardsFromEditorData
  } = utils;

  if (!createEmptyCard || !cloneCardData) return;

  function measureTextWidth(el, text){
  const span = document.createElement('span');
  const cs = getComputedStyle(el);
  span.style.visibility = 'hidden';
  span.style.position = 'absolute';
  span.style.whiteSpace = 'pre-wrap';
  span.style.font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
  span.textContent = text || el.placeholder || '';
  const raw = (text ?? el.placeholder ?? '');
  const probe = /\s$/.test(raw) ? raw + '\u00A0' : raw; // добавляем NBSP, если строка оканчивается пробелом
  span.textContent = probe;
  document.body.appendChild(span);
  const w = span.offsetWidth;
  document.body.removeChild(span);
  return w;
}

function fitWidthInColumn(el, wrapper, needPx){
  // ширина ТЕКУЩЕЙ колонки — предел
  const max = Math.floor(wrapper.getBoundingClientRect().width || 600);
  el.style.width = Math.min(max, Math.ceil(needPx)) + 'px';
}

function autosizeTextLikeInput(el) {
  el.style.width = '100%';
  el.style.whiteSpace = 'pre-wrap';
  el.style.overflowWrap = 'anywhere';
  el.style.wordBreak = 'normal';
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function autosizeTextarea(el, wrapper){
  const cs = getComputedStyle(el);
  const box = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
            + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  const extra = 28;
  const lines = (el.value || '').split('\n');
  const longest = lines.reduce((m,l)=> Math.max(m, measureTextWidth(el, l)), 0);
  const need = longest + box + extra;
  fitWidthInColumn(el, wrapper, need);
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function bindAutosize(el, wrapper, kind){
  const fn = () => {
    if (kind === 'input-like') autosizeTextLikeInput(el, wrapper);
    else autosizeTextarea(el, wrapper);
  };
  el.addEventListener('input', fn);
  requestAnimationFrame(fn);
}

  const openBtn = document.getElementById('btnCardEditor');
  const backdrop = document.getElementById('cardEditorBackdrop');
  const select = document.getElementById('cardEditorSelect');
  const fieldsContainer = document.getElementById('cardEditorFields');
  const statusEl = document.getElementById('cardEditorStatus');
  const saveBtn = document.getElementById('cardEditorSave');
  const cancelBtn = document.getElementById('cardEditorCancel');
  const closeBtn = document.getElementById('cardEditorClose');
  const ownerInput = document.getElementById('cardEditorOwner');
  const repoInput = document.getElementById('cardEditorRepo');
  const branchInput = document.getElementById('cardEditorBranch');
  const tokenInput = document.getElementById('cardEditorToken');
  const titleEl = document.getElementById('cardEditorTitle');

  const modeSelect = document.getElementById('cardEditorMode');
  const selectRow = document.getElementById('cardEditorSelectRow');

  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      const mode = modeSelect.value;
      if (mode === 'edit') {
        selectRow.style.display = '';
        populateSelect();
      } else {
        selectRow.style.display = 'none';
        loadCardById('__new__');
      }
    });
  }

  if (!openBtn || !backdrop || !select || !fieldsContainer || !saveBtn) return;

  window.__cardEditorModalInitialized = true;

  const DEFAULT_OWNER = 'witek746653-maker';
  const DEFAULT_REPO = 'Menu';
  const DEFAULT_BRANCH = 'main';
  const FILE_PATH = 'trainer/cards.json';
  const LS_KEYS = {
    selection: 'cardEditor:lastSelection',
    owner: 'cardEditor:owner',
    repo: 'cardEditor:repo',
    branch: 'cardEditor:branch',
    token: 'cardEditor:token'
  };

  const FIELD_DEFS = [
    { id:'ce-id', label:'ID', path:['id'], type:'text', showOn:'desktop' },
    { id:'ce-menu', label:'Меню', path:['menu'], type:'text', showOn:'all', placeholder:'Например, Основное меню' },
    { id:'ce-section', label:'Раздел', path:['section'], type:'text', showOn:'all', placeholder:'Например, Закуски' },
    { id:'ce-section-icon-type', label:'Иконка раздела · type', path:['section_icon','type'], type:'text', showOn:'desktop' },
    { id:'ce-section-icon-src', label:'Иконка раздела · src', path:['section_icon','src'], type:'text', showOn:'desktop' },
    { id:'ce-section-icon-alt', label:'Иконка раздела · alt', path:['section_icon','alt'], type:'text', showOn:'desktop' },
    { id:'ce-title', label:'Название', path:['title'], type:'text', showOn:'all', placeholder:'Название блюда' },
    { id:'ce-description', label:'Описание', path:['description'], type:'textarea', rows:3, showOn:'all' },
    { id:'ce-contains', label:'Состав (contains)', path:['contains'], type:'textarea', rows:3, showOn:'all' },
    { id:'ce-features', label:'Особенности (fitures)', path:['fitures'], type:'textarea', rows:3, showOn:'all' },
    { id:'ce-allergens', label:'Аллергены', path:['allergens'], type:'list', rows:4, showOn:'all', placeholder:'Каждый аллерген — с новой строки' },
    { id:'ce-tags', label:'Теги', path:['tags'], type:'multi', showOn:'desktop', optionsPath:'tags' },
    { id:'ce-pair-wines', label:'Pairings · вина', path:['pairings','wines'], type:'multi', showOn:'desktop', optionsPath:'pairings.wines' },
    { id:'ce-pair-add', label:'Pairings · add_ingrid', path:['pairings','add_ingrid'], type:'multi', showOn:'desktop', optionsPath:'pairings.add_ingrid' },
    { id:'ce-pair-upsell', label:'Pairings · upsell', path:['pairings','upsell'], type:'multi', showOn:'desktop', optionsPath:'pairings.upsell' },
    { id:'ce-image-src', label:'Изображение · src', path:['image','src'], type:'text', showOn:'all', placeholder:'images/...' },
    { id:'ce-image-alt', label:'Изображение · alt', path:['image','alt'], type:'text', showOn:'desktop' },
    { id:'ce-ru-title', label:'Название (ru)', path:['i18n','ru','title'], type:'text', showOn:'desktop' },
    { id:'ce-ru-desc', label:'Описание (ru)', path:['i18n','ru','description'], type:'textarea', rows:3, showOn:'desktop' },
    { id:'ce-en-title', label:'Название (en)', path:['i18n','en','title'], type:'text', showOn:'desktop' },
    { id:'ce-en-desc', label:'Описание (en)', path:['i18n','en','description'], type:'textarea', rows:3, showOn:'desktop' },
    { id:'ce-status', label:'Статус', path:['status'], type:'select', showOn:'desktop', options:['draft','in_review','published','archived'] },
    { id:'ce-source', label:'Source file', path:['source_file'], type:'text', showOn:'desktop' },
    { id:'ce-raw-html', label:'Raw HTML', path:['raw_html'], type:'textarea', rows:6, showOn:'desktop' },
    { id:'ce-html', label:'HTML (legacy)', path:['html'], type:'textarea', rows:6, showOn:'desktop' }
  ];

  let fieldControls = [];
  let titleControl = null;
  let idControl = null;
  let autoGeneratedId = '';
  let currentCard = null;
  let isOpen = false;

  function persistSetting(key, value){
    try { localStorage.setItem(key, value); } catch(e){}
  }

  function loadSettings(){
    ownerInput && (ownerInput.value = localStorage.getItem(LS_KEYS.owner) || DEFAULT_OWNER);
    repoInput && (repoInput.value = localStorage.getItem(LS_KEYS.repo) || DEFAULT_REPO);
    branchInput && (branchInput.value = localStorage.getItem(LS_KEYS.branch) || DEFAULT_BRANCH);
    tokenInput && (tokenInput.value = localStorage.getItem(LS_KEYS.token) || '');
  }

  [ownerInput, repoInput, branchInput].forEach((input, idx) => {
    if (!input) return;
    const key = idx === 0 ? LS_KEYS.owner : idx === 1 ? LS_KEYS.repo : LS_KEYS.branch;
    input.addEventListener('input', () => persistSetting(key, input.value.trim()));
  });
  if (tokenInput){
    tokenInput.addEventListener('input', () => persistSetting(LS_KEYS.token, tokenInput.value.trim()));
  }

  const toArray = (value) => Array.isArray(value) ? value : (value ? String(value).split(/[,\n;]/).map(v=>v.trim()).filter(Boolean) : []);

  function isDesktop(){
    return window.innerWidth >= 768;
  }

  function activeFields(){
    return FIELD_DEFS.filter(field => field.showOn === 'all' || (field.showOn === 'desktop' && isDesktop()) || (field.showOn === 'mobile' && !isDesktop()));
  }

  function addOption(selectEl, value, selectIt){
    const val = String(value || '').trim();
    if (!val) return;
    const existing = Array.from(selectEl.options).find(opt => opt.value === val);
    if (existing){
      if (selectIt) existing.selected = true;
      return;
    }
    const option = new Option(val, val, selectIt, selectIt);
    selectEl.add(option);
  }

  function createControl(field){
  const wrapper = document.createElement('div');
  wrapper.className = 'row';

  const label = document.createElement('label');
  label.htmlFor = field.id;
  label.textContent = field.label;
  wrapper.appendChild(label);

  const control = { field, path: field.path, wrapper, input: null, setValue: () => {}, getValue: () => '' };
  let input;

  // text → псевдо-input на textarea (автоширина+автовысота)
  // text → псевдо-input на textarea (автоширина+автовысота)
  if (field.type === 'text') {
  input = document.createElement('textarea');
  input.id = field.id;
  input.rows = 1;
  input.setAttribute('wrap', 'soft');
  input.style.whiteSpace = 'pre-wrap';
  input.style.overflowWrap = 'anywhere';
  input.style.wordBreak = 'normal';
  if (field.placeholder) input.placeholder = field.placeholder;

  bindAutosize(input, wrapper, 'input-like');

  control.setValue = (value) => { input.value = value ?? ''; input.dispatchEvent(new Event('input')); };
  control.getValue  = () => input.value; // без trim(), пробелы сохраняются
  control.input = input;
  wrapper.appendChild(input);

} else if (field.type === 'textarea') {
  input = document.createElement('textarea');
  input.id = field.id;
  input.setAttribute('wrap', 'soft');
  input.style.whiteSpace = 'pre-wrap';
  input.style.overflowWrap = 'anywhere';
  input.style.wordBreak = 'normal';
  input.rows = field.rows || 4;
  if (field.placeholder) input.placeholder = field.placeholder;

  bindAutosize(input, wrapper, 'textarea');

  control.setValue = (value) => { input.value = value ?? ''; input.dispatchEvent(new Event('input')); };
  control.getValue  = () => input.value;
  control.input = input;
  wrapper.appendChild(input);

} else if (field.type === 'list') {
  input = document.createElement('textarea');
  input.style.whiteSpace = 'pre-wrap';
  input.id = field.id;
  input.rows = field.rows || 4;
  input.placeholder = field.placeholder || 'Каждое значение с новой строки';

  bindAutosize(input, wrapper, 'textarea');

  control.setValue = (value) => {
    input.value = Array.isArray(value) ? value.join('\n') : (value || '');
    input.dispatchEvent(new Event('input'));
  };
  control.getValue = () => input.value.split(/\n+/).map(v => v.trim()).filter(Boolean);
  control.input = input;
  wrapper.appendChild(input);

} else if (field.type === 'multi') {
  const container = document.createElement('div');
  container.className = 'card-editor-multi';

  input = document.createElement('select');
  input.id = field.id;
  input.multiple = true;
  container.appendChild(input);

  const addWrap = document.createElement('div');
  addWrap.className = 'multi-add';
  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.placeholder = 'Новое значение';
  bindAutosize(addInput, addWrap, 'input-like');

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'ghost';
  addBtn.textContent = 'Добавить';
  addBtn.addEventListener('click', () => {
    const val = addInput.value.trim();
    if (!val) return;
    addOption(input, val, true);
    addInput.value = '';
  });

  addWrap.append(addInput, addBtn);
  container.appendChild(addWrap);

  control.setValue = (value) => {
    const values = Array.isArray(value) ? value.filter(Boolean) : [];
    values.forEach(v => addOption(input, v, false));
    Array.from(input.options).forEach(opt => { opt.selected = values.includes(opt.value); });
  };
  control.getValue = () => Array.from(input.selectedOptions).map(opt => opt.value).filter(Boolean);
  control.input = input;
  wrapper.appendChild(container);

} else if (field.type === 'select') {
  input = document.createElement('select');
  input.id = field.id;
  input.innerHTML = '<option value="">— выбрать —</option>';
  (field.options || []).forEach(opt => addOption(input, opt, false));
  control.setValue = (value) => { input.value = value ?? ''; };
  control.getValue = () => input.value;
  control.input = input;
  wrapper.appendChild(input);
}                         // ← конец ветки select

return control;           // ← единый возврат для всех веток
}                         // ← КОНЕЦ функции createControl


  function renderFields(){
    fieldsContainer.innerHTML = '';
    fieldControls = [];
    titleControl = null;
    idControl = null;
    activeFields().forEach(field => {
      const control = createControl(field);
      fieldControls.push(control);
      fieldsContainer.appendChild(control.wrapper);
      const key = field.path.join('.');
      if (key === 'title') titleControl = control;
      if (key === 'id') idControl = control;
      if (field.type === 'multi' && field.optionsPath){
        const pathArr = Array.isArray(field.optionsPath)
          ? field.optionsPath
          : String(field.optionsPath).split('.').filter(Boolean);
        const options = collectOptionValues(window.__cardEditorCards || [], pathArr);
        options.forEach(opt => addOption(control.input, opt, false));
      }
    });
  }

  function setStatus(message, type){
    if (!statusEl) return;
    statusEl.textContent = message || '';
    let color = 'var(--muted)';
    if (type === 'error') color = '#ff7a7a';
    else if (type === 'success') color = '#8acb88';
    statusEl.style.color = color;
  }

  function setBusy(flag){
    const controls = backdrop.querySelectorAll('input, textarea, select, button');
    controls.forEach(el => { if (el !== saveBtn) el.disabled = flag; });
    saveBtn.disabled = flag;
  }

  function bindAutoId(shouldBind){
    if (!titleControl || !idControl) return;
    if (titleControl._listener){
      titleControl.input.removeEventListener('input', titleControl._listener);
      titleControl._listener = null;
    }
    if (!shouldBind) return;
    autoGeneratedId = idControl.getValue();
    const handler = () => {
      const current = idControl.getValue();
      if (!current || current === autoGeneratedId){
        const next = idFromTitle(titleControl.getValue ? titleControl.getValue() : titleControl.input.value || '');
        autoGeneratedId = next;
        idControl.setValue(next);
      }
    };
    titleControl.input.addEventListener('input', handler);
    titleControl._listener = handler;
  }

  function fillForm(card){
    fieldControls.forEach(control => {
      const value = getValueByPath(card, control.path);
      if (control.field.type === 'list' || control.field.type === 'multi'){
        control.setValue(Array.isArray(value) ? value : toArray(value));
      } else {
        control.setValue(value ?? '');
      }
    });
  }

  function profileDefaults(){
    const prof = window.profile || {};
    const out = {};
    if (prof.menu && prof.menu !== 'Всё меню') out.menu = prof.menu;
    if (prof.section && prof.section !== '__ALL__') out.section = prof.section;
    return out;
  }

  function loadCardById(cardId){
    const data = window.__cardEditorCards || [];
    let card = null;
    if (cardId && cardId !== '__new__'){
      card = data.find(c => c.id === cardId) || null;
    }
    const isNew = !card;
    currentCard = card;
    const base = isNew ? Object.assign(createEmptyCard(), profileDefaults()) : cloneCardData(card);
    const headerParts = [];
    if (!isNew){
      if (card.title) headerParts.push(card.title);
      if (card.menu) headerParts.push(card.menu);
      if (card.section) headerParts.push(card.section);
    }
    titleEl.textContent = isNew ? 'Новая карточка' : (headerParts.join(' • ') || 'Редактирование карточки');
    fillForm(base);
    bindAutoId(isNew);
    setStatus('', 'info');
  }

  function populateSelect(preferredId){
    const data = window.__cardEditorCards || [];
    select.innerHTML = '';
    const newOption = new Option('— Новая карточка —','__new__');
    select.add(newOption);
    data.forEach(card => {
      const labelParts = [card.title || card.id || 'Без названия'];
      if (card.section) labelParts.push(card.section);
      const option = new Option(labelParts.join(' • '), card.id || '');
      select.add(option);
    });
    const stored = localStorage.getItem(LS_KEYS.selection);
    let value = preferredId || stored;
    const hasValue = value && (value === '__new__' || data.some(c => c.id === value));
    if (!hasValue){
      const queueId = Array.isArray(window.queue) && window.queue.length ? window.queue[0] : null;
      value = queueId && data.some(c => c.id === queueId) ? queueId : (data[0]?.id || '__new__');
    }
    select.value = value || '__new__';
    loadCardById(select.value);
  }

  function collectFormValues(){
    const base = currentCard ? cloneCardData(currentCard) : createEmptyCard();
    fieldControls.forEach(control => {
      const value = control.getValue();
      if (control.field.type === 'list' || control.field.type === 'multi'){
        setValueByPath(base, control.path, Array.isArray(value) ? value : []);
      } else {
        setValueByPath(base, control.path, typeof value === 'string' ? value : '');
      }
    });
    if (!base.html && base.raw_html) base.html = base.raw_html;
    if (!base.raw_html && base.html) base.raw_html = base.html;
    base.imageSrc = base.image?.src || base.imageSrc || '';
    return base;
  }

  function encodeBase64(text){
    if (window.TextEncoder){
      const bytes = new TextEncoder().encode(text);
      let binary = '';
      bytes.forEach(b => { binary += String.fromCharCode(b); });
      return btoa(binary);
    }
    return btoa(unescape(encodeURIComponent(text)));
  }

    // 1) ДОБАВЬ это рядом с saveToGitHub (в той же области видимости)
  async function loadCards(){
    const owner = (ownerInput?.value || DEFAULT_OWNER).trim() || DEFAULT_OWNER;
    const repo = (repoInput?.value || DEFAULT_REPO).trim() || DEFAULT_REPO;
    const branch = (branchInput?.value || DEFAULT_BRANCH).trim() || DEFAULT_BRANCH;
    const token = (tokenInput?.value || '').trim();
    const baseHeaders = { 'Accept': 'application/vnd.github+json' };
    if (token) baseHeaders['Authorization'] = `Bearer ${token}`;

    // ВАЖНО: проверь путь. Сейчас стоит trainer/cards.json
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${FILE_PATH}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(apiUrl, { headers: baseHeaders });
    if (!res.ok){
      const text = await res.text();
      throw new Error(`Не удалось загрузить cards.json: ${text || res.statusText}`);
    }
    const json = await res.json();
    const decoded = new TextDecoder('utf-8').decode(
      Uint8Array.from(atob(json.content.replace(/\n/g, '')), c => c.charCodeAt(0))
    );
    let data = JSON.parse(decoded);

    // на вход ожидается массив
    if (!Array.isArray(data)) throw new Error('cards.json должен быть массивом объектов');

    // нормализуем через утилиту, если есть
    const norm = (window.__cardEditorUtils?.normalizeCardData) || (x => x);
    window.__cardEditorCards = data.map(norm);
    return window.__cardEditorCards;
  }

  // 2) ПРАВКА openModal: гарантируем загрузку и первичную инициализацию списка
  async function openModal(preferredId){
    if (isOpen) return;
    try {
      if (!Array.isArray(window.__cardEditorCards) || window.__cardEditorCards.length === 0){
        await loadCards();
      }
    } catch(e){
      console.error('Card load error', e);
      setStatus('Не удалось загрузить cards.json', 'error');
      return;
    }
    renderFields();
    loadSettings();

    // если уже выбран режим Редактировать — сразу наполняем селект
    if (document.getElementById('cardEditorMode')?.value === 'edit') {
      populateSelect(preferredId);
    } else {
      loadCardById('__new__');
    }

    backdrop.classList.add('show');
    backdrop.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    isOpen = true;
    document.addEventListener('keydown', onKeydown);
  }

  // 3) ПРАВКА обработчика смены режима: сначала грузим, потом populateSelect
  if (modeSelect) {
    modeSelect.addEventListener('change', async () => {
      const mode = modeSelect.value;
      if (mode === 'edit') {
        selectRow.style.display = '';
        if (!Array.isArray(window.__cardEditorCards) || window.__cardEditorCards.length === 0){
          try { await loadCards(); } catch(e){ setStatus(e.message, 'error'); return; }
        }
        populateSelect();
      } else {
        selectRow.style.display = 'none';
        loadCardById('__new__');
      }
    });
  }


  async function saveToGitHub(cards, focusId){
    if (!tokenInput) throw new Error('Нет поля для токена');
    const owner = (ownerInput?.value || DEFAULT_OWNER).trim() || DEFAULT_OWNER;
    const repo = (repoInput?.value || DEFAULT_REPO).trim() || DEFAULT_REPO;
    const branch = (branchInput?.value || DEFAULT_BRANCH).trim() || DEFAULT_BRANCH;
    const token = tokenInput.value.trim();
    if (!token) throw new Error('Укажите GitHub токен');

    const serialized = cards.map(serializeCardData);
    const payload = JSON.stringify(serialized, null, 2);
    const content = encodeBase64(payload);
    const baseHeaders = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`
    };
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${FILE_PATH}`;
    let sha = '';
    try {
      const infoUrl = branch ? `${apiUrl}?ref=${encodeURIComponent(branch)}` : apiUrl;
      const infoRes = await fetch(infoUrl, { headers: baseHeaders });
      if (infoRes.ok){
        const info = await infoRes.json();
        sha = info.sha;
      } else if (infoRes.status !== 404){
        const text = await infoRes.text();
        throw new Error(text || infoRes.statusText);
      }
    } catch(e){
      throw new Error('Не удалось получить данные файла: ' + (e.message || e));
    }

    const body = {
      message: `Update cards.json (${focusId})`,
      content,
      branch: branch || undefined
    };
    if (sha) body.sha = sha;

    const saveRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: Object.assign({'Content-Type':'application/json'}, baseHeaders),
      body: JSON.stringify(body)
    });
    if (!saveRes.ok){
      const text = await saveRes.text();
      throw new Error(text || saveRes.statusText);
    }

    window.__cardEditorCards = serialized.map(normalizeCardData);
    await rebuildCardsFromEditorData();
    persistSetting(LS_KEYS.selection, focusId);
  }

  async function handleSave(){
    try {
      setStatus('Сохраняем изменения...', 'info');
      setBusy(true);
      const draft = collectFormValues();
      draft.title = (draft.title || '').trim();
      draft.id = (draft.id || '').trim();
      draft.menu = (draft.menu || '').trim();
      draft.section = (draft.section || '').trim();
      if (!draft.title){
        throw new Error('Заполните название блюда');
      }
      if (!draft.id){
        draft.id = idFromTitle(draft.title);
        if (idControl) idControl.setValue(draft.id);
        autoGeneratedId = draft.id;
      }
      if (!draft.menu){
        throw new Error('Укажите меню для карточки');
      }
      const data = Array.isArray(window.__cardEditorCards) ? window.__cardEditorCards.slice() : [];
      const existingIndex = currentCard ? data.findIndex(c => c.id === currentCard.id) : -1;
      if (data.some((c, idx) => c.id === draft.id && idx !== existingIndex)){
        throw new Error('ID уже используется другой карточкой');
      }
      if (existingIndex >= 0){
        data[existingIndex] = draft;
      } else {
        data.push(draft);
      }
      await saveToGitHub(data, draft.id);
      setStatus('Изменения сохранены', 'success');
      closeModal();
    } catch(e){
      console.error('Card save error', e);
      setStatus(e.message || 'Не удалось сохранить изменения', 'error');
    } finally {
      setBusy(false);
    }
  }

  function onKeydown(e){
    if (e.key === 'Escape'){
      e.preventDefault();
      closeModal();
    }
  }

  async function openModal(preferredId){
    if (isOpen) return;
    try {
      if (!Array.isArray(window.__cardEditorCards)){
        await loadCards();
      }
    } catch(e){
      console.error('Card load error', e);
      setStatus('Не удалось загрузить cards.json', 'error');
      return;
    }
    renderFields();
    loadSettings();
    if (document.getElementById('cardEditorMode')?.value === 'edit') {
  populateSelect(preferredId);
}
    backdrop.classList.add('show');
    backdrop.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    isOpen = true;
    document.addEventListener('keydown', onKeydown);
  }

  function closeModal(){
    if (!isOpen) return;
    isOpen = false;
    bindAutoId(false);
    backdrop.classList.remove('show');
    backdrop.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    setStatus('', 'info');
    document.removeEventListener('keydown', onKeydown);
  }

  select.addEventListener('change', () => {
    const value = select.value || '__new__';
    persistSetting(LS_KEYS.selection, value);
    loadCardById(value);
  });

  saveBtn.addEventListener('click', handleSave);
  cancelBtn?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
  openBtn.addEventListener('click', () => {
    const preferred = Array.isArray(window.queue) && window.queue.length ? window.queue[0] : null;
    openModal(preferred);
  });

  window.addEventListener('resize', () => {
    if (!isOpen) return;
    const selected = select.value;
    renderFields();
    loadCardById(selected);
  });
}

ready(() => {
  ensureStyles();
  ensureTemplate();
  initCardEditor();
});

