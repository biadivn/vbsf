/* =========================================================
   MODAL (add / edit for collections)
   ========================================================= */
let modalImageValues = {};
function openModal(key, id){
  pageModal = null; addSectionModal = null;
  editingCollection = key; editingId = id;
  const c = COLLECTIONS[key];
  const record = id ? DB[key].find(r=>r.id===id) : {};
  modalImageValues = {};
  c.fields.forEach(f=>{ if(f.type==='image') modalImageValues[f.key] = record[f.key] || null; });
  document.getElementById('modalTitle').textContent = id ? `Sửa ${c.single}` : `Thêm ${c.single}`;
  const body = document.getElementById('modalBody');
  body.innerHTML = `<div class="form-grid">` + c.fields.map(f=>{
    return `<div class="fld ${f.span2?'span2':''}"><label>${f.label}${f.required?' <span class="req">*</span>':''}</label>${f.type==='richtext' ? renderRichTextField(f, record[f.key]) : renderField(f, record[f.key])}</div>`;
  }).join('') + `</div>`;
  document.getElementById('modalDeleteBtn').style.display = id ? 'inline-flex' : 'none';
  document.getElementById('modalSaveBtn').style.display = '';
  document.querySelector('#modalOverlay .modal').classList.remove('wide');
  document.getElementById('modalOverlay').classList.add('on');
  attachRTEEvents();
  attachModalImageEvents();
  document.querySelectorAll('[data-multiselect]').forEach(chip=>{
    chip.addEventListener('click', ()=> chip.classList.toggle('on'));
  });
}
function openViewModal(key, id){
  pageModal = null; addSectionModal = null;
  editingCollection = null; editingId = null;
  const c = COLLECTIONS[key];
  const record = DB[key].find(r=>r.id===id);
  if(!record) return;
  const modalEl = document.querySelector('#modalOverlay .modal');
  const body = document.getElementById('modalBody');
  if(key==='tournaments'){
    document.getElementById('modalTitle').textContent = `Chi tiết ${c.single}`;
    body.innerHTML = renderTourneyDetailPreview(record);
    attachTourneyPreviewEvents(body);
    modalEl.classList.add('wide');
  } else {
    modalEl.classList.remove('wide');
    document.getElementById('modalTitle').textContent = `Chi tiết ${c.single}`;
    body.innerHTML = `<div class="form-grid">` + c.fields.map(f=>{
      let val = record[f.key];
      if(f.type==='select'){ val = (f.optionLabels ? f.optionLabels[val] : null) || val; }
      else if(f.type==='multiselect'){ val = Array.isArray(val) ? val.map(v=> (f.optionLabels?f.optionLabels[v]:null)||v).join(', ') : val; }
      else if(f.type==='checkbox'){ val = val ? 'Có' : 'Không'; }
      else if(f.type==='password'){ val = val ? '••••••••' : ''; }
      else if(f.type==='image'){ return `<div class="fld ${f.span2?'span2':''}"><label>${f.label}</label>${val?`<img src="${val}" style="width:96px;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block">`:`<div class="view-value"><span class="cell-muted">—</span></div>`}</div>`; }
      else if(f.type==='richtext'){ return `<div class="fld ${f.span2?'span2':''}"><label>${f.label}</label><div class="view-value">${val||'<span class="cell-muted">—</span>'}</div></div>`; }
      return `<div class="fld ${f.span2?'span2':''}"><label>${f.label}</label><div class="view-value">${val!==undefined&&val!==null&&val!=='' ? escapeHtml(String(val)) : '<span class="cell-muted">—</span>'}</div></div>`;
    }).join('') + `</div>`;
  }
  document.getElementById('modalDeleteBtn').style.display = 'none';
  document.getElementById('modalSaveBtn').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('on');
}
function renderTourneyDetailPreview(r){
  const statusMap = {
    upcoming: /mở đăng ký/i.test(r.note||'') ? {label:'Mở đăng ký', cta:'upcoming-open'} : {label:'Sắp mở đăng ký', cta:'upcoming-soon'},
    ongoing: {label:'Đang diễn ra · Trực tiếp', cta:'live'},
    completed: {label:'Đã kết thúc', cta:'finished'}
  };
  const st = statusMap[r.status] || statusMap.upcoming;
  const loc = r.location || 'Chưa cập nhật';
  const date = fmtDate(r.date);
  const disc = r.category || '—';

  let ctaInfo, ctaBtn;
  if(st.cta==='live'){
    ctaInfo = `<i class="ti ti-calendar"></i> Ngày thi đấu: <b>${date}</b><br><i class="ti ti-map-pin"></i> Địa điểm: ${escapeHtml(loc)}${r.note?` · ${escapeHtml(r.note)}`:''}`;
    ctaBtn = '';
  } else if(st.cta==='finished'){
    ctaInfo = `<i class="ti ti-calendar"></i> Ngày thi đấu: <b>${date}</b>${r.champion?`<br><i class="ti ti-trophy"></i> Vô địch: <b>${escapeHtml(r.champion)}</b>`:''}`;
    ctaBtn = `<span class="gd-btn">Xem kết quả chung cuộc</span>`;
  } else {
    ctaInfo = `<i class="ti ti-calendar"></i> Ngày thi đấu: <b>${date}</b><br><i class="ti ti-map-pin"></i> Địa điểm: ${escapeHtml(loc)}`;
    ctaBtn = st.cta==='upcoming-open' ? '' : `<span class="gd-btn" style="opacity:.6">Chưa mở đăng ký</span>`;
  }

  return `<div class="gd-prev">
    <div class="gd-note"><i class="ti ti-eye"></i> Xem trước giao diện trang "Chi tiết giải đấu" trên website công khai</div>
    <div class="gd-band">
      <div class="gd-crumb">Trang chủ / Giải đấu / Chi tiết giải đấu</div>
      <div class="gd-org"><div class="gd-org-ic"><i class="ti ti-shield-check"></i></div><div><div class="gd-org-lbl">Đơn vị tổ chức</div><div class="gd-org-name">Liên đoàn Billiards &amp; Snooker Việt Nam</div></div></div>
      <span class="gd-status">${escapeHtml(st.label)}</span>
      <div class="gd-title">${escapeHtml(r.name||'(chưa có tên)')}</div>
      <div class="gd-meta">${escapeHtml(disc)} · ${date}</div>
      <div class="gd-meta"><i class="ti ti-map-pin"></i> ${escapeHtml(loc)}</div>
    </div>
    <div class="gd-tabs"><span class="gd-tab on" data-gtab="chung">Thông tin chung</span><span class="gd-tab" data-gtab="thi-dau">Thi đấu</span></div>
    <div class="gd-body">
      <div class="gd-tabpanel on" data-gpanel="chung">
        <div class="gd-cta-row"><div class="gd-cta-info">${ctaInfo}</div>${ctaBtn}</div>
        <div class="gd-h">Giải thưởng</div>
        <table class="gd-tbl"><thead><tr><th style="width:60px">Hạng</th><th>Tiền mặt</th><th>Hiện vật</th></tr></thead><tbody>
          ${(r.prizes&&r.prizes.length?r.prizes:TE_DEFAULT_PRIZES).map(p=>`<tr><td><b>${escapeHtml(p.rank)}</b></td><td>${escapeHtml(p.cash)}</td><td>${escapeHtml(p.item)}</td></tr>`).join('')}
        </tbody></table>
        <div class="gd-h">Thể lệ thi đấu</div>
        <div class="gd-rules">
          <div style="font-size:12.5px;color:var(--ink)"><b>Lệ phí tham gia:</b> ${escapeHtml(r.entryFee||TE_DEFAULT_ENTRY_FEE)}</div>
          <div class="gd-h" style="font-size:12.5px;margin-top:12px">Điều lệ</div>
          ${(r.rules||TE_DEFAULT_RULES).split('\n').map(l=>l.trim()).filter(Boolean).map(l=>`<div class="gd-li">${escapeHtml(l)}</div>`).join('')}
        </div>
      </div>
      <div class="gd-tabpanel" data-gpanel="thi-dau">${renderTourneyMatchesTab(r, st)}</div>
    </div>
  </div>`;
}
function gdMatchRow(state, p1, score, p2){
  const badge = state==='live' ? {c:'live', t:'LIVE'} : state==='soon' ? {c:'soon', t:'SẮP'} : {c:'kt', t:'KT'};
  return `<div class="gd-row ${state==='live'?'live':''} ${state==='soon'?'pending':''}">
    <span class="gd-mbadge ${badge.c}">${badge.t}</span>
    <div class="gd-match"><b>${escapeHtml(p1)}</b><span class="score">${score}</span><span class="opp">${escapeHtml(p2)}</span></div>
  </div>`;
}
function renderTourneyMatchesTab(r, st){
  if(st.cta==='live'){
    return `<div class="gd-h">Vòng 1/8 · Đã hoàn thành</div>
    <div>
      ${gdMatchRow('kt','Nguyễn Phúc Long','4 – 0','Dương Anh Kiệt')}
      ${gdMatchRow('kt','Đặng Văn Hậu','4 – 3','Phan Đức Thịnh')}
      ${gdMatchRow('kt','Trần Quốc Bảo','4 – 1','Đoàn Minh Tuấn')}
      ${gdMatchRow('kt','Bùi Đức Anh','4 – 2','Vương Quốc Huy')}
      ${gdMatchRow('kt','Lê Minh Khôi','4 – 0','Lý Gia Bảo')}
      ${gdMatchRow('kt','Ngô Gia Huy','4 – 3','Trịnh Xuân Sơn')}
      ${gdMatchRow('kt','Phạm Anh Tú','4 – 1','Đỗ Anh Dũng')}
      ${gdMatchRow('kt','Hoàng Minh Quân','4 – 2','Vũ Trọng Nghĩa')}
    </div>
    <div class="gd-h" style="margin-top:18px">${escapeHtml(r.note||'Vòng tứ kết')} · Kết quả các trận đấu loại</div>
    <div>
      ${gdMatchRow('kt','Nguyễn Phúc Long','4 – 2','Đặng Văn Hậu')}
      ${gdMatchRow('live','Trần Quốc Bảo','2 – 1','Bùi Đức Anh')}
      ${gdMatchRow('kt','Lê Minh Khôi','4 – 1','Ngô Gia Huy')}
      ${gdMatchRow('soon','Phạm Anh Tú','–','Hoàng Minh Quân')}
    </div>
    <div style="font-size:11px;color:var(--hint);margin-top:12px">Tỷ số theo thể thức đấu loại trực tiếp · Cập nhật tự động khi có kết quả mới</div>`;
  }
  if(st.cta==='finished'){
    return `<div class="gd-h">Bục nhận giải</div>
    <div class="gd-pods">
      <div class="gd-pod"><div class="lbl" style="color:#888780;font-size:10.5px;font-weight:600"><i class="ti ti-medal"></i> HẠNG 2</div><div class="av"><i class="ti ti-user"></i></div><div class="nm">—</div></div>
      <div class="gd-pod" style="border-top:3px solid #C8102E;padding-top:20px;padding-bottom:20px"><div class="lbl" style="color:#C8102E;font-size:10.5px;font-weight:700"><i class="ti ti-crown"></i> VÔ ĐỊCH</div><div class="av" style="border:2px solid #C8102E"><i class="ti ti-user"></i></div><div class="nm">${escapeHtml(r.champion||'Chưa cập nhật')}</div></div>
      <div class="gd-pod"><div class="lbl" style="color:#A9784E;font-size:10.5px;font-weight:600"><i class="ti ti-medal"></i> HẠNG 3</div><div class="av"><i class="ti ti-user"></i></div><div class="nm">—</div></div>
    </div>
    <div style="font-size:12px;color:var(--hint);line-height:1.7">Hạng 2, hạng 3 và bảng xếp hạng chi tiết (hạng 4 trở đi) được quản lý trong mục <b style="color:#7A1F17">Bảng xếp hạng</b>.</div>`;
  }
  return `<div style="font-size:12.5px;color:var(--hint);line-height:1.7">Lịch thi đấu chi tiết sẽ được công bố sau khi giải đóng đăng ký.</div>`;
}
function attachTourneyPreviewEvents(container){
  const tabs = container.querySelectorAll('.gd-tab');
  const panels = container.querySelectorAll('.gd-tabpanel');
  tabs.forEach(tab=>{
    tab.addEventListener('click', ()=>{
      tabs.forEach(t=>t.classList.toggle('on', t===tab));
      panels.forEach(p=>p.classList.toggle('on', p.getAttribute('data-gpanel')===tab.getAttribute('data-gtab')));
    });
  });
}
function toggleRowVisibility(key, id){
  const c = COLLECTIONS[key];
  const row = DB[key].find(r=>r.id===id);
  if(!row || !c.toggleVisibility) return;
  row[c.toggleVisibility] = !row[c.toggleVisibility];
  saveDB();
  renderContent();
  showToast(row[c.toggleVisibility] ? `Đã ẩn ${c.single} khỏi website` : `Đã hiện lại ${c.single} trên website`);
}
function attachModalImageEvents(){
  document.querySelectorAll('[data-image-field]').forEach(input=>{
    input.addEventListener('change', (e)=>{
      const key = input.getAttribute('data-image-field');
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev)=>{
        modalImageValues[key] = ev.target.result;
        document.getElementById('imgPreview_'+key).innerHTML = `<img src="${ev.target.result}" style="width:96px;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block">`;
      };
      reader.readAsDataURL(file);
    });
  });
}
function closeModal(){
  document.getElementById('modalOverlay').classList.remove('on');
  editingCollection = null; editingId = null;
}
function renderField(f, value){
  value = value===undefined||value===null ? '' : value;
  const disabledAttr = f.disabled ? 'disabled' : '';
  const disabledHint = f.disabled ? `<div class="fld-hint"><i class="ti ti-lock"></i> Do hệ thống quản lý, không thể chỉnh sửa</div>` : '';
  if(f.type==='select'){
    const opts = f.options.map(o=>{
      const lbl = f.optionLabels ? (f.optionLabels[o]||o) : o;
      return `<option value="${escapeAttr(o)}" ${value===o?'selected':''}>${escapeHtml(lbl)}</option>`;
    }).join('');
    return `<select id="f_${f.key}" ${disabledAttr}><option value="">— Chọn —</option>${opts}</select>${disabledHint}`;
  }
  if(f.type==='multiselect'){
    const values = Array.isArray(value) ? value : (value ? [value] : []);
    const chips = f.options.map(o=>{
      const lbl = f.optionLabels ? (f.optionLabels[o]||o) : o;
      const on = values.includes(o);
      return `<div class="chip ${on?'on':''}" data-multiselect="${f.key}" data-value="${escapeAttr(o)}">${escapeHtml(lbl)}</div>`;
    }).join('');
    return `<div class="chiplist" id="f_${f.key}">${chips}</div>`;
  }
  if(f.type==='textarea'){
    return `<textarea id="f_${f.key}" rows="${f.rows||3}" placeholder="${escapeAttr(f.placeholder||'')}" ${disabledAttr}>${escapeHtml(value)}</textarea>${disabledHint}`;
  }
  if(f.type==='checkbox'){
    return `<div class="checkbox-row"><span class="switch ${value?'on':''}" id="f_${f.key}" data-toggle></span><label>Bật</label></div>`;
  }
  if(f.type==='number'){
    return `<input type="number" id="f_${f.key}" value="${escapeAttr(value)}" placeholder="${escapeAttr(f.placeholder||'')}" ${disabledAttr}>${disabledHint}`;
  }
  if(f.type==='date'){
    return `<input type="date" id="f_${f.key}" value="${escapeAttr(value)}" ${disabledAttr}>${disabledHint}`;
  }
  if(f.type==='password'){
    return `<input type="password" id="f_${f.key}" value="${escapeAttr(value)}" placeholder="${escapeAttr(f.placeholder||'')}" autocomplete="new-password" ${disabledAttr}>${disabledHint}`;
  }
  if(f.type==='image'){
    return `<div>
      <div id="imgPreview_${f.key}" style="margin-bottom:8px">${value ? `<img src="${value}" style="width:96px;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block">` : `<div style="width:96px;height:96px;border:1px dashed var(--line-strong);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--hint)"><i class="ti ti-photo" style="font-size:22px"></i></div>`}</div>
      <input type="file" accept="image/*" data-image-field="${f.key}">
    </div>`;
  }
  return `<input type="text" id="f_${f.key}" value="${escapeAttr(value)}" placeholder="${escapeAttr(f.placeholder||'')}" ${disabledAttr}>${disabledHint}`;
}

