/* =========================================================
   ADD SECTION MODAL (chọn loại section khi thêm mới)
   ========================================================= */
let addSectionModal = null;
const CUSTOM_SECTION_TYPES = [
  {type:'tournaments', label:'Danh sách giải đấu', icon:'ti-trophy', desc:'Tích hợp API danh sách giải đấu (chỉ đọc) — chỉ cấu hình tiêu đề',
    build:(key,label)=>({key, label, custom:true, apiIntegrated:true, title:label})},
  {type:'players', label:'Người chơi', icon:'ti-users', desc:'Tích hợp API danh sách hội viên / VĐV — chỉ cấu hình tiêu đề',
    build:(key,label)=>({key, label, custom:true, apiIntegrated:true, title:label})},
  {type:'news', label:'Tin tức', icon:'ti-news', desc:'Chọn & sắp xếp tin tức, hoặc tự động lấy tin mới nhất',
    build:(key,label)=>({key, label, custom:true, newsPicker:true, title:label})},
  {type:'text', label:'Văn bản', icon:'ti-align-left', desc:'Khối nội dung tự do, soạn thảo dạng rich text',
    build:(key,label)=>({key, label, custom:true, fields:[{key:'body', label:'Nội dung', type:'textarea', span2:true}]})}
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
  body.innerHTML = `
    <div class="sec-detail-group-label" style="margin-bottom:10px">Loại section</div>
    <div class="sec-type-grid">${cards}</div>
    <div class="fld" style="margin-top:18px"><label>Tên section <span class="req">*</span></label><input type="text" id="addSectionLabel" value="${escapeAttr(addSectionModal.label)}" placeholder="VD: Giải đấu nổi bật"></div>
  `;
  document.querySelectorAll('[data-section-type]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const labelInput = document.getElementById('addSectionLabel');
      if(labelInput) addSectionModal.label = labelInput.value;
      addSectionModal.type = el.getAttribute('data-section-type');
      renderAddSectionModalBody();
      document.getElementById('addSectionLabel').focus();
    });
  });
}
function saveAddSectionModal(){
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

