/* =========================================================
   TOURNAMENT ENTRIES — tab "Đăng ký & Duyệt" của editor giải đấu

   Luồng đăng ký mới của Liên đoàn:
   - Giải thành tích cao: đội tỉnh/thành gửi danh sách VĐV (một đơn / một đội).
   - Giải phong trào: VĐV tự đăng ký.
   Cả hai đều vào collection tournament-entries với status 'pending'. Vận hành
   Liên đoàn duyệt TỪNG NGƯỜI vào danh sách thi đấu chính thức (mục 2.2), điều
   kiện là hội viên còn hiệu lực VÀ đã nộp lệ phí (mục 2.1). Máy chủ kiểm lại
   hai điều kiện này khi nhận status 'official' — nút ở đây chỉ là giao diện.

   Dữ liệu KHÔNG nằm trong DB cục bộ: bản ghi chứa CCCD/điện thoại nên không
   đồng bộ xuống localStorage, mỗi lần mở tab là nạp lại từ Strapi.
   ========================================================= */
const teEntryState = { tid: null, loading: false, loaded: false, entries: [], teamRegs: [], filter: 'all' };

function teEntryReset(tid){
  teEntryState.tid = tid;
  teEntryState.loading = false;
  teEntryState.loaded = false;
  teEntryState.entries = [];
  teEntryState.teamRegs = [];
}

async function teEntryLoad(tid){
  if(teEntryState.loading) return;
  teEntryState.loading = true;
  try{
    const q = `filters[tournamentDocId][$eq]=${encodeURIComponent(tid)}&pagination[pageSize]=300&sort=fullName:asc`;
    const [entriesRes, regsRes] = await Promise.all([
      apiFetch(`/api/tournament-entries?${q}`),
      apiFetch(`/api/team-registrations?filters[tournamentDocId][$eq]=${encodeURIComponent(tid)}&pagination[pageSize]=100&populate=*`)
    ]);
    teEntryState.entries = entriesRes.ok ? ((await entriesRes.json()).data || []) : [];
    teEntryState.teamRegs = regsRes.ok ? ((await regsRes.json()).data || []) : [];
    teEntryState.loaded = true;
  }catch(e){
    showToast('Không tải được danh sách đăng ký từ máy chủ', true);
    teEntryState.loaded = true;
  }
  teEntryState.loading = false;
  if(currentView === 'tournament-edit:'+tid && teTab==='entries') renderContent();
}

function teEntryCount(record){
  return (teEntryState.tid===record.id && teEntryState.loaded) ? teEntryState.entries.length : 0;
}

/* Lý do một VĐV chưa duyệt được — hiển thị nguyên văn để vận hành biết phải
   làm gì tiếp (nhắc đội nộp phí, hay hội viên phải gia hạn trước).

   Hiệu lực hội viên soi LẠI theo hồ sơ hiện tại (taMemberMatch) chứ không đọc
   `memberValid` lưu trên đơn: đơn giữ ảnh chụp lúc nộp, mà hồ sơ có thể vừa
   được duyệt hội phí hoặc vừa hết hạn sau đó. Máy chủ cũng soi lại đúng như vậy
   khi nhận status 'official' (confirmOfficial), nên hiển thị ở đây phải khớp —
   không thì CMS báo "chưa đủ điều kiện" trong khi bấm duyệt lại thành công. */
function teEntryBlockers(e){
  const out = [];
  if(!taMemberMatch(e.cccd).valid) out.push('chưa phải hội viên còn hiệu lực');
  if(!e.paid) out.push('chưa ghi nhận nộp lệ phí');
  return out;
}

function teEntryStatusBadge(e){
  if(e.status==='official') return `<span class="status green">Chính thức</span>`;
  if(e.status==='rejected') return `<span class="status gray">Đã từ chối</span>`;
  return `<span class="status blue">Chờ duyệt</span>`;
}

