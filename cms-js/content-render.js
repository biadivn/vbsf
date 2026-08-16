/* =========================================================
   CONTENT RENDER
   ========================================================= */
function renderContent(){
  const el = document.getElementById('content');
  renderTopbar();
  if(currentView==='dashboard'){ el.innerHTML = renderDashboard(); attachDashboardEvents(); return; }
  if(currentView==='settings'){ el.innerHTML = renderSingletonForm('settings', SETTINGS_FIELDS); attachSingletonEvents('settings', SETTINGS_FIELDS); return; }
  if(currentView==='contact'){ el.innerHTML = renderSingletonForm('contact', CONTACT_FIELDS); attachSingletonEvents('contact', CONTACT_FIELDS); return; }
  if(currentView==='pages'){ el.innerHTML = renderPagesListView(); attachPagesListEvents(); return; }
  if(currentView.startsWith('page:')){ el.innerHTML = renderPageSectionsView(); attachPageSectionsEvents(); return; }
  if(currentView.startsWith('news-edit:')){ el.innerHTML = renderNewsEditor(currentView.slice('news-edit:'.length)); attachNewsEditorEvents(); return; }
  if(currentView.startsWith('tournament-edit:')){ el.innerHTML = renderTournamentEditor(currentView.slice('tournament-edit:'.length)); attachTournamentEditorEvents(); return; }
  if(COLLECTIONS[currentView]){
    if(syncingKey===currentView){ el.innerHTML = `<div class="tbl-wrap"><div class="empty"><i class="ti ti-loader-2"></i><b>Đang truy vấn cơ sở dữ liệu...</b></div></div>`; return; }
    el.innerHTML = renderListView(currentView); attachListEvents(currentView); return;
  }
}

