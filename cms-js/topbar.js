/* =========================================================
   TOPBAR
   ========================================================= */
function renderTopbar(){
  const title = document.getElementById('pageTitle');
  const sub = document.getElementById('pageSub');
  const actions = document.getElementById('topbarActions');

  if(currentView==='dashboard'){
    title.textContent = 'Tổng quan';
    sub.textContent = 'Toàn cảnh nội dung trên website VBSF';
    actions.innerHTML = `<button class="btn btn-ghost" id="exportBtn"><i class="ti ti-download"></i> Xuất JSON</button>
      <label class="btn btn-ghost" style="cursor:pointer"><i class="ti ti-upload"></i> Nhập JSON<input type="file" id="importFile" accept=".json" style="display:none"></label>`;
  } else if(COLLECTIONS[currentView]){
    const c = COLLECTIONS[currentView];
    title.textContent = c.label;
    sub.textContent = DB_TABLES[currentView]
      ? `Dữ liệu truy vấn từ cơ sở dữ liệu VBSF${c.readOnly ? ' — chỉ xem, không thể chỉnh sửa trực tiếp' : ''}`
      : currentView==='accounts' ? 'Quản lý tài khoản đăng nhập CMS'
      : `Quản lý ${c.single} hiển thị trên website`;
    const syncBtn = (DB_TABLES[currentView] && !c.noSync) ? `<button class="btn btn-ghost" id="syncBtn" ${syncingKey===currentView?'disabled':''}><i class="ti ti-refresh"></i> ${syncingKey===currentView?'Đang đồng bộ...':'Đồng bộ từ CSDL'}</button>` : '';
    const addBtnHtml = c.readOnly ? '' : (currentView==='news' ? `<button class="btn btn-primary" id="addNewsBtn"><i class="ti ti-plus"></i> Thêm ${c.single}</button>` : currentView==='tournaments' ? `<button class="btn btn-primary" id="addTourneyBtn"><i class="ti ti-plus"></i> Tạo giải đấu</button>` : c.pageEdit ? `<button class="btn btn-primary" id="addRecordBtn" data-key="${currentView}"><i class="ti ti-plus"></i> Thêm ${c.single}</button>` : `<button class="btn btn-primary" id="addNewBtn"><i class="ti ti-plus"></i> Thêm ${c.single}</button>`);
    actions.innerHTML = `${syncBtn}${addBtnHtml}`;
  } else if(getPageEditKey(currentView)){
    const key = getPageEditKey(currentView);
    const c = COLLECTIONS[key];
    const id = currentView.slice((key+'-edit:').length);
    const rec = id!=='new' ? DB[key].find(r=>r.id===id) : null;
    title.textContent = rec ? `Sửa ${c.single}` : `Thêm ${c.single}`;
    sub.textContent = rec ? (rec.name||rec.title||c.label) : `Thêm ${c.single} mới`;
    actions.innerHTML = `<button class="btn btn-ghost" id="recordEditorBack" data-key="${key}"><i class="ti ti-arrow-left"></i> Quay lại danh sách</button>`;
  } else if(currentView.startsWith('news-edit:')){
    const id = currentView.slice('news-edit:'.length);
    const rec = id!=='new' ? DB.news.find(r=>r.id===id) : null;
    title.textContent = rec ? 'Sửa bài viết' : 'Bài viết mới';
    sub.textContent = rec && rec.title ? rec.title : 'Soạn nội dung tin tức';
    actions.innerHTML = `<button class="btn btn-ghost" id="newsEditorBack"><i class="ti ti-arrow-left"></i> Quay lại danh sách</button>`;
  } else if(currentView.startsWith('tournament-edit:')){
    const id = currentView.slice('tournament-edit:'.length);
    const rec = id!=='new' ? DB.tournaments.find(r=>r.id===id) : null;
    title.textContent = rec ? 'Sửa giải đấu' : 'Tạo giải đấu';
    sub.textContent = rec && rec.name ? rec.name : 'Thông tin, danh sách người chơi, cặp đấu & kết quả';
    actions.innerHTML = `<button class="btn btn-ghost" id="tourneyEditorBack"><i class="ti ti-arrow-left"></i> Quay lại danh sách</button>`;
  } else if(currentView==='pages'){
    title.textContent = 'Trang website';
    sub.textContent = 'Quản lý các trang trên website và cấu hình section cho từng trang';
    actions.innerHTML = `<a class="btn btn-ghost" href="index.html" target="_blank" rel="noopener"><i class="ti ti-external-link"></i> Xem trang (thật)</a>
      <button class="btn btn-primary" id="newPageBtn"><i class="ti ti-plus"></i> Tạo trang mới</button>`;
  } else if(currentView.startsWith('page:')){
    const pageKey = currentView.slice(5);
    title.textContent = getPageLabel(pageKey);
    sub.textContent = 'Bật/tắt, sắp xếp và cấu hình nội dung từng section trên trang này — mô phỏng, chưa áp dụng trực tiếp lên website';
    actions.innerHTML = `<a class="btn btn-ghost" href="index.html" target="_blank" rel="noopener"><i class="ti ti-external-link"></i> Xem trang (thật)</a>`;
  } else if(currentView==='settings'){
    title.textContent = 'Thông tin tổ chức';
    sub.textContent = 'Nội dung hiển thị ở trang Giới thiệu & Trang chủ';
    actions.innerHTML = '';
  } else if(currentView==='contact'){
    title.textContent = 'Liên hệ';
    sub.textContent = 'Thông tin liên hệ hiển thị ở Footer & trang Liên hệ';
    actions.innerHTML = '';
  }

  const addBtn = document.getElementById('addNewBtn');
  if(addBtn) addBtn.addEventListener('click', ()=>openModal(currentView, null));
  const addRecordBtn = document.getElementById('addRecordBtn');
  if(addRecordBtn) addRecordBtn.addEventListener('click', ()=>setView(addRecordBtn.getAttribute('data-key')+'-edit:new'));
  const recordEditorBack = document.getElementById('recordEditorBack');
  if(recordEditorBack) recordEditorBack.addEventListener('click', ()=>setView(recordEditorBack.getAttribute('data-key')));
  const addNewsBtn = document.getElementById('addNewsBtn');
  if(addNewsBtn) addNewsBtn.addEventListener('click', ()=>setView('news-edit:new'));
  const newsEditorBack = document.getElementById('newsEditorBack');
  if(newsEditorBack) newsEditorBack.addEventListener('click', ()=>setView('news'));
  const addTourneyBtn = document.getElementById('addTourneyBtn');
  if(addTourneyBtn) addTourneyBtn.addEventListener('click', ()=>setView('tournament-edit:new'));
  const tourneyEditorBack = document.getElementById('tourneyEditorBack');
  if(tourneyEditorBack) tourneyEditorBack.addEventListener('click', ()=>setView('tournaments'));
  const syncBtn = document.getElementById('syncBtn');
  if(syncBtn) syncBtn.addEventListener('click', ()=>syncFromDatabase(currentView));
  const newPageBtn = document.getElementById('newPageBtn');
  if(newPageBtn) newPageBtn.addEventListener('click', ()=>openPageModal());
  const exportBtn = document.getElementById('exportBtn');
  if(exportBtn) exportBtn.addEventListener('click', exportData);
  const importFile = document.getElementById('importFile');
  if(importFile) importFile.addEventListener('change', importData);
}

