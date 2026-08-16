/* =========================================================
   NEWS EDITOR (full-screen editor for Tin tức, thay cho modal)
   ========================================================= */
let neBannerImage = null;
function renderNewsEditor(id){
  const isNew = id==='new';
  const record = isNew ? {} : (DB.news.find(r=>r.id===id) || {});
  neBannerImage = record.image || null;
  const catField = COLLECTIONS.news.fields.find(f=>f.key==='category');
  const catOpts = catField.options.map(o=>`<option value="${escapeAttr(o)}" ${record.category===o?'selected':''}>${escapeHtml(o)}</option>`).join('');
  return `<div class="news-editor">
    <div class="form-card" style="max-width:840px">
      <div class="fld span2">
        <label>Ảnh banner</label>
        <div class="ne-banner" id="neBannerPreview">${renderBannerPreview()}</div>
        <input type="file" accept="image/*" id="ne_image" style="display:none">
        <div style="margin-top:8px;display:flex;gap:8px">
          <button type="button" class="btn btn-ghost" id="neBannerPick"><i class="ti ti-upload"></i> <span id="neBannerPickLbl">${neBannerImage?'Đổi ảnh':'Chọn ảnh'}</span></button>
          <button type="button" class="btn btn-ghost" id="neBannerRemove" style="${neBannerImage?'':'display:none'}"><i class="ti ti-trash"></i> Xóa ảnh</button>
        </div>
      </div>
      <div class="ne-title-wrap" style="margin-top:14px"><input type="text" id="ne_title" class="news-editor-title" placeholder="Tiêu đề bài viết..." value="${escapeAttr(record.title||'')}"></div>
      <div class="form-grid" style="margin-top:10px">
        <div class="fld"><label>Chuyên mục</label><select id="ne_category"><option value="">— Chọn —</option>${catOpts}</select></div>
        <div class="fld"><label>Ngày đăng</label><input type="date" id="ne_date" value="${escapeAttr(record.date||'')}"></div>
        <div class="fld"><label>Tác giả</label><input type="text" id="ne_author" placeholder="Ban Truyền thông VBSF" value="${escapeAttr(record.author||'')}"></div>
        <div class="fld"><label>&nbsp;</label><div class="checkbox-row"><span class="switch ${record.featured?'on':''}" id="ne_featured" data-toggle></span><label>Hiển thị ở "Tin nổi bật" (trang chủ)</label></div></div>
      </div>
      <div class="fld span2" style="margin-top:10px"><label>Tóm tắt</label><textarea id="ne_excerpt" rows="2" placeholder="Tóm tắt ngắn gọn...">${escapeHtml(record.excerpt||'')}</textarea></div>
      <div class="fld span2" style="margin-top:10px"><label>Nội dung chi tiết</label><div class="rte-lg">${renderRichTextField({key:'content', placeholder:'Soạn nội dung bài viết...'}, record.content||'')}</div></div>
      <div class="form-actions" style="justify-content:space-between">
        ${!isNew ? `<button class="btn btn-danger-outline" id="neDeleteBtn"><i class="ti ti-trash"></i> Xóa bài viết</button>` : `<span></span>`}
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" id="neCancelBtn">Hủy</button>
          <button class="btn btn-primary" id="neSaveBtn"><i class="ti ti-check"></i> ${isNew?'Đăng bài':'Lưu thay đổi'}</button>
        </div>
      </div>
    </div>
  </div>`;
}
function renderBannerPreview(){
  return neBannerImage
    ? `<img src="${neBannerImage}">`
    : `<div class="ne-banner-empty"><i class="ti ti-photo-up"></i><span>Chưa có ảnh banner</span></div>`;
}
function attachNewsEditorEvents(){
  attachRTEEvents();
  const cancelBtn = document.getElementById('neCancelBtn');
  if(cancelBtn) cancelBtn.addEventListener('click', ()=>setView('news'));
  const saveBtn = document.getElementById('neSaveBtn');
  if(saveBtn) saveBtn.addEventListener('click', saveNewsEditor);
  const delBtn = document.getElementById('neDeleteBtn');
  if(delBtn) delBtn.addEventListener('click', deleteNewsEditor);

  const fileInput = document.getElementById('ne_image');
  const pickBtn = document.getElementById('neBannerPick');
  const removeBtn = document.getElementById('neBannerRemove');
  const preview = document.getElementById('neBannerPreview');
  const openPicker = ()=> fileInput.click();
  if(pickBtn) pickBtn.addEventListener('click', openPicker);
  if(preview) preview.addEventListener('click', openPicker);
  if(fileInput) fileInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      neBannerImage = ev.target.result;
      preview.innerHTML = renderBannerPreview();
      document.getElementById('neBannerPickLbl').textContent = 'Đổi ảnh';
      removeBtn.style.display = '';
    };
    reader.readAsDataURL(file);
  });
  if(removeBtn) removeBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    neBannerImage = null;
    fileInput.value = '';
    preview.innerHTML = renderBannerPreview();
    document.getElementById('neBannerPickLbl').textContent = 'Chọn ảnh';
    removeBtn.style.display = 'none';
  });
}
async function saveNewsEditor(){
  const id = currentView.slice('news-edit:'.length);
  const isNew = id==='new';
  const title = document.getElementById('ne_title').value.trim();
  if(!title){ showToast('Vui lòng nhập tiêu đề bài viết', true); return; }
  const data = {
    image: neBannerImage || '',
    title,
    category: document.getElementById('ne_category').value,
    date: document.getElementById('ne_date').value,
    author: document.getElementById('ne_author').value,
    featured: document.getElementById('ne_featured').classList.contains('on'),
    excerpt: document.getElementById('ne_excerpt').value,
    content: document.getElementById('rte_content').innerHTML
  };
  if(isNew){
    data.id = uid();
    DB.news.push(data);
  } else {
    const idx = DB.news.findIndex(r=>r.id===id);
    DB.news[idx] = {...DB.news[idx], ...data};
  }
  await saveDB();
  renderSidebar();
  showToast(isNew ? 'Đã đăng bài viết' : 'Đã lưu thay đổi');
  setView('news');
}
function deleteNewsEditor(){
  const id = currentView.slice('news-edit:'.length);
  const record = DB.news.find(r=>r.id===id);
  const label = record ? record.title : 'bài viết này';
  if(confirm(`Xóa "${label}" khỏi Tin tức? Hành động này không thể hoàn tác.`)){
    DB.news = DB.news.filter(r=>r.id!==id);
    saveDB();
    renderSidebar();
    showToast('Đã xóa');
    setView('news');
  }
}