function renderDashboard(){
  const heroTitle = DB.settings.heroTitle || 'Chưa thiết lập giải đấu nổi bật';
  const heroSub = DB.settings.heroSubtitle || '';
  let html = `<div class="dash-hero">
    <div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#C9A24B;font-weight:600">Giải đấu nổi bật · Trang chủ</div>
      <h2 style="margin-top:6px">${escapeHtml(heroTitle)}</h2>
      <p>${escapeHtml(heroSub)}</p>
    </div>
    <button class="btn btn-gold" id="goSettings"><i class="ti ti-edit"></i> Chỉnh sửa</button>
  </div>`;

  html += `<div class="dash-grid">`;
  const cards = [
    ['news','Tin tức','ti-news'],
    ['tournaments','Giải đấu','ti-trophy'],
    ['library_docs','Văn bản & Luật','ti-file-text'],
    ['library_media','Album Media','ti-photo'],
    ['members','Hội viên & Xếp hạng','ti-users'],
    ['partners','Đối tác','ti-building']
  ];
  cards.forEach(([key,label,icon])=>{
    html += `<div class="dash-card" data-nav="${key}">
      <div class="n">${DB[key].length}</div>
      <div class="l"><i class="ti ${icon}"></i>${label}</div>
    </div>`;
  });
  html += `</div>`;

  html += `<div class="tbl-wrap" style="padding:4px 0">
    <div style="padding:14px 18px;border-bottom:1px solid var(--line);font-size:13.5px;font-weight:600;color:var(--vd)">Tin tức mới nhất</div>
    <table><tbody>`;
  const recentNews = [...DB.news].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);
  if(recentNews.length===0){ html += `<tr><td style="padding:16px;color:var(--hint)">Chưa có tin tức nào.</td></tr>`; }
  recentNews.forEach(n=>{
    html += `<tr><td style="width:60%">${escapeHtml(n.title)}</td><td><span class="badge">${escapeHtml(n.category||'')}</span></td><td class="cell-muted">${fmtDate(n.date)}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}
function attachDashboardEvents(){
  document.querySelectorAll('[data-nav]').forEach(el=>{
    if(el.closest('.sidebar')) return;
    el.addEventListener('click', ()=>setView(el.getAttribute('data-nav')));
  });
  const gs = document.getElementById('goSettings');
  if(gs) gs.addEventListener('click', ()=>setView('settings'));
}

function renderListView(key){
  const c = COLLECTIONS[key];
  const filterField = c.filterField ? c.fields.find(f=>f.key===c.filterField) : null;
  const rows = filterRows(DB[key], c, searchTerm, filterField, filterValue);
  let html = `<div class="toolbar">
    <div class="search"><i class="ti ti-search"></i><input type="text" id="searchInput" placeholder="Tìm ${c.single}..." value="${escapeAttr(searchTerm)}"></div>
    ${filterField ? `<select id="filterSelect" class="fld select" style="width:auto;height:32px;border:1px solid var(--line-strong);border-radius:var(--radius);padding:0 11px;color:var(--ink);background:#fff">
      <option value="">Tất cả ${filterField.label.toLowerCase()}</option>
      ${filterField.options.map(o=>`<option value="${escapeAttr(o)}" ${filterValue===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}
    </select>` : ''}
    <span class="count-pill">${rows.length} / ${DB[key].length} mục</span>
  </div>`;

  if(rows.length===0){
    html += `<div class="tbl-wrap"><div class="empty"><i class="ti ${c.icon}"></i><b>Chưa có dữ liệu</b>${searchTerm?'Không tìm thấy kết quả phù hợp.':(c.readOnly?'Nhấn "Đồng bộ từ CSDL" để tải dữ liệu.':`Nhấn "Thêm ${c.single}" để bắt đầu.`)}</div></div>`;
    return html;
  }

  const hasActionCol = !c.readOnly || c.viewDetail || c.toggleVisibility;
  html += `<div class="tbl-wrap"><table><thead><tr>`;
  c.columns.forEach(col=> html += `<th>${col.label}</th>`);
  html += `${hasActionCol ? '<th style="width:90px"></th>' : ''}</tr></thead><tbody>`;
  rows.forEach(r=>{
    const isHidden = c.toggleVisibility && r[c.toggleVisibility];
    html += `<tr data-id="${r.id}"${isHidden ? ' class="row-hidden"' : ''}>`;
    c.columns.forEach(col=>{
      let val;
      if(col.render){ val = col.render(r); }
      else if(col.status){
        const m = col.statusMap[r[col.key]] || {t:r[col.key]||'', c:'gray'};
        val = `<span class="status ${m.c}">${m.t}</span>`;
      } else if(col.badge){
        const lbl = col.mapLabels ? (col.mapLabels[r[col.key]]||r[col.key]||'') : (r[col.key]||'');
        val = lbl ? `<span class="badge">${escapeHtml(lbl)}</span>` : '';
      } else {
        val = escapeHtml(r[col.key] ?? '');
        if(col.muted) val = `<span class="cell-muted">${val||'—'}</span>`;
      }
      html += `<td>${val}</td>`;
    });
    if(!c.readOnly){
      html += `<td class="actions">
        ${c.viewDetail ? `<button class="btn-icon" data-view="${r.id}" title="Xem trước trên website"><i class="ti ti-eye"></i></button>` : ''}
        <button class="btn-icon" data-edit="${r.id}" title="Sửa"><i class="ti ti-edit"></i></button>
        <button class="btn-icon" data-del="${r.id}" title="Xóa"><i class="ti ti-trash"></i></button>
      </td>`;
    } else if(c.viewDetail || c.toggleVisibility){
      html += `<td class="actions">`;
      if(c.viewDetail) html += `<button class="btn-icon" data-view="${r.id}" title="Xem chi tiết"><i class="ti ti-eye"></i></button>`;
      if(c.toggleVisibility) html += `<button class="btn-icon" data-toggle-vis="${r.id}" title="${isHidden?'Hiện lại trên website':'Ẩn khỏi website'}"><i class="ti ${isHidden?'ti-eye-off':'ti-eye'}"></i></button>`;
      html += `</td>`;
    }
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function filterRows(rows, schema, term, filterField, filterVal){
  let out = rows;
  if(filterField && filterVal) out = out.filter(r=> r[filterField.key]===filterVal);
  if(!term) return out;
  const t = term.toLowerCase();
  return out.filter(r=> schema.columns.some(col=> String(r[col.key]||'').toLowerCase().includes(t)) || String(r.name||r.title||'').toLowerCase().includes(t));
}

function attachListEvents(key){
  const search = document.getElementById('searchInput');
  if(search){
    search.addEventListener('input', e=>{ searchTerm = e.target.value; renderContent(); document.getElementById('searchInput').focus(); document.getElementById('searchInput').setSelectionRange(searchTerm.length,searchTerm.length); });
  }
  const filterSelect = document.getElementById('filterSelect');
  if(filterSelect){
    filterSelect.addEventListener('change', e=>{ filterValue = e.target.value; renderContent(); });
  }
  document.querySelectorAll('[data-edit]').forEach(btn=>{
    const id = btn.getAttribute('data-edit');
    btn.addEventListener('click', ()=> key==='news' ? setView('news-edit:'+id) : key==='tournaments' ? setView('tournament-edit:'+id) : openModal(key, id));
  });
  document.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', ()=>confirmDelete(key, btn.getAttribute('data-del')));
  });
  document.querySelectorAll('[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>openViewModal(key, btn.getAttribute('data-view')));
  });
  document.querySelectorAll('[data-toggle-vis]').forEach(btn=>{
    btn.addEventListener('click', ()=>toggleRowVisibility(key, btn.getAttribute('data-toggle-vis')));
  });
}

