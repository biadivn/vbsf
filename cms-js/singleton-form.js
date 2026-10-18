/* =========================================================
   SINGLETON FORM (settings / contact)
   ========================================================= */
function renderSingletonForm(key, fields){
  const data = DB[key];
  /* Ô ảnh dùng chung cơ chế của modal: giá trị nằm ở modalImageValues, không có
     input #f_<key> để đọc lúc lưu. Nạp lại từ bản ghi hiện tại mỗi lần dựng form. */
  modalImageValues = {};
  fields.forEach(f=>{ if(f.type==='image') modalImageValues[f.key] = data[f.key] || null; });
  let html = `<div class="form-card"><div class="form-grid">`;
  fields.forEach(f=>{
    html += `<div class="fld ${f.span2?'span2':''}"><label>${f.label}</label>${renderField(f, data[f.key])}</div>`;
  });
  const transBtn = (I18N_SINGLETON_FIELDS[key] || []).length
    ? `<button class="btn btn-ghost" id="singletonI18nBtn"><i class="ti ti-language"></i> Bản tiếng Anh</button>`
    : '';
  html += `</div><div class="form-actions">${transBtn}<button class="btn btn-primary" id="saveSingleton"><i class="ti ti-check"></i> Lưu thay đổi</button></div></div>`;
  return html;
}
function attachSingletonEvents(key, fields){
  attachModalImageEvents();
  const transBtn = document.getElementById('singletonI18nBtn');
  if(transBtn) transBtn.addEventListener('click', ()=> openI18nModal('singleton', key));
  document.getElementById('saveSingleton').addEventListener('click', async ()=>{
    const data = {};
    fields.forEach(f=>{
      if(f.type==='image'){ data[f.key] = modalImageValues[f.key] || ''; return; }
      const el = document.getElementById('f_'+f.key);
      data[f.key] = f.type==='checkbox' ? el.classList.contains('on') : el.value;
    });
    /* Bản dịch do màn hình riêng quản lý, không có ô nào ở form này — không
       mang theo thì bản ghi trong bộ nhớ mất i18n và lần mở màn hình dịch kế
       tiếp sẽ trắng trơn. */
    if(DB[key] && DB[key].i18n) data.i18n = DB[key].i18n;
    const ok = await saveSingletonToApi(key, data);
    if(!ok) return;
    DB[key] = data;
    showToast('Đã lưu thay đổi');
    renderSidebar();
  });
}

