/* =========================================================
   DANH SÁCH VĐV CỦA HỘI VIÊN TỔ CHỨC — tab trong editor "Hội viên tổ chức"

   Vận hành Liên đoàn nhập hộ danh sách mà tổ chức gửi tới (tệp CSV, bản in,
   email). Mỗi dòng vào danh sách VĐV của tổ chức ở trạng thái "chờ xác nhận";
   người chưa có hồ sơ hội viên cá nhân thì được tạo hồ sơ mới, trạng thái chờ
   hội phí. Quy tắc nằm ở máy chủ (strapi-backend/src/utils/org-roster.js) —
   dùng chung với luồng tổ chức tự nhập trên site, nên hai chỗ không lệch nhau.

   Dữ liệu KHÔNG đồng bộ xuống localStorage: bản ghi chứa CCCD/điện thoại, nên
   mỗi lần mở tab là nạp lại từ Strapi.
   ========================================================= */
const orRosterState = { orgId: null, loading: false, loaded: false, athletes: [], result: null };

function orRosterReset(orgId){
  orRosterState.orgId = orgId;
  orRosterState.loading = false;
  orRosterState.loaded = false;
  orRosterState.athletes = [];
  orRosterState.result = null;
}

async function orRosterLoad(orgId){
  if(orRosterState.loading) return;
  orRosterState.loading = true;
  try{
    const q = `filters[teamDocId][$eq]=${encodeURIComponent(orgId)}&pagination[pageSize]=300&sort=fullName:asc`;
    const res = await apiFetch(`/api/team-athletes?${q}`);
    orRosterState.athletes = res.ok ? ((await res.json()).data || []) : [];
  }catch(e){
    showToast('Không tải được danh sách vận động viên của tổ chức', true);
    orRosterState.athletes = [];
  }
  orRosterState.loaded = true;
  orRosterState.loading = false;
  if(getPageEditKey(currentView)==='members_org' && reTab==='roster') renderContent();
}

/* CSV tối giản, có hỗ trợ ô bọc nháy kép vì tên/địa chỉ hay chứa dấu phẩy.
   Bản song sinh cho site public ở site-js/team-squad.js — hai bản cố ý tách
   nhau vì CMS và site không dùng chung bundle; ĐỊNH DẠNG CỘT phải giữ giống
   nhau (xem OR_CSV_COLS). */
function orRosterParseCsv(text){
  const rows = []; let row = [], field = '', quoted = false;
  const push = ()=>{ row.push(field); field = ''; };
  const endRow = ()=>{ push(); if(row.some(c=>c.trim())) rows.push(row); row = []; };
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(quoted){
      if(c==='"' && text[i+1]==='"'){ field += '"'; i++; }
      else if(c==='"') quoted = false;
      else field += c;
    }
    else if(c==='"') quoted = true;
    else if(c===',') push();
    else if(c==='\n') endRow();
    else if(c!=='\r') field += c;
  }
  if(field || row.length) endRow();
  return rows;
}

const OR_CSV_COLS = ['Họ và tên', 'Số căn cước', 'Ngày sinh (yyyy-mm-dd)', 'Giới tính', 'Điện thoại', 'Địa chỉ'];

function orRosterCsvToAthletes(text){
  let rows = orRosterParseCsv(text);
  // Dòng đầu là tiêu đề cột thì bỏ — người ta thường nhập lại đúng tệp mẫu.
  if(rows.length && /họ|tên|name/i.test(rows[0][0]||'')) rows = rows.slice(1);
  return rows.map(c=>({
    fullName: (c[0]||'').trim(), cccd: (c[1]||'').trim(),
    dob: (c[2]||'').trim() || undefined, gender: (c[3]||'').trim(),
    phone: (c[4]||'').trim(), address: (c[5]||'').trim()
  })).filter(r=> r.fullName || r.cccd);
}