async function saveModal(){
  const key = editingCollection;
  const c = COLLECTIONS[key];
  const data = {};
  let missingRequired = false;
  c.fields.forEach(f=>{
    let val;
    if(f.type==='checkbox'){ val = document.getElementById('f_'+f.key).classList.contains('on'); }
    else if(f.type==='image'){ val = modalImageValues[f.key] || ''; }
    else if(f.type==='richtext'){ val = document.getElementById('rte_'+f.key).innerHTML; }
    else if(f.type==='multiselect'){
      val = Array.from(document.querySelectorAll(`[data-multiselect="${f.key}"].on`)).map(el=>el.getAttribute('data-value'));
    }
    else {
      val = document.getElementById('f_'+f.key).value;
      if(f.type==='number' && val!=='') val = Number(val);
    }
    if(f.type==='password' && val==='' && editingId) return;
    if(f.required && (val===''||val===undefined||val===null)) missingRequired = true;
    data[f.key] = val;
  });
  if(missingRequired){ showToast('Vui lòng điền đầy đủ các trường bắt buộc (*)', true); return; }

  if(c.remote){
    const ok = c.strapiUsers ? await saveRemoteAccount(editingId, data) : await saveRemoteCollectionRecord(key, editingId, data);
    if(!ok) return;
    closeModal();
    renderSidebar();
    renderContent();
    showToast(editingId ? 'Đã cập nhật' : 'Đã thêm mới');
    return;
  }

  if(editingId){
    const idx = DB[key].findIndex(r=>r.id===editingId);
    DB[key][idx] = {...DB[key][idx], ...data};
  } else {
    data.id = uid();
    DB[key].push(data);
  }
  await saveDB();
  closeModal();
  renderSidebar();
  renderContent();
  showToast(editingId ? 'Đã cập nhật' : 'Đã thêm mới');
}

async function deleteModal(){
  if(!editingCollection || !editingId) return;
  const c = COLLECTIONS[editingCollection];
  if(c.remote){
    const ok = c.strapiUsers ? await deleteRemoteAccount(editingId) : await deleteRemoteCollectionRecord(editingCollection, editingId);
    if(!ok) return;
  } else {
    DB[editingCollection] = DB[editingCollection].filter(r=>r.id!==editingId);
    await saveDB();
  }
  closeModal();
  renderSidebar();
  renderContent();
  showToast('Đã xóa');
}

async function confirmDelete(key, id){
  const c = COLLECTIONS[key];
  const record = DB[key].find(r=>r.id===id);
  const label = record ? (record.name||record.title||record.displayName||'mục này') : 'mục này';
  if(!confirm(`Xóa "${label}" khỏi ${c.label}? Hành động này không thể hoàn tác.`)) return;
  if(c.remote){
    const ok = c.strapiUsers ? await deleteRemoteAccount(id) : await deleteRemoteCollectionRecord(key, id);
    if(!ok) return;
  } else {
    DB[key] = DB[key].filter(r=>r.id!==id);
    await saveDB();
  }
  renderSidebar();
  renderContent();
  showToast('Đã xóa');
}

