/* =========================================================
   SINGLETON FORM (settings / contact)
   ========================================================= */
function renderSingletonForm(key, fields){
  const data = DB[key];
  const transFields = i18nFieldsOfSingleton(key);
  if(transFields.length && detailLang==='en'){
    return `<div class="form-card">${renderDetailLangSwitch()}
      <div>${renderI18nFields(transFields, data)}</div>
      <div class="form-actions"><button class="btn btn-primary" id="saveSingleton"><i class="ti ti-check"></i> Lưu bản tiếng Anh</button></div>
    </div>`;
  }
  /* Ô ảnh dùng chung cơ chế của modal: giá trị nằm ở modalImageValues, không có
     input #f_<key> để đọc lúc lưu. Nạp lại từ bản ghi hiện tại mỗi lần dựng form. */
  modalImageValues = {};
  fields.forEach(f=>{ if(f.type==='image') modalImageValues[f.key] = data[f.key] || null; });
  let html = `<div class="form-card">${transFields.length ? renderDetailLangSwitch() : ''}<div class="form-grid">`;
  fields.forEach(f=>{
    html += `<div class="fld ${f.span2?'span2':''}"><label>${f.label}</label>${renderField(f, data[f.key])}</div>`;
  });
  html += `</div><div class="form-actions"><button class="btn btn-primary" id="saveSingleton"><i class="ti ti-check"></i> Lưu thay đổi</button></div></div>`;
  return html;
}
function attachSingletonEvents(key, fields){
  const transFields = i18nFieldsOfSingleton(key);
  attachDetailLangSwitch(()=> renderContent());

  if(transFields.length && detailLang==='en'){
    attachI18nFields();
    document.getElementById('saveSingleton').addEventListener('click', async ()=>{
      const ok = await saveI18nValues('singleton', key, null, transFields);
      if(!ok){ showToast('Không lưu được bản tiếng Anh', true); return; }
      showToast('Đã lưu bản tiếng Anh');
      renderContent();
    });
    return;
  }

  attachModalImageEvents();
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

