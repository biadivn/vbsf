/* =========================================================
   PAGE SECTIONS VIEW (mô phỏng)
   ========================================================= */
function renderPageSectionsView(){
  const pageKey = currentView.slice(5);
  const registry = getSectionCatalog(pageKey);
  const cfg = DB.pageSections[pageKey];

  if(!activeSectionKey || !cfg.find(s=>s.key===activeSectionKey)){
    activeSectionKey = cfg[0] ? cfg[0].key : null;
  }
  if(activeSectionKey) ensureSectionEditBuffer(pageKey, activeSectionKey);

  const listRows = cfg.map((s, idx)=>{
    const def = registry.find(r=>r.key===s.key) || {};
    const apiBadge = def.apiIntegrated ? `<i class="ti ti-api" style="color:var(--tag-purple);font-size:12px" title="Tích hợp API"></i>` : '';
    const selected = s.key===activeSectionKey ? 'selected' : '';
    return `<div class="sec-row ${selected}" data-select-section="${s.key}">
      <div class="sec-row-order">
        <button class="btn-icon" data-move-up="${idx}" ${idx===0?'disabled style="opacity:.3"':''} title="Lên"><i class="ti ti-chevron-up"></i></button>
        <button class="btn-icon" data-move-down="${idx}" ${idx===cfg.length-1?'disabled style="opacity:.3"':''} title="Xuống"><i class="ti ti-chevron-down"></i></button>
      </div>
      <span class="switch ${s.enabled?'on':''}" data-enable-input="${s.key}" title="${s.enabled?'Đang hiển thị':'Đang ẩn'}"></span>
      <span class="sec-row-label">${escapeHtml(getSectionLabel(pageKey, s.key))}</span>${apiBadge}
      <button class="btn-icon" data-rename-section="${s.key}" title="Đổi tên section" style="flex-shrink:0"><i class="ti ti-pencil"></i></button>
      <button class="btn-icon" data-remove-section="${s.key}" title="Xóa khỏi trang" style="flex-shrink:0"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join('');

  return `<div data-back-to-pages style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);cursor:pointer;margin-bottom:14px">
      <i class="ti ti-arrow-left"></i> Tất cả trang
    </div>
    ${renderPageMetaCard(pageKey)}
    <div class="sec-builder">
      <div class="card sec-list-card">
        <div class="card-head">
          <div>
            <h2>Section</h2>
            <div class="desc">${cfg.filter(s=>s.enabled).length}/${cfg.length} section đang hiển thị</div>
          </div>
        </div>
        <div class="sec-list">${listRows || '<div class="empty" style="padding:24px"><b>Chưa có section nào</b></div>'}</div>
        <div data-add-section style="padding:12px 14px;border-top:1px solid var(--line);cursor:pointer;color:var(--vg);font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px"><i class="ti ti-plus"></i> Thêm section</div>
      </div>
      <div class="card sec-detail-card" id="secDetailCard">
        ${renderSectionDetailPanel(pageKey, activeSectionKey)}
      </div>
    </div>`;
}

/* ---- Thẻ "Thông tin trang" (tên, slug, metadata) ngay trong màn hình chi tiết ---- */
let pageMetaEditBuffer = null;
function ensurePageMetaEditBuffer(pageKey){
  if(pageMetaEditBuffer && pageMetaEditBuffer.pageKey===pageKey) return;
  const meta = DB.pageMeta[pageKey] || {};
  pageMetaEditBuffer = {pageKey, values:{
    title: meta.title || getPageLabel(pageKey),
    slug: meta.slug || getPagePath(pageKey),
    metaTitle: meta.metaTitle || '',
    metaDescription: meta.metaDescription || ''
  }};
}
function renderPageMetaField(f, value){
  if(f.type==='textarea') return `<textarea id="pm_${f.key}" rows="${f.rows||3}" placeholder="${escapeAttr(f.placeholder||'')}">${escapeHtml(value||'')}</textarea>`;
  return `<input type="text" id="pm_${f.key}" value="${escapeAttr(value||'')}" placeholder="${escapeAttr(f.placeholder||'')}">`;
}
function renderPageMetaCard(pageKey){
  ensurePageMetaEditBuffer(pageKey);
  const v = pageMetaEditBuffer.values;
  const isCustom = !!DB.customPages[pageKey];
  const fieldsHtml = PAGE_META_FIELDS.map(f=>
    `<div class="fld ${f.span2?'span2':''}"><label>${f.label}${f.required?' <span class="req">*</span>':''}</label>${renderPageMetaField(f, v[f.key])}</div>`
  ).join('');
  return `<div class="card" style="margin-bottom:20px">
    <div class="card-head">
      <div>
        <h2>Thông tin trang</h2>
        <div class="desc">Tên, đường dẫn (slug) và metadata SEO của trang này</div>
      </div>
      ${isCustom ? `<button class="btn btn-danger-outline" id="pageDeleteBtn"><i class="ti ti-trash"></i> Xóa trang</button>` : ''}
    </div>
    <div class="sec-detail-group"><div class="form-grid">${fieldsHtml}</div></div>
    <div class="sec-detail-actions">
      <button class="btn btn-primary" id="pageMetaSaveBtn"><i class="ti ti-check"></i> Lưu thông tin trang</button>
    </div>
  </div>`;
}
function attachPageMetaCardEvents(pageKey){
  const saveBtn = document.getElementById('pageMetaSaveBtn');
  if(saveBtn) saveBtn.addEventListener('click', async ()=>{
    const values = {};
    PAGE_META_FIELDS.forEach(f=>{ values[f.key] = document.getElementById('pm_'+f.key).value; });
    if(!values.title.trim()){ showToast('Vui lòng nhập tên trang', true); return; }
    if(!values.slug.trim()) values.slug = slugify(values.title);
    if(!values.slug.startsWith('/')) values.slug = '/'+values.slug;
    DB.pageMeta[pageKey] = values;
    if(DB.customPages[pageKey]) DB.customPages[pageKey].label = values.title;
    pageMetaEditBuffer = null;
    await saveDB(); await savePageContentToApi();
    renderSidebar();
    renderContent();
    showToast('Đã lưu thông tin trang');
  });
  const delBtn = document.getElementById('pageDeleteBtn');
  if(delBtn) delBtn.addEventListener('click', ()=>{
    if(!confirm(`Xóa trang "${getPageLabel(pageKey)}"? Toàn bộ section của trang này cũng sẽ bị xóa. Hành động này không thể hoàn tác.`)) return;
    delete DB.customPages[pageKey];
    delete DB.customSections[pageKey];
    delete DB.pageSections[pageKey];
    delete DB.pageMeta[pageKey];
    delete DB.pageSectionKeysEverAdded[pageKey];
    pageMetaEditBuffer = null;
    saveDB().then(savePageContentToApi).then(()=>{ setView('pages'); showToast('Đã xóa trang'); });
  });
}

function attachPageSectionsEvents(){
  const pageKey = currentView.slice(5);
  const backBtn = document.querySelector('[data-back-to-pages]');
  if(backBtn) backBtn.addEventListener('click', ()=>{ pageMetaEditBuffer = null; setView('pages'); });
  attachPageMetaCardEvents(pageKey);
  document.querySelectorAll('[data-move-up]').forEach(el=>{
    el.addEventListener('click', ()=> moveSectionRow(parseInt(el.getAttribute('data-move-up'),10), -1));
  });
  document.querySelectorAll('[data-move-down]').forEach(el=>{
    el.addEventListener('click', ()=> moveSectionRow(parseInt(el.getAttribute('data-move-down'),10), 1));
  });
  document.querySelectorAll('[data-enable-input]').forEach(el=>{
    el.addEventListener('click', async ()=>{
      const s = DB.pageSections[pageKey].find(r=>r.key===el.getAttribute('data-enable-input'));
      s.enabled = !s.enabled;
      await saveDB(); await savePageContentToApi();
      renderContent();
      showToast('Đã lưu cấu hình (giả lập)');
    });
  });
  document.querySelectorAll('[data-remove-section]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      const key = el.getAttribute('data-remove-section');
      const def = getSectionDef(pageKey, key) || {};
      if(!confirm(`Xóa section "${getSectionLabel(pageKey, key)}" khỏi trang này?`)) return;
      DB.pageSections[pageKey] = DB.pageSections[pageKey].filter(s=>s.key!==key);
      if(def.custom){
        DB.customSections[pageKey] = (DB.customSections[pageKey]||[]).filter(s=>s.key!==key);
      }
      if(activeSectionKey===key){ activeSectionKey = null; sectionEditBuffer = null; }
      saveDB().then(savePageContentToApi);
      renderContent();
      showToast('Đã xóa section khỏi trang');
    });
  });
  document.querySelectorAll('[data-rename-section]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      const key = el.getAttribute('data-rename-section');
      const current = getSectionLabel(pageKey, key);
      const next = prompt('Tên section:', current);
      if(next===null) return;
      const trimmed = next.trim();
      if(!trimmed || trimmed===current) return;
      const entry = DB.pageSections[pageKey].find(s=>s.key===key);
      entry.labelOverride = trimmed;
      saveDB().then(savePageContentToApi);
      renderContent();
      showToast('Đã đổi tên section');
    });
  });
  const addSectionBtn = document.querySelector('[data-add-section]');
  if(addSectionBtn) addSectionBtn.addEventListener('click', ()=> openAddSectionModal(pageKey));
  document.querySelectorAll('[data-select-section]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      if(e.target.closest('[data-move-up],[data-move-down],[data-enable-input],[data-remove-section],[data-rename-section]')) return;
      activeSectionKey = el.getAttribute('data-select-section');
      sectionEditBuffer = null;
      renderContent();
    });
  });
  attachSectionDetailEvents(pageKey, activeSectionKey);
}

async function moveSectionRow(idx, dir){
  const pageKey = currentView.slice(5);
  const list = DB.pageSections[pageKey];
  const j = idx + dir;
  if(j<0 || j>=list.length) return;
  [list[idx], list[j]] = [list[j], list[idx]];
  await saveDB(); await savePageContentToApi();
  renderContent();
}

