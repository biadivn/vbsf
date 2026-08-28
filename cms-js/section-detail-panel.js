/* =========================================================
   SECTION DETAIL PANEL (mô phỏng)
   ========================================================= */
function ensureSectionEditBuffer(pageKey, key){
  if(sectionEditBuffer && sectionEditBuffer.pageKey===pageKey && sectionEditBuffer.key===key) return;
  const entry = DB.pageSections[pageKey].find(r=>r.key===key) || {};
  sectionEditBuffer = {
    pageKey, key,
    title: entry.title,
    itemCount: entry.itemCount,
    content: entry.content ? {...entry.content} : undefined,
    items: entry.items ? JSON.parse(JSON.stringify(entry.items)) : undefined,
    tournamentIds: entry.tournamentIds ? [...entry.tournamentIds] : undefined,
    newsIds: entry.newsIds ? [...entry.newsIds] : undefined,
    partnerIds: entry.partnerIds ? [...entry.partnerIds] : undefined,
    pickerMode: entry.pickerMode || 'manual',
    autoCount: entry.autoCount,
    backgroundImage: entry.backgroundImage || null
  };
}

function latestTournaments(n){ return [...DB.tournaments].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0, n); }
function latestNews(n){ return [...DB.news].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0, n); }

function renderSectionDetailPanel(pageKey, key){
  if(!key){
    return `<div class="empty" style="padding:60px 20px"><i class="ti ti-layout-2"></i><b>Trang này chưa có section</b></div>`;
  }
  const def = getSectionDef(pageKey, key);
  const entry = DB.pageSections[pageKey].find(r=>r.key===key);
  const buf = sectionEditBuffer;

  let html = `<div class="card-head">
      <div>
        <h2>${escapeHtml(getSectionLabel(pageKey, key))} <button class="btn-icon" data-rename-section-detail title="Đổi tên section" style="vertical-align:middle"><i class="ti ti-pencil" style="font-size:13px"></i></button> ${def.apiIntegrated?'<span class="badge" style="margin-left:4px"><i class="ti ti-api"></i> API</span>':''}</h2>
        <div class="desc">Cấu hình nội dung hiển thị cho section này</div>
      </div>
      <span class="sec-status-tag ${entry.enabled?'on':'off'}">${entry.enabled?'Đang hiển thị':'Đang ẩn'}</span>
    </div>`;

  html += `<div class="sec-detail-group">
    <div class="sec-detail-group-label">Hiển thị</div>`;
  if(def.title!==undefined){
    html += `<div class="fld" style="max-width:420px"><label>Tiêu đề hiển thị</label><input type="text" id="secTitleInput" value="${escapeAttr(buf.title ?? '')}" placeholder="${escapeAttr(def.title||'')}"></div>`;
  }
  if(def.items){
    html += `<div class="fld" style="max-width:160px;margin-top:${def.title!==undefined?'14px':'0'}"><label>Số lượng hiển thị</label><input type="number" min="1" max="${def.maxItems}" id="secCountInput" value="${buf.itemCount ?? def.itemCount}"></div>`;
  }
  if(def.title===undefined && !def.items){
    html += `<div class="hint">Section này không có tuỳ chọn hiển thị bổ sung.</div>`;
  }
  html += `</div>`;

  html += `<div class="sec-detail-group"><div class="sec-detail-group-label">Nội dung</div>`;
  if(def.tournamentSelect){
    html += renderPickerModeSection('tournament', def, buf);
  } else if(def.newsPicker){
    html += renderPickerModeSection('news', def, buf);
  } else if(def.partnerPicker){
    html += renderPartnerPickerInline(buf);
  } else if(def.fields){
    html += `<div class="form-grid">` + def.fields.map(f=>
      `<div class="fld ${f.span2?'span2':''}"><label>${f.label}</label>${f.type==='textarea' ? renderRichTextField(f, buf.content[f.key]) : renderField(f, buf.content[f.key])}</div>`
    ).join('') + `</div>`;
  } else if(def.itemFields){
    html += renderItemsEditorInline(def.itemFields, buf.items);
  } else {
    html += `<div class="hint">Section này không có nội dung tuỳ chỉnh (dùng chung bố cục cố định).</div>`;
  }
  html += `</div>`;

  html += `<div class="sec-detail-group"><div class="sec-detail-group-label">Ảnh nền</div>${renderBackgroundImageInline(buf)}</div>`;

  html += `<div class="sec-detail-actions">
    <button class="btn btn-ghost" id="secDiscardBtn">Hủy thay đổi</button>
    <button class="btn btn-primary" id="secSaveBtn"><i class="ti ti-check"></i> Lưu thay đổi</button>
  </div>`;

  return html;
}

