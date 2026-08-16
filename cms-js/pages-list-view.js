/* =========================================================
   PAGES LIST VIEW
   ========================================================= */
function renderPagesListView(){
  const pageKeys = getAllPageKeys();
  const term = searchTerm.toLowerCase();
  const rows = pageKeys.filter(k=> !term || getPageLabel(k).toLowerCase().includes(term) || getPagePath(k).toLowerCase().includes(term));

  let html = `<div class="toolbar">
    <div class="search"><i class="ti ti-search"></i><input type="text" id="searchInput" placeholder="Tìm theo tên trang..." value="${escapeAttr(searchTerm)}"></div>
    <span class="count-pill">${rows.length} / ${pageKeys.length} trang</span>
  </div>`;

  if(rows.length===0){
    html += `<div class="tbl-wrap"><div class="empty"><i class="ti ti-layout-2"></i><b>Không tìm thấy trang</b>Không có trang nào khớp với tìm kiếm.</div></div>`;
    return html;
  }

  html += `<div class="tbl-wrap"><table><thead><tr>
    <th>Tên trang</th><th>Section</th><th style="width:90px"></th>
  </tr></thead><tbody>`;
  rows.forEach(k=>{
    const cfg = DB.pageSections[k] || [];
    const total = cfg.length;
    const enabled = cfg.filter(s=>s.enabled).length;
    const customTag = DB.customPages[k] ? `<span class="badge" style="margin-left:6px">Tùy chỉnh</span>` : '';
    html += `<tr data-page-row="${k}" style="cursor:pointer">
      <td>
        <div style="display:flex;align-items:center;gap:12px">
          <span style="width:34px;height:34px;border-radius:8px;background:var(--tag-purple-soft);color:var(--tag-purple);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0"><i class="ti ${getPageIcon(k)}"></i></span>
          <div>
            <div style="font-weight:600">${escapeHtml(getPageLabel(k))}${customTag}</div>
            <div class="cell-muted" style="font-size:12px">${escapeHtml(getPagePath(k))}</div>
          </div>
        </div>
      </td>
      <td><span class="cell-muted">${enabled} / ${total} section đang bật</span></td>
      <td class="actions"><button class="btn-icon" data-edit-page="${k}" title="Mở trang"><i class="ti ti-edit"></i></button></td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}
function attachPagesListEvents(){
  const search = document.getElementById('searchInput');
  if(search){
    search.addEventListener('input', e=>{ searchTerm = e.target.value; renderContent(); document.getElementById('searchInput').focus(); document.getElementById('searchInput').setSelectionRange(searchTerm.length,searchTerm.length); });
  }
  document.querySelectorAll('[data-page-row]').forEach(tr=>{
    tr.addEventListener('click', ()=> setView('page:'+tr.getAttribute('data-page-row')));
  });
  document.querySelectorAll('[data-edit-page]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{ e.stopPropagation(); setView('page:'+btn.getAttribute('data-edit-page')); });
  });
}

