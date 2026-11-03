/* =========================================================
   ADD SECTION MODAL (chọn loại section khi thêm mới)
   ========================================================= */
let addSectionModal = null;
/* customType: site (site-js/strapi-content.js, CUSTOM_RENDER) dựng khối theo
   khoá này — section tự thêm không có sẵn trong HTML của site. */
const CUSTOM_SECTION_TYPES = [
  {type:'tournaments', label:'Danh sách giải đấu', icon:'ti-trophy', desc:'Tích hợp API danh sách giải đấu (chỉ đọc) — chỉ cấu hình tiêu đề',
    build:(key,label)=>({key, label, custom:true, customType:'tournaments', apiIntegrated:true, title:label})},
  {type:'players', label:'Người chơi', icon:'ti-users', desc:'Tích hợp API danh sách hội viên / VĐV — chỉ cấu hình tiêu đề',
    build:(key,label)=>({key, label, custom:true, customType:'players', apiIntegrated:true, title:label})},
  {type:'news', label:'Tin tức', icon:'ti-news', desc:'Chọn & sắp xếp tin tức, hoặc tự động lấy tin mới nhất',
    build:(key,label)=>({key, label, custom:true, customType:'news', newsPicker:true, title:label})},
  {type:'text', label:'Văn bản', icon:'ti-align-left', desc:'Khối nội dung tự do, soạn thảo dạng rich text',
    build:(key,label)=>({key, label, custom:true, customType:'text', fields:[{key:'body', label:'Nội dung', type:'textarea', span2:true}]})},
  /* Ảnh lưu theo ngôn ngữ như các ô khác (content / i18n.en.content); site chọn
     ảnh thay thế khi thiếu — xem heroImages() trong site-js/page-config.js. */
  {type:'hero', label:'Hero image', icon:'ti-photo', desc:'Ảnh banner lớn, ảnh riêng cho desktop / mobile và tiếng Việt / tiếng Anh',
    build:(key,label)=>({key, label, custom:true, customType:'hero', heroImage:true, noBackground:true, fields:[
      {key:'desktop', label:'Ảnh desktop', type:'image'},
      {key:'mobile', label:'Ảnh mobile', type:'image'}
    ]})}
];
function openAddSectionModal(pageKey){
  editingCollection = null; editingId = null; pageModal = null;
  addSectionModal = {pageKey, type:'text', label:''};
  document.getElementById('modalTitle').textContent = 'Thêm section mới';
  document.getElementById('modalDeleteBtn').style.display = 'none';
  renderAddSectionModalBody();
  document.getElementById('modalOverlay').classList.add('on');
}
function renderAddSectionModalBody(){
  const body = document.getElementById('modalBody');
  const cards = CUSTOM_SECTION_TYPES.map(t=>`
    <div class="sec-type-card ${addSectionModal.type===t.type?'on':''}" data-section-type="${t.type}">
      <i class="ti ${t.icon}"></i>
      <div>
        <div class="sec-type-title">${t.label}</div>
        <div class="sec-type-desc">${t.desc}</div>
      </div>
    </div>`).join('');
  /* Section có sẵn của trang mà admin đã xoá: cho thêm lại từ đây, site hiện
     lại khối đó (site chỉ ẩn khối có sẵn khi nó không còn trong danh sách). */
  const removed = removedBuiltInSections(addSectionModal.pageKey);
  const restoreCards = removed.map(s=>`
    <div class="sec-type-card ${addSectionModal.type==='restore:'+s.key?'on':''}" data-section-type="restore:${escapeAttr(s.key)}">
      <i class="ti ti-arrow-back-up"></i>
      <div>
        <div class="sec-type-title">${escapeHtml(s.label)}</div>
        <div class="sec-type-desc">Section có sẵn của trang, đã bị xóa</div>
      </div>
    </div>`).join('');
  const restoring = addSectionModal.type.startsWith('restore:');
  body.innerHTML = `
    <div class="sec-detail-group-label" style="margin-bottom:10px">Loại section</div>
    <div class="sec-type-grid">${cards}</div>
    ${removed.length ? `<div class="sec-detail-group-label" style="margin:18px 0 10px">Thêm lại section có sẵn</div><div class="sec-type-grid">${restoreCards}</div>` : ''}
    ${restoring ? '' : `<div class="fld" style="margin-top:18px"><label>Tên section <span class="req">*</span></label><input type="text" id="addSectionLabel" value="${escapeAttr(addSectionModal.label)}" placeholder="VD: Giải đấu nổi bật"></div>`}
  `;
  document.querySelectorAll('[data-section-type]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const labelInput = document.getElementById('addSectionLabel');
      if(labelInput) addSectionModal.label = labelInput.value;
      addSectionModal.type = el.getAttribute('data-section-type');
      renderAddSectionModalBody();
      const input = document.getElementById('addSectionLabel');
      if(input) input.focus();
    });
  });
}
function removedBuiltInSections(pageKey){
  const builtIn = (PAGE_SECTIONS_REGISTRY[pageKey] && PAGE_SECTIONS_REGISTRY[pageKey].sections) || [];
  const present = (DB.pageSections[pageKey]||[]).map(e=>e.key);
  return builtIn.filter(s=>!present.includes(s.key));
}
function saveAddSectionModal(){
  if(addSectionModal.type.startsWith('restore:')){
    const pageKey = addSectionModal.pageKey;
    const key = addSectionModal.type.slice('restore:'.length);
    const def = getSectionDef(pageKey, key);
    if(!def){ showToast('Không tìm thấy section', true); return; }
    // Thêm vào cuối danh sách; admin dùng mũi tên để đưa về vị trí mong muốn.
    DB.pageSections[pageKey].push(makeDefaultSectionEntry(def));
    activeSectionKey = key;
    sectionEditBuffer = null;
    saveDB().then(savePageContentToApi);
    closeAddSectionModal();
    renderContent();
    showToast('Đã thêm lại section');
    return;
  }
  const label = document.getElementById('addSectionLabel').value.trim();
  if(!label){ showToast('Vui lòng nhập tên section', true); return; }
  const pageKey = addSectionModal.pageKey;
  const typeDef = CUSTOM_SECTION_TYPES.find(t=>t.type===addSectionModal.type);
  const base = slugify(label).replace(/^\//,'') || 'section';
  let key = base, i = 2;
  while(getSectionCatalog(pageKey).find(s=>s.key===key)) key = `${base}-${i++}`;
  const def = typeDef.build(key, label);

  if(!DB.customSections[pageKey]) DB.customSections[pageKey] = [];
  DB.customSections[pageKey].push(def);
  DB.pageSections[pageKey].push(makeDefaultSectionEntry(def));
  if(!DB.pageSectionKeysEverAdded[pageKey]) DB.pageSectionKeysEverAdded[pageKey] = [];
  DB.pageSectionKeysEverAdded[pageKey].push(key);

  activeSectionKey = key;
  sectionEditBuffer = null;
  saveDB().then(savePageContentToApi);
  closeAddSectionModal();
  renderContent();
  showToast('Đã thêm section mới');
}
function closeAddSectionModal(){
  addSectionModal = null;
  document.getElementById('modalOverlay').classList.remove('on');
}