function teFmtDob(v){
  if(!v) return '—';
  const d = new Date(v);
  if(isNaN(d.getTime())) return escapeHtml(String(v));
  const p = x=>String(x).padStart(2,'0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`;
}

function renderTeEntriesTab(record){
  if(teEntryState.tid !== record.id){ teEntryReset(record.id); }
  if(!teEntryState.loaded){
    if(!teEntryState.loading) teEntryLoad(record.id);
    return `<div class="form-card" style="color:var(--hint)"><i class="ti ti-loader"></i> Đang tải danh sách đăng ký…</div>`;
  }

  const all = teEntryState.entries;
  const counts = {
    all: all.length,
    pending: all.filter(e=>e.status==='pending').length,
    official: all.filter(e=>e.status==='official').length,
    rejected: all.filter(e=>e.status==='rejected').length
  };
  if(!all.length){
    return `<div class="form-card">
      <div style="color:var(--hint);padding:12px 0"><i class="ti ti-inbox"></i> Chưa có đơn đăng ký nào cho giải này.
      ${record.nature==='grassroots' ? 'Giải phong trào: VĐV tự đăng ký trên website.' : 'Giải thành tích cao: đội tỉnh/thành đăng ký trên website bằng tài khoản đội.'}</div>
      <button class="btn btn-ghost" id="teEntryReloadBtn"><i class="ti ti-refresh"></i> Tải lại</button>
    </div>`;
  }

  const tabs = [
    {k:'all', t:'Tất cả'}, {k:'pending', t:'Chờ duyệt'},
    {k:'official', t:'Chính thức'}, {k:'rejected', t:'Đã từ chối'}
  ];
  const filterHtml = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
    ${tabs.map(t=>`<button class="btn ${teEntryState.filter===t.k?'btn-primary':'btn-ghost'}" data-teefilter="${t.k}">${t.t} (${counts[t.k]})</button>`).join('')}
  </div>`;

  const shown = teEntryState.filter==='all' ? all : all.filter(e=>e.status===teEntryState.filter);

  /* Gom theo đội để vận hành đọc cùng nhịp với đơn mà đội gửi lên; VĐV tự đăng
     ký (giải phong trào) dồn vào một nhóm riêng. */
  const groups = [];
  shown.forEach(e=>{
    const key = e.teamName || '(VĐV tự đăng ký)';
    let g = groups.find(x=>x.key===key);
    if(!g){ g = {key, rows:[]}; groups.push(g); }
    g.rows.push(e);
  });

  const groupsHtml = groups.map(g=>{
    const reg = teEntryState.teamRegs.find(r=>r.teamName===g.key);
    const leader = reg && (reg.leaderName || reg.leaderPhone)
      ? `<div style="font-size:12px;color:var(--hint);margin-top:2px">Trưởng đoàn: ${escapeHtml(reg.leaderName||'—')}${reg.leaderTitle?` — ${escapeHtml(reg.leaderTitle)}`:''}${reg.leaderPhone?` · ${escapeHtml(reg.leaderPhone)}`:''}${reg.file&&reg.file.url?` · <a href="${escapeAttr(mediaUrl(reg.file))}" target="_blank" rel="noopener">văn bản cử đoàn</a>`:''}</div>`
      : '';
    const rows = g.rows.map(e=>{
      const match = taMemberMatch(e.cccd);
      const blockers = teEntryBlockers(e);
      const canOfficial = e.status!=='official' && !blockers.length;
      return `<tr>
        <td>
          <div style="font-weight:600">${escapeHtml(e.fullName||'')}</div>
          <div style="font-size:11.5px;color:var(--hint)">${teFmtDob(e.dob)}${e.gender?` · ${escapeHtml(e.gender)}`:''}${e.phone?` · ${escapeHtml(e.phone)}`:''}</div>
          <div style="font-size:11.5px;color:var(--hint)">CCCD: ${e.cccd?escapeHtml(e.cccd):'chưa có'}</div>
        </td>
        <td>
          <div style="font-size:12.5px">${match.code ? escapeHtml(match.code) : '<span style="color:var(--hint)">chưa là hội viên</span>'}</div>
          <div style="font-size:11.5px;color:${match.valid?'var(--tag-green)':'var(--danger)'}">${escapeHtml(match.label)}</div>
        </td>
        <td>
          <div style="font-size:12.5px">${(Array.isArray(e.events)&&e.events.length)?escapeHtml(e.events.join(', ')):'—'}</div>
          <div style="font-size:11.5px;color:var(--hint)">Lệ phí: ${e.feeTotal?escapeHtml(e.feeTotal):'—'}</div>
        </td>
        <td><label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer;white-space:nowrap">
          <input type="checkbox" data-tee-paid="${e.documentId}" ${e.paid?'checked':''}> đã nộp
        </label></td>
        <td>${teEntryStatusBadge(e)}${blockers.length&&e.status!=='official'?`<div style="font-size:11.5px;color:var(--hint);margin-top:3px">${escapeHtml(blockers.join('; '))}</div>`:''}</td>
        <td class="actions">
          ${canOfficial?`<button class="btn-icon" data-tee-official="${e.documentId}" title="Xác nhận vào danh sách chính thức"><i class="ti ti-user-check"></i></button>`:''}
          ${e.status!=='rejected'?`<button class="btn-icon" data-tee-reject="${e.documentId}" title="Từ chối"><i class="ti ti-user-x"></i></button>`:''}
          ${e.status!=='pending'?`<button class="btn-icon" data-tee-pending="${e.documentId}" title="Đưa về chờ duyệt"><i class="ti ti-rotate"></i></button>`:''}
        </td>
      </tr>`;
    }).join('');

    return `<div style="margin-bottom:22px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
        <div>
          <div style="font-weight:600">${escapeHtml(g.key)} <span style="color:var(--hint);font-weight:400">— ${g.rows.length} VĐV</span></div>
          ${leader}
        </div>
      </div>
      <div class="tbl-wrap"><table class="tee-tbl">
        <thead><tr><th>Vận động viên</th><th style="width:150px">Hội viên</th><th>Nội dung & lệ phí</th><th style="width:100px">Thu phí</th><th style="width:170px">Trạng thái</th><th style="width:96px"></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }).join('');

  const officials = all.filter(e=>e.status==='official');
  const seedHint = officials.length
    ? `<div style="margin-top:8px;padding-top:16px;border-top:1px solid var(--line)">
        <button class="btn btn-primary" id="teEntrySeedBtn"><i class="ti ti-user-plus"></i> Đưa ${officials.length} VĐV chính thức vào danh sách người chơi</button>
        <div style="font-size:12px;color:var(--hint);margin-top:6px"><i class="ti ti-info-circle"></i> Chỉ thêm người chưa có trong danh sách, không xóa ai. Bốc thăm/ghép cặp vẫn làm ở tab "Cặp đấu & Kết quả" sau khi danh sách đã chốt.</div>
      </div>`
    : '';

  return `<div class="form-card">
    ${filterHtml}
    ${groupsHtml}
    <button class="btn btn-ghost" id="teEntryReloadBtn"><i class="ti ti-refresh"></i> Tải lại</button>
    ${seedHint}
  </div>`;
}