function orRosterDownloadSample(){
  const text = OR_CSV_COLS.join(',') + '\n' +
    ['Nguyễn Văn A', '079098001234', '1998-04-12', 'Nam', '0909123456', 'Quận 1, TP.HCM'].join(',') + '\n';
  // ﻿ (BOM) để Excel mở tệp UTF-8 không hỏng tiếng Việt.
  const blob = new Blob(['﻿' + text], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mau-danh-sach-vdv.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

const OR_STATUS = {
  pending: {t:'Chờ xác nhận', c:'blue'},
  confirmed: {t:'Đã xác nhận', c:'green'},
  removed: {t:'Đã bỏ khỏi đội', c:'gray'}
};

/* Vì sao một dòng không tạo được hồ sơ hội viên — hiện nguyên văn để vận hành
   biết phải bổ sung gì (thường là thiếu số điện thoại trong tệp). */
function orRosterResultRow(r){
  const label = {
    created: ['Đã tạo hội viên', 'green'],
    link: ['Đã là hội viên', 'green'],
    'squad-only': ['Chưa tạo được hội viên', 'gold'],
    skip: ['Bỏ qua', 'gray']
  }[r.action] || ['—', 'gray'];
  return `<tr>
    <td>${r.line}</td>
    <td>${escapeHtml(r.fullName||'')}</td>
    <td><span class="status ${label[1]}">${label[0]}</span></td>
    <td><span class="cell-muted">${escapeHtml(r.memberCode || r.reason || '')}</span></td>
  </tr>`;
}

function renderOrgRosterTab(record){
  if(orRosterState.orgId !== record.id) orRosterReset(record.id);
  if(!orRosterState.loaded){
    if(!orRosterState.loading) orRosterLoad(record.id);
    return `<div class="form-card" style="color:var(--hint)"><i class="ti ti-loader"></i> Đang tải danh sách vận động viên…</div>`;
  }

  const rows = orRosterState.athletes.filter(a=>a.status!=='removed');
  const confirmed = rows.filter(a=>a.status==='confirmed').length;
  const res = orRosterState.result;

  return `<div class="form-card" style="max-width:840px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <label style="font-size:12.5px;color:var(--ink);font-weight:600">Vận động viên của tổ chức</label>
      <span class="count-pill">${rows.length} người · ${confirmed} đã xác nhận</span>
    </div>
    <div class="fld-hint" style="margin:8px 0 14px">
      <i class="ti ti-info-circle"></i>
      Nhập từ tệp CSV: mỗi dòng được thêm vào danh sách của tổ chức ở trạng thái chờ xác nhận.
      Người chưa có hồ sơ hội viên cá nhân sẽ được tạo hồ sơ mới (trạng thái "Chờ thanh toán", chưa có mật khẩu đăng nhập).
      Người đã là hội viên thì chỉ gắn mã hội viên, không tạo trùng.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <button class="btn btn-primary" id="orRosterPick"><i class="ti ti-file-upload"></i> Nhập từ tệp CSV</button>
      <button class="btn btn-ghost" id="orRosterSample"><i class="ti ti-download"></i> Tải tệp CSV mẫu</button>
      <input type="file" id="orRosterFile" accept=".csv,text/csv" style="display:none">
    </div>

    ${res ? `<div class="re-section" style="margin-bottom:18px;padding-top:0">
      <div style="font-size:12.5px;color:var(--ink);font-weight:600;margin-bottom:8px">Kết quả lượt nhập</div>
      <div class="fld-hint" style="margin-bottom:10px"><i class="ti ti-check"></i> ${escapeHtml(res.message||'')}</div>
      <div class="tbl-wrap"><table><thead><tr><th style="width:50px">Dòng</th><th>Họ và tên</th><th style="width:170px">Kết quả</th><th>Mã hội viên / lý do</th></tr></thead>
      <tbody>${(res.rows||[]).map(orRosterResultRow).join('')}</tbody></table></div>
    </div>` : ''}

    ${rows.length ? `<div class="tbl-wrap"><table><thead><tr>
        <th>Vận động viên</th><th>Căn cước</th><th>Mã hội viên</th><th style="width:150px">Trạng thái</th>
      </tr></thead><tbody>
      ${rows.map(a=>{
        const st = OR_STATUS[a.status] || OR_STATUS.pending;
        /* Hiệu lực soi lại từ hồ sơ hội viên, giống hai màn hình kia — không đọc
           memberCode/memberValid máy chủ trả về (ảnh chụp lúc ghi). */
        const m = taMemberMatch(a.cccd);
        return `<tr>
          <td>${escapeHtml(a.fullName||'')}</td>
          <td><span class="cell-muted">${escapeHtml(a.cccd||'—')}</span></td>
          <td><span class="cell-muted">${m.code ? escapeHtml(m.code) + (m.valid ? '' : ` (${escapeHtml(m.label.toLowerCase())})`) : '—'}</span></td>
          <td><span class="status ${st.c}">${st.t}</span></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>
      <div class="fld-hint" style="margin-top:10px"><i class="ti ti-info-circle"></i> Xác nhận từng người ở module "VĐV thuộc đội".</div>`
      : `<div class="empty" style="border:1px dashed var(--line-strong);border-radius:var(--radius)">
          <i class="ti ti-users-group"></i><b>Chưa có vận động viên nào</b>Nhập từ tệp CSV để thêm cả danh sách.
        </div>`}
  </div>`;
}

async function orRosterImport(orgId, athletes){
  showToast(`Đang nhập ${athletes.length} dòng…`);
  try{
    const res = await apiFetch('/api/team-athletes/import', {
      method: 'POST',
      body: JSON.stringify({ teamDocId: orgId, athletes })
    });
    const out = await res.json().catch(()=>({}));
    if(!res.ok){
      showToast((out.error && out.error.message) || 'Không nhập được danh sách', true);
      return;
    }
    orRosterState.result = out;
    orRosterState.loaded = false;
    // Hồ sơ hội viên vừa tạo phải xuất hiện ở module "Hội viên & Xếp hạng" ngay,
    // không bắt vận hành bấm "Đồng bộ từ CSDL" mới thấy.
    await refreshRemoteCollection('members');
    await orRosterLoad(orgId);
    showToast(out.message || 'Đã nhập danh sách');
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
  }
}

function attachOrgRosterEvents(record){
  const pick = document.getElementById('orRosterPick');
  const file = document.getElementById('orRosterFile');
  const sample = document.getElementById('orRosterSample');
  if(sample) sample.addEventListener('click', orRosterDownloadSample);
  if(!pick || !file) return;
  pick.addEventListener('click', ()=>file.click());
  file.addEventListener('change', ()=>{
    const f = file.files && file.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = async (ev)=>{
      const athletes = orRosterCsvToAthletes(String(ev.target.result||''));
      file.value = '';
      if(!athletes.length){
        showToast('Không đọc được dòng nào trong tệp. Tải tệp CSV mẫu để xem đúng thứ tự cột.', true);
        return;
      }
      await orRosterImport(record.id, athletes);
    };
    reader.readAsText(f, 'utf-8');
  });
}