function renderPickerInline(ids, allItems, renderMeta){
  const selected = ids.map(id=>allItems.find(x=>x.id===id)).filter(Boolean);
  const selectedHtml = selected.length ? selected.map((item, idx)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-bottom:1px solid var(--line)">
      <div class="sec-row-order">
        <button class="btn-icon" data-picker-up="${idx}" ${idx===0?'disabled style="opacity:.3"':''} title="Lên"><i class="ti ti-chevron-up"></i></button>
        <button class="btn-icon" data-picker-down="${idx}" ${idx===selected.length-1?'disabled style="opacity:.3"':''} title="Xuống"><i class="ti ti-chevron-down"></i></button>
      </div>
      <span class="cell-muted" style="font-size:11px;width:16px;text-align:center;flex-shrink:0">${idx+1}</span>
      ${renderMeta(item)}
      <button class="btn-icon" data-picker-remove="${item.id}" title="Bỏ chọn"><i class="ti ti-x"></i></button>
    </div>`).join('') : `<div class="empty" style="padding:16px"><b>Chưa chọn mục nào</b></div>`;

  const available = allItems.filter(x=>!ids.includes(x.id));
  const availableHtml = available.map(item=>`
    <label style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--line);cursor:pointer" data-picker-add-row="${item.id}">
      <i class="ti ti-plus" style="color:var(--hint);font-size:14px;flex-shrink:0"></i>
      ${renderMeta(item)}
    </label>`).join('');

  return `<div class="sec-detail-group-label" style="margin-bottom:8px">Đã chọn (${selected.length}) — dùng mũi tên để sắp xếp thứ tự hiển thị</div>
    <div style="border:1px solid var(--line-strong);border-radius:8px;overflow:hidden;margin-bottom:16px">${selectedHtml}</div>
    <div class="sec-detail-group-label" style="margin-bottom:8px">Thêm mục</div>
    <div style="max-height:220px;overflow-y:auto;border:1px solid var(--line-strong);border-radius:8px">${availableHtml || '<div class="empty" style="padding:16px"><b>Không còn mục nào khác</b></div>'}</div>`;
}

function renderPickerModeSection(kind, def, buf){
  const multi = kind==='tournament' ? !def.singleSelect : true;
  const mode = buf.pickerMode || 'manual';
  const noun = kind==='tournament' ? 'giải đấu' : 'tin tức';

  let html = `<div style="display:flex;gap:8px;margin-bottom:16px">
    <button type="button" class="btn ${mode==='auto'?'btn-primary':'btn-ghost'}" data-picker-mode-btn="auto"><i class="ti ti-bolt"></i> Tự động (mới nhất)</button>
    <button type="button" class="btn ${mode==='manual'?'btn-primary':'btn-ghost'}" data-picker-mode-btn="manual"><i class="ti ti-list"></i> Chọn thủ công</button>
  </div>`;

  if(mode==='auto'){
    if(multi){
      const count = buf.autoCount || 3;
      const latest = kind==='tournament' ? latestTournaments(count) : latestNews(count);
      const previewRows = latest.map(x=>`<div style="padding:8px 10px;border-bottom:1px solid var(--line);font-size:13.5px">${escapeHtml(kind==='tournament'?x.name:x.title)}</div>`).join('') || `<div class="empty" style="padding:16px"><b>Chưa có dữ liệu</b></div>`;
      html += `<div class="fld" style="max-width:160px;margin-bottom:14px"><label>Số lượng hiển thị</label><input type="number" min="1" id="secAutoCountInput" value="${count}"></div>
        <div class="hint" style="margin-bottom:8px">Hệ thống sẽ tự động lấy ${count} ${noun} mới nhất theo ngày, không cần chọn thủ công (mô phỏng, chưa áp dụng trực tiếp). Xem trước:</div>
        <div style="border:1px solid var(--line-strong);border-radius:8px;overflow:hidden">${previewRows}</div>`;
    } else {
      const latest = latestTournaments(1)[0];
      html += `<div class="hint" style="margin-bottom:8px">Hệ thống sẽ tự động lấy giải đấu mới nhất theo ngày, không cần chọn thủ công (mô phỏng, chưa áp dụng trực tiếp).</div>
        <div style="border:1px solid var(--line-strong);border-radius:8px;padding:10px 12px;font-size:13.5px">${latest ? escapeHtml(latest.name) : '<span class="hint">Chưa có giải đấu nào</span>'}</div>`;
    }
    return html;
  }

  html += kind==='tournament' ? renderTournamentPickerInline(def, buf) : renderNewsPickerInline(buf);
  return html;
}

function renderTournamentPickerInline(def, buf){
  const statusMap = COLLECTIONS.tournaments.columns.find(c=>c.status)?.statusMap || {};
  const renderMeta = t=>{
    const m = statusMap[t.status];
    return `<span style="flex:1;font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.name||'(chưa có tên)')}</span><span class="badge">${escapeHtml(t.category||'')}</span>${m ? `<span class="status ${m.c}">${m.t}</span>` : ''}`;
  };

  if(def.singleSelect){
    const ids = buf.tournamentIds || [];
    const rows = DB.tournaments.map(t=>`<label style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--line);cursor:pointer">
        <input type="radio" name="secTournamentPick" data-sec-tournament-pick="${t.id}" ${ids.includes(t.id)?'checked':''} style="width:16px;height:16px;flex-shrink:0">
        ${renderMeta(t)}
      </label>`).join('');
    const hint = def.apiIntegrated ? 'Dữ liệu sẽ được lấy tự động qua API theo giải đấu đã chọn (mô phỏng, chưa gọi API thật).' : 'Nội dung sẽ lấy tự động từ giải đấu đã chọn trong danh mục "Giải đấu".';
    return `<div style="max-height:320px;overflow-y:auto;border:1px solid var(--line-strong);border-radius:8px">${rows || '<div class="empty" style="padding:20px"><b>Chưa có giải đấu nào</b></div>'}</div>
      <div class="hint" style="margin-top:10px">${hint}</div>`;
  }

  const hint = def.apiIntegrated
    ? 'Bảng xếp hạng sẽ được lấy tự động qua API theo các giải đấu đã chọn, đúng theo thứ tự bên trên (mô phỏng, chưa gọi API thật).'
    : 'Nội dung hiển thị sẽ lấy tự động từ các giải đấu đã chọn, đúng theo thứ tự bên trên.';
  return renderPickerInline(buf.tournamentIds || [], DB.tournaments, renderMeta) + `<div class="hint" style="margin-top:10px">${hint}</div>`;
}