async function teEntryPatch(docId, data, okMsg){
  try{
    const res = await apiFetch(`/api/tournament-entries/${docId}`, { method:'PUT', body: JSON.stringify({ data }) });
    if(!res.ok){
      const out = await res.json().catch(()=>({}));
      showToast((out.error && out.error.message) || 'Không cập nhật được bản ghi đăng ký', true);
      return false;
    }
    const out = await res.json();
    const idx = teEntryState.entries.findIndex(e=>e.documentId===docId);
    if(idx>=0 && out.data) teEntryState.entries[idx] = out.data;
    if(okMsg) showToast(okMsg);
    return true;
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
    return false;
  }
}

/* Đưa danh sách chính thức sang danh sách người chơi của engine giải đấu. Giữ
   mã hội viên để engine cộng điểm ranking đúng người; VĐV chưa là hội viên vào
   dạng khách (memberId rỗng), như luồng "Thêm khách" đang có. */
async function teEntrySeedPlayers(){
  const record = teCurrentRecord();
  if(!record) return;
  const officials = teEntryState.entries.filter(e=>e.status==='official');
  if(!officials.length) return;
  if(!record.players) record.players = [];
  let added = 0;
  officials.forEach(e=>{
    const already = record.players.some(p=>
      (e.memberCode && p.memberCode===e.memberCode) ||
      (p.name||'').trim().toLowerCase() === (e.fullName||'').trim().toLowerCase()
    );
    if(already) return;
    const member = e.memberCode ? DB.members.find(m=>m.code===e.memberCode) : null;
    record.players.push({
      id: uid(), memberId: member ? member.id : null, memberCode: e.memberCode||'',
      name: e.fullName, club: e.teamName || (member && member.club) || '',
      registeredAt: Date.now(), feeStatus: 'paid'
    });
    added++;
  });
  if(!added){ showToast('Tất cả VĐV chính thức đã có trong danh sách người chơi'); return; }
  await saveDB();
  await teSyncTournamentToStrapi(record);
  showToast(`Đã thêm ${added} VĐV vào danh sách người chơi`);
  teTab = 'players';
  renderContent();
}

function attachTeEntriesTab(){
  document.querySelectorAll('[data-teefilter]').forEach(b=>b.addEventListener('click', ()=>{
    teEntryState.filter = b.getAttribute('data-teefilter');
    renderContent();
  }));
  const reload = document.getElementById('teEntryReloadBtn');
  if(reload) reload.addEventListener('click', ()=>{
    const tid = teEntryState.tid;
    teEntryReset(tid);
    renderContent();
  });
  document.querySelectorAll('[data-tee-paid]').forEach(cb=>cb.addEventListener('change', async ()=>{
    const ok = await teEntryPatch(cb.getAttribute('data-tee-paid'), { paid: cb.checked },
      cb.checked ? 'Đã ghi nhận nộp lệ phí' : 'Đã bỏ ghi nhận nộp lệ phí');
    if(!ok) cb.checked = !cb.checked;
    renderContent();
  }));
  document.querySelectorAll('[data-tee-official]').forEach(b=>b.addEventListener('click', async ()=>{
    await teEntryPatch(b.getAttribute('data-tee-official'), { status:'official' },
      'Đã đưa vào danh sách thi đấu chính thức');
    renderContent();
  }));
  document.querySelectorAll('[data-tee-reject]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!confirm('Từ chối đơn đăng ký của VĐV này?')) return;
    await teEntryPatch(b.getAttribute('data-tee-reject'), { status:'rejected' }, 'Đã từ chối đơn');
    renderContent();
  }));
  document.querySelectorAll('[data-tee-pending]').forEach(b=>b.addEventListener('click', async ()=>{
    await teEntryPatch(b.getAttribute('data-tee-pending'), { status:'pending' }, 'Đã đưa về chờ duyệt');
    renderContent();
  }));
  const seed = document.getElementById('teEntrySeedBtn');
  if(seed) seed.addEventListener('click', teEntrySeedPlayers);
}