function renderNewsPickerInline(buf){
  const renderMeta = n=>`<span style="flex:1;font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(n.title||'(chưa có tiêu đề)')}</span><span class="badge">${escapeHtml(n.category||'')}</span><span class="cell-muted" style="font-size:11px;width:76px;text-align:right;flex-shrink:0">${fmtDate(n.date)}</span>`;
  return renderPickerInline(buf.newsIds || [], DB.news, renderMeta) + `<div class="hint" style="margin-top:10px">Thứ tự hiển thị theo danh sách "Đã chọn" bên trên.</div>`;
}

function renderPartnerPickerInline(buf){
  const renderMeta = p=>{
    const thumb = p.image ? `<img src="${p.image}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;flex-shrink:0">` : `<div style="width:28px;height:28px;border-radius:6px;background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--hint);flex-shrink:0"><i class="ti ti-building" style="font-size:14px"></i></div>`;
    return `${thumb}<span style="flex:1;font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name||'(chưa có tên)')}</span><span class="badge">${escapeHtml(p.tier||'')}</span>`;
  };
  return renderPickerInline(buf.partnerIds || [], DB.partners, renderMeta) + `<div class="hint" style="margin-top:10px">Nội dung hiển thị sẽ lấy tự động từ các đối tác/nhà tài trợ đã chọn trong danh mục "Đối tác & Tài trợ", đúng theo thứ tự bên trên.</div>`;
}

function renderItemsEditorInline(itemFields, items){
  const imageField = itemFields.find(f=>f.type==='image');
  const textFields = itemFields.filter(f=>f.type!=='image');

  const rows = items.map((item, idx)=>{
    const imageHtml = imageField ? `<div style="width:88px;flex-shrink:0">
      ${item[imageField.key] ? `<img src="${item[imageField.key]}" style="width:100%;height:88px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block;margin-bottom:6px">` : `<div style="width:100%;height:88px;border:1px dashed var(--line-strong);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--hint);margin-bottom:6px"><i class="ti ti-photo" style="font-size:20px"></i></div>`}
      <input type="file" accept="image/*" data-sec-ci-image="${idx}:${imageField.key}" style="font-size:10px;width:100%">
    </div>` : '';

    const fieldsHtml = textFields.map(f=>
      `<div class="fld" style="margin:0"><label style="font-size:11px">${f.label}</label><input type="text" data-sec-ci="${idx}:${f.key}" value="${escapeAttr(item[f.key]||'')}"></div>`
    ).join('');

    return `<div style="display:flex;gap:14px;align-items:flex-start;padding:14px;border:1px solid var(--line-strong);border-radius:10px;margin-bottom:10px" data-sec-ci-row="${idx}">
      ${imageHtml}
      <div style="flex:1;min-width:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px 14px">${fieldsHtml}</div>
      <button class="btn-icon" data-sec-ci-remove="${idx}" title="Xóa mục" style="flex-shrink:0"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join('');
  return `<div id="secCiList">${rows || '<div class="empty" style="padding:24px"><b>Chưa có mục nào</b></div>'}</div>
    <button class="btn btn-ghost" id="secCiAdd" style="margin-top:4px"><i class="ti ti-plus"></i> Thêm mục</button>`;
}

function renderBackgroundImageInline(buf){
  return `
    ${buf.backgroundImage ? `<div style="margin-bottom:12px"><img src="${buf.backgroundImage}" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid var(--line);display:block"></div>` : ''}
    <input type="file" id="secBgFileInput" accept="image/*">
    <div class="hint" style="margin-top:10px;display:flex;gap:6px"><i class="ti ti-info-circle"></i> Ảnh được lưu trực tiếp trong CMS (mô phỏng) — nên dùng ảnh dung lượng nhỏ.</div>
    ${buf.backgroundImage ? `<button class="btn btn-danger-outline" id="secBgRemoveBtn" style="margin-top:12px"><i class="ti ti-trash"></i> Xóa ảnh nền</button>` : ''}
  `;
}

function syncSectionItemsFromInputs(){
  if(!sectionEditBuffer.items) return;
  document.querySelectorAll('[data-sec-ci]').forEach(el=>{
    const [idx, key] = el.getAttribute('data-sec-ci').split(':');
    sectionEditBuffer.items[parseInt(idx,10)][key] = el.value;
  });
}

function attachSectionDetailEvents(pageKey, key){
  if(!key) return;
  const def = getSectionDef(pageKey, key);
  const buf = sectionEditBuffer;
  attachRTEEvents();

  const renameBtn = document.querySelector('[data-rename-section-detail]');
  if(renameBtn) renameBtn.addEventListener('click', ()=>{
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

  document.querySelectorAll('[data-picker-mode-btn]').forEach(el=>{
    el.addEventListener('click', ()=>{
      buf.pickerMode = el.getAttribute('data-picker-mode-btn');
      renderContent();
    });
  });

  document.querySelectorAll('[data-sec-tournament-pick]').forEach(cb=>{
    cb.addEventListener('change', ()=>{ buf.tournamentIds = cb.checked ? [cb.getAttribute('data-sec-tournament-pick')] : []; });
  });

  const pickerField = (def.tournamentSelect && !def.singleSelect) ? 'tournamentIds' : (def.newsPicker ? 'newsIds' : (def.partnerPicker ? 'partnerIds' : null));
  if(pickerField){
    document.querySelectorAll('[data-picker-add-row]').forEach(el=>{
      el.addEventListener('click', ()=>{
        buf[pickerField].push(el.getAttribute('data-picker-add-row'));
        renderContent();
      });
    });
    document.querySelectorAll('[data-picker-remove]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const id = el.getAttribute('data-picker-remove');
        buf[pickerField] = buf[pickerField].filter(x=>x!==id);
        renderContent();
      });
    });
    document.querySelectorAll('[data-picker-up]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const idx = parseInt(el.getAttribute('data-picker-up'),10);
        if(idx<=0) return;
        const arr = buf[pickerField];
        [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
        renderContent();
      });
    });
    document.querySelectorAll('[data-picker-down]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const idx = parseInt(el.getAttribute('data-picker-down'),10);
        const arr = buf[pickerField];
        if(idx>=arr.length-1) return;
        [arr[idx+1], arr[idx]] = [arr[idx], arr[idx+1]];
        renderContent();
      });
    });
  }

  const addBtn = document.getElementById('secCiAdd');
  if(addBtn) addBtn.addEventListener('click', ()=>{
    syncSectionItemsFromInputs();
    const blank = {}; def.itemFields.forEach(f=>blank[f.key]='');
    buf.items.push(blank);
    renderContent();
  });
  document.querySelectorAll('[data-sec-ci-remove]').forEach(el=>{
    el.addEventListener('click', ()=>{
      syncSectionItemsFromInputs();
      buf.items.splice(parseInt(el.getAttribute('data-sec-ci-remove'),10), 1);
      renderContent();
    });
  });
  document.querySelectorAll('[data-sec-ci-image]').forEach(el=>{
    el.addEventListener('change', (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      syncSectionItemsFromInputs();
      const [idx, fkey] = el.getAttribute('data-sec-ci-image').split(':');
      const reader = new FileReader();
      reader.onload = (ev)=>{ buf.items[parseInt(idx,10)][fkey] = ev.target.result; renderContent(); };
      reader.readAsDataURL(file);
    });
  });

  const bgInput = document.getElementById('secBgFileInput');
  if(bgInput) bgInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{ buf.backgroundImage = ev.target.result; renderContent(); };
    reader.readAsDataURL(file);
  });
  const bgRemoveBtn = document.getElementById('secBgRemoveBtn');
  if(bgRemoveBtn) bgRemoveBtn.addEventListener('click', ()=>{ buf.backgroundImage = null; renderContent(); });

  const saveBtn = document.getElementById('secSaveBtn');
  if(saveBtn) saveBtn.addEventListener('click', ()=> saveSectionDetail(pageKey, key));
  const discardBtn = document.getElementById('secDiscardBtn');
  if(discardBtn) discardBtn.addEventListener('click', ()=>{ sectionEditBuffer = null; renderContent(); showToast('Đã hủy thay đổi'); });
}

async function saveSectionDetail(pageKey, key){
  const def = getSectionDef(pageKey, key);
  const buf = sectionEditBuffer;

  const titleInput = document.getElementById('secTitleInput');
  if(titleInput) buf.title = titleInput.value;
  const countInput = document.getElementById('secCountInput');
  if(countInput) buf.itemCount = Math.max(1, parseInt(countInput.value,10)||1);
  const autoCountInput = document.getElementById('secAutoCountInput');
  if(autoCountInput) buf.autoCount = Math.max(1, parseInt(autoCountInput.value,10)||1);
  if(def.fields){
    buf.content = buf.content || {};
    def.fields.forEach(f=>{
      buf.content[f.key] = f.type==='textarea' ? document.getElementById('rte_'+f.key).innerHTML : document.getElementById('f_'+f.key).value;
    });
  }
  if(def.itemFields) syncSectionItemsFromInputs();

  const entry = DB.pageSections[pageKey].find(r=>r.key===key);
  if(def.title!==undefined) entry.title = buf.title;
  if(def.items) entry.itemCount = buf.itemCount;
  if(def.fields) entry.content = buf.content;
  if(def.itemFields){ entry.items = buf.items; entry.itemCount = buf.items.length; }
  if(def.tournamentSelect) entry.tournamentIds = buf.tournamentIds;
  if(def.newsPicker) entry.newsIds = buf.newsIds;
  if(def.partnerPicker) entry.partnerIds = buf.partnerIds;
  if(def.tournamentSelect || def.newsPicker){
    entry.pickerMode = buf.pickerMode;
    if(!def.singleSelect) entry.autoCount = buf.autoCount;
  }
  entry.backgroundImage = buf.backgroundImage;

  await saveDB(); await savePageContentToApi();
  sectionEditBuffer = null;
  renderContent();
  showToast('Đã lưu section (giả lập)');
}

const RTE_TOOLBAR = [
  {cmd:'bold', icon:'ti-bold', title:'Đậm'},
  {cmd:'italic', icon:'ti-italic', title:'Nghiêng'},
  {cmd:'underline', icon:'ti-underline', title:'Gạch chân'},
  {cmd:'sep'},
  {cmd:'formatBlock:h3', icon:'ti-h-3', title:'Tiêu đề nhỏ'},
  {cmd:'insertUnorderedList', icon:'ti-list', title:'Danh sách chấm'},
  {cmd:'insertOrderedList', icon:'ti-list-numbers', title:'Danh sách số'},
  {cmd:'sep'},
  {cmd:'createLink', icon:'ti-link', title:'Chèn liên kết'},
  {cmd:'removeFormat', icon:'ti-clear-formatting', title:'Xóa định dạng'}
];
function renderRichTextField(f, value){
  const toolbar = RTE_TOOLBAR.map(t=> t.cmd==='sep' ? `<span class="sep"></span>` : `<button type="button" data-cmd="${t.cmd}" title="${t.title}"><i class="ti ${t.icon}"></i></button>`).join('');
  return `<div class="rte" data-rte-field="${f.key}">
    <div class="rte-toolbar">${toolbar}</div>
    <div class="rte-body" id="rte_${f.key}" contenteditable="true" data-placeholder="${escapeAttr(f.placeholder||'Nhập nội dung...')}">${value||''}</div>
  </div>`;
}
function attachRTEEvents(){
  document.querySelectorAll('.rte').forEach(wrap=>{
    const editor = wrap.querySelector('.rte-body');
    wrap.querySelectorAll('[data-cmd]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        editor.focus();
        const cmd = btn.getAttribute('data-cmd');
        if(cmd==='createLink'){
          const url = prompt('Nhập URL liên kết:');
          if(url) document.execCommand('createLink', false, url);
        } else if(cmd.startsWith('formatBlock:')){
          document.execCommand('formatBlock', false, cmd.split(':')[1]);
        } else {
          document.execCommand(cmd, false, null);
        }
      });
    });
  });
}

