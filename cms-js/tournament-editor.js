/* =========================================================
   TOURNAMENT EDITOR (full-screen editor for Giải đấu, thay cho modal)
   Quản lý: Thông tin giải đấu · Danh sách người chơi (upload) ·
   Cặp đấu & Kết quả (tính điểm ranking hội viên tự động)
   ========================================================= */
const TE_WIN_POINTS = 25;
const TE_LOSS_POINTS = 5;
let teTab = 'info';
let teCsvText = '';
let teRrTab = 0;
let teView = {tx:40, ty:30, scale:1};
let teDragInfo = null;
let teMatchModal = null;

const TE_DEFAULT_PRIZES = [
  {rank:'1', cash:'20.000.000đ', item:'Cúp + Huy chương'},
  {rank:'2', cash:'10.000.000đ', item:'Bằng khen + Huy chương'},
  {rank:'3', cash:'5.000.000đ', item:'Bằng khen + Huy chương'},
  {rank:'4–5', cash:'2.000.000đ', item:'Bằng khen'},
  {rank:'6–10', cash:'1.000.000đ', item:'Giấy khen'},
  {rank:'11–20', cash:'—', item:'Áo đấu VBSF'}
];
const TE_DEFAULT_RULES = `Thi đấu theo thể thức đấu loại trực tiếp, tính điểm theo luật hiện hành của từng nội dung (Pool / Carom / Snooker).
Mỗi trận đấu theo thể thức best-of, số ván do Ban tổ chức công bố trước ngày thi đấu.
Cơ thủ có mặt trễ quá 15 phút so với giờ thi đấu được công bố sẽ bị xử thua trận đó.
Trường hợp hoà điểm ở vòng bảng, thứ hạng được xét theo hiệu số bàn thắng rồi đến kết quả đối đầu trực tiếp.
Khiếu nại kết quả trận đấu phải gửi cho trọng tài chính trong vòng 15 phút sau khi trận đấu kết thúc.
Cơ thủ cần có mã hội viên VBSF còn hiệu lực tại thời điểm đăng ký.`;
const TE_DEFAULT_ENTRY_FEE = '200.000đ / cơ thủ';

let teNewDraft = null;
function teRecord(id){
  return id==='new' ? null : DB.tournaments.find(r=>r.id===id);
}
function teResetNewDraft(){ teNewDraft = null; }
function teCurrentRecord(){
  const id = currentView.slice('tournament-edit:'.length);
  return id==='new' ? teNewDraft : teRecord(id);
}
function teSyncInfoFieldsIntoRecord(record){
  if(teTab!=='info') return;
  COLLECTIONS.tournaments.fields.forEach(f=>{
    const el = document.getElementById('f_'+f.key);
    if(el) record[f.key] = el.value;
  });
}
function teEnsureDefaults(record){
  if(!record.format) record.format = 'SE';
  if(!record.lives) record.lives = 3;
  if(!record.mode) record.mode = 'op';
  if(!record.players) record.players = [];
  if(!record.prizes || !record.prizes.length) record.prizes = TE_DEFAULT_PRIZES.map(p=>({...p}));
}
function teFormatLabel(fmt){
  return {SE:'Đấu loại trực tiếp',DE:'Đấu loại trực tiếp kép',RR:'Vòng tròn',SW:'Swiss (tính mạng)'}[fmt] || 'Đấu loại trực tiếp';
}
function teMatchCount(record){
  if(record.bracket) return Object.values(record.bracket.matches).filter(m=>m.status==='done').length;
  if(record.rr) return Object.values(record.rr.matches).filter(m=>m.win!=null).length;
  if(record.sw) return record.sw.matches.filter(m=>m.confirmed).length;
  return 0;
}

function renderTournamentEditor(id){
  const isNew = id==='new';
  let record;
  if(isNew){
    if(!teNewDraft) teNewDraft = {name:'',category:'',format:'SE',lives:3,mode:'op',status:'upcoming',date:'',participants:'',location:'',note:'',champion:'',entryFee:TE_DEFAULT_ENTRY_FEE,rules:TE_DEFAULT_RULES,prizes:TE_DEFAULT_PRIZES.map(p=>({...p})),players:[]};
    record = teNewDraft;
  } else {
    record = teRecord(id) || {};
  }
  teEnsureDefaults(record);
  if(isNew) teTab = 'info';
  if(!isNew && teTab!=='info' && teTab!=='players' && teTab!=='matches') teTab = 'info';

  const tabs = [
    {key:'info', label:'Thông tin', icon:'ti-info-circle'},
    {key:'players', label:`Danh sách người chơi${record.players.length?` (${record.players.length})`:''}`, icon:'ti-users', disabled:isNew},
    {key:'matches', label:`Cặp đấu & Kết quả${teMatchCount(record)?` (${teMatchCount(record)})`:''}`, icon:'ti-swords', disabled:isNew}
  ];

  const tabsHtml = `<div style="display:flex;gap:22px;border-bottom:1px solid var(--line);margin-bottom:20px">
    ${tabs.map(t=>`<span class="gd-tab ${teTab===t.key?'on':''}" data-tetab="${t.key}" style="${t.disabled?'opacity:.4;pointer-events:none':''}"><i class="ti ${t.icon}" style="margin-right:5px"></i>${t.label}</span>`).join('')}
  </div>`;

  const hint = isNew ? `<div style="font-size:12px;color:var(--hint);margin-bottom:16px"><i class="ti ti-info-circle"></i> Lưu thông tin giải đấu trước để mở khóa danh sách người chơi và cặp đấu.</div>` : '';

  let body = '';
  if(teTab==='info') body = renderTeInfoTab(record, isNew);
  else if(teTab==='players') body = renderTePlayersTab(record);
  else if(teTab==='matches') body = renderTeMatchesTab(record);

  return `<div class="news-editor">${tabsHtml}${hint}${body}</div>`;
}

function renderTeInfoTab(record, isNew){
  const c = COLLECTIONS.tournaments;
  const prizeRows = record.prizes.map((p,i)=>`<tr data-prow="${i}">
    <td><input type="text" data-prize-field="rank" data-prize-idx="${i}" value="${escapeAttr(p.rank)}" style="width:100%;border:1px solid var(--line-strong);border-radius:6px;padding:6px 8px"></td>
    <td><input type="text" data-prize-field="cash" data-prize-idx="${i}" value="${escapeAttr(p.cash)}" style="width:100%;border:1px solid var(--line-strong);border-radius:6px;padding:6px 8px"></td>
    <td><input type="text" data-prize-field="item" data-prize-idx="${i}" value="${escapeAttr(p.item)}" style="width:100%;border:1px solid var(--line-strong);border-radius:6px;padding:6px 8px"></td>
    <td class="actions"><button class="btn-icon" data-te-rm-prize="${i}" title="Xóa hạng"><i class="ti ti-trash"></i></button></td>
  </tr>`).join('');

  return `<div class="form-card" style="max-width:760px">
    <div class="form-grid">
      ${c.fields.map(f=>`<div class="fld ${f.span2?'span2':''}"><label>${f.label}${f.required?' <span class="req">*</span>':''}</label>${renderField(f, record[f.key])}</div>`).join('')}
    </div>
    <div style="margin-top:22px;padding-top:18px;border-top:1px solid var(--line)">
      <label style="font-size:12.5px;color:var(--ink);font-weight:600;display:block;margin-bottom:10px">Giải thưởng theo hạng</label>
      <div class="tbl-wrap"><table><thead><tr><th style="width:110px">Thứ hạng</th><th>Giải thưởng tiền mặt</th><th>Hiện vật</th><th style="width:50px"></th></tr></thead><tbody>${prizeRows}</tbody></table></div>
      <button type="button" class="btn btn-ghost" id="teAddPrizeBtn" style="margin-top:10px"><i class="ti ti-plus"></i> Thêm hạng</button>
    </div>
    <div class="form-actions" style="justify-content:space-between">
      ${!isNew ? `<button class="btn btn-danger-outline" id="teDeleteBtn"><i class="ti ti-trash"></i> Xóa giải đấu</button>` : `<span></span>`}
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="teCancelBtn">Hủy</button>
        <button class="btn btn-primary" id="teSaveInfoBtn"><i class="ti ti-check"></i> ${isNew?'Tạo giải đấu':'Lưu thông tin'}</button>
      </div>
    </div>
  </div>`;
}

function teAvailableMemberOptions(record){
  const usedIds = new Set(record.players.filter(p=>p.memberId).map(p=>p.memberId));
  return DB.members.filter(m=>!usedIds.has(m.id)).map(m=>`<option value="${m.id}">${escapeHtml(m.name)} — ${escapeHtml(m.code||'')}${m.club?` (${escapeHtml(m.club)})`:''}</option>`).join('');
}

function teFmtDateTime(ts){
  if(!ts) return '—';
  const d = new Date(ts), p = x=>String(x).padStart(2,'0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function renderTePlayersTab(record){
  const rows = record.players.map(p=>{
    const m = p.memberId ? DB.members.find(x=>x.id===p.memberId) : null;
    const paid = p.feeStatus==='paid';
    return `<tr data-pid="${p.id}">
      <td>${escapeHtml(p.name)}</td>
      <td class="cell-muted">${escapeHtml(p.club||'—')}</td>
      <td>${m ? `<span class="status green">Hội viên · ${escapeHtml(m.code||'')}</span>` : `<span class="status gray">Khách mời</span>`}</td>
      <td class="cell-muted">${teFmtDateTime(p.registeredAt)}</td>
      <td><select data-te-fee="${p.id}" style="width:auto;height:28px;border:1px solid var(--line-strong);border-radius:99px;padding:0 10px;font-size:12px;font-weight:600;color:${paid?'var(--tag-green)':'var(--tag-amber)'};background:${paid?'var(--tag-green-soft)':'var(--tag-amber-soft)'}">
        <option value="unpaid" ${!paid?'selected':''}>Chưa đóng phí</option>
        <option value="paid" ${paid?'selected':''}>Đã đóng phí</option>
      </select></td>
      <td class="actions"><button class="btn-icon" data-te-rm-player="${p.id}" title="Xóa"><i class="ti ti-x"></i></button></td>
    </tr>`;
  }).join('');

  const cap = Number(record.participants)||0;
  const over = cap>0 && record.players.length>cap;
  const capNote = (cap>0 && record.players.length>0) ? `<div style="font-size:12.5px;color:${over?'var(--tag-amber)':'var(--hint)'};margin-bottom:12px"><i class="ti ${over?'ti-alert-triangle':'ti-users'}"></i> Đã đăng ký ${record.players.length} / ${cap} người${over?' — vượt số lượng dự kiến, vẫn cho phép tiếp tục đăng ký':''}</div>` : '';

  return `${capNote}<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">
    <div class="card" style="flex:1;min-width:320px">
      <div class="card-head"><div><h2>Thêm người chơi</h2><div class="desc">Chọn nhiều hội viên để thêm cùng lúc, hoặc thêm khách mời</div></div></div>
      <div class="card-body padded">
        <div class="fld"><label>Chọn hội viên (giữ Ctrl/Cmd hoặc Shift để chọn nhiều)</label>
          <select id="te_p_members" multiple size="8" style="width:100%">${teAvailableMemberOptions(record)}</select>
        </div>
        <div class="form-actions" style="justify-content:flex-end;border-top:none;padding-top:10px;margin-top:10px">
          <button class="btn btn-primary" id="teAddPlayersBtn"><i class="ti ti-plus"></i> Thêm hội viên đã chọn</button>
        </div>
        <div style="border-top:1px solid var(--line);margin-top:16px;padding-top:16px">
          <div class="form-grid">
            <div class="fld"><label>Khách mời — Họ tên</label><input type="text" id="te_p_name" placeholder="Không phải hội viên"></div>
            <div class="fld"><label>Câu lạc bộ</label><input type="text" id="te_p_club" placeholder="CLB / Đơn vị"></div>
          </div>
          <div class="form-actions" style="justify-content:flex-end;border-top:none;padding-top:10px;margin-top:10px">
            <button class="btn btn-ghost" id="teAddGuestBtn"><i class="ti ti-user-plus"></i> Thêm khách mời</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card" style="flex:1;min-width:320px">
      <div class="card-head"><div><h2>Nhập danh sách (upload)</h2><div class="desc">Dán danh sách, mỗi dòng: Họ tên, SĐT hoặc Mã HV (tùy chọn), CLB (tùy chọn)</div></div></div>
      <div class="card-body padded">
        <div class="fld"><textarea id="te_csv" rows="6" placeholder="Nguyễn Văn A, 0901234567, CLB Sài Gòn&#10;Trần Thị B,, CLB Thủ Đô&#10;Lê Văn C">${escapeHtml(teCsvText)}</textarea></div>
        <input type="file" id="te_csv_file" accept=".csv,.txt" style="display:none">
        <div class="form-actions" style="justify-content:space-between;border-top:none;padding-top:10px;margin-top:10px">
          <button class="btn btn-ghost" id="teCsvFileBtn"><i class="ti ti-upload"></i> Tải file .csv/.txt</button>
          <button class="btn btn-primary" id="teImportCsvBtn"><i class="ti ti-list-check"></i> Nhập danh sách</button>
        </div>
      </div>
    </div>
  </div>
  <div class="tbl-wrap" style="margin-top:20px">
    ${record.players.length===0 ? `<div class="empty"><i class="ti ti-users"></i><b>Chưa có người chơi</b>Thêm hội viên hoặc nhập danh sách ở trên.</div>` : `<table><thead><tr><th>Họ tên</th><th>CLB</th><th>Liên kết</th><th>Thời gian đăng ký</th><th>Đóng phí</th><th style="width:60px"></th></tr></thead><tbody>${rows}</tbody></table>`}
  </div>`;
}

/* ---------- Cặp đấu & Kết quả — engine-driven (SE/DE/RR/Swiss) ---------- */
function teName(record, pid){
  if(pid==null) return '—';
  if(pid==='BYE') return '(Miễn đấu)';
  const p = record.players.find(x=>x.id===pid);
  return p ? p.name : '—';
}
function tePlayerRating(record, pid){
  if(pid==='BYE' || pid==null) return 1000;
  const p = record.players.find(x=>x.id===pid);
  if(!p) return 1000;
  if(p.rating) return p.rating;
  let r = 1000;
  if(p.memberId){
    const m = DB.members.find(x=>x.id===p.memberId);
    const d = m && (m.disciplines||[]).find(x=>x.category===record.category);
    if(d && d.points) r = 800 + Math.min(1400, d.points/2);
  } else r = 1000 + Math.round((Math.random()*2-1)*220);
  p.rating = r;
  return r;
}
function teFmtTime(ts){ const d = new Date(ts), p = x=>String(x).padStart(2,'0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }
function teRecordFromView(){
  const id = currentView.slice('tournament-edit:'.length);
  return teRecord(id);
}
function applyDisciplinePoints(member, category, pointsDelta, matchesDelta){
  if(!member || !category) return;
  if(!member.disciplines) member.disciplines = [];
  let d = member.disciplines.find(x=>x.category===category);
  if(!d){ d = {category, points:0, rank:null, matches:0, trend:'eq', trendValue:0}; member.disciplines.push(d); }
  d.points = (d.points||0) + pointsDelta;
  d.matches = Math.max(0, (d.matches||0) + matchesDelta);
}
function teAwardPoints(record, winnerPid, loserPid, winPoints, lossPoints){
  if(record.mode==='sim') return;
  const winnerPlayer = record.players.find(p=>p.id===winnerPid);
  const loserPlayer = loserPid ? record.players.find(p=>p.id===loserPid) : null;
  if(winnerPlayer && winnerPlayer.memberId){ applyDisciplinePoints(DB.members.find(x=>x.id===winnerPlayer.memberId), record.category, winPoints, 1); }
  if(loserPlayer && loserPlayer.memberId){ applyDisciplinePoints(DB.members.find(x=>x.id===loserPlayer.memberId), record.category, lossPoints, 1); }
}
function teReversePoints(record, winnerPid, loserPid, winPoints, lossPoints){
  if(record.mode==='sim') return;
  const winnerPlayer = record.players.find(p=>p.id===winnerPid);
  const loserPlayer = loserPid ? record.players.find(p=>p.id===loserPid) : null;
  if(winnerPlayer && winnerPlayer.memberId){ applyDisciplinePoints(DB.members.find(x=>x.id===winnerPlayer.memberId), record.category, -winPoints, -1); }
  if(loserPlayer && loserPlayer.memberId){ applyDisciplinePoints(DB.members.find(x=>x.id===loserPlayer.memberId), record.category, -lossPoints, -1); }
}
function teReverseAllPoints(record){
  if(record.bracket){
    Object.values(record.bracket.matches).forEach(m=>{
      if(m.status==='done' && m.p2!=null && m.p1!=='BYE' && m.p2!=='BYE'){
        const loserId = m.win===m.p1?m.p2:m.p1;
        teReversePoints(record, m.win, loserId, m.winPoints||0, m.lossPoints||0);
      }
    });
  }
  if(record.rr){
    Object.values(record.rr.matches).forEach(m=>{
      if(m.win!=null) teReversePoints(record, m.win, m.win===m.a?m.b:m.a, m.winPoints!=null?m.winPoints:TE_WIN_POINTS, m.lossPoints!=null?m.lossPoints:TE_LOSS_POINTS);
    });
  }
  if(record.sw){
    record.sw.matches.filter(m=>m.confirmed && !m.bye).forEach(m=>{
      teReversePoints(record, m.winnerId, m.winnerId===m.aId?m.bId:m.aId, m.winPoints!=null?m.winPoints:TE_WIN_POINTS, m.lossPoints!=null?m.lossPoints:TE_LOSS_POINTS);
    });
  }
}
function teGetChampion(record){
  if(record.format==='SE'||record.format==='DE'){ if(!record.bracket) return null; return tbkElimChampion(record.bracket); }
  if(record.format==='RR'){
    if(!record.rr) return null;
    const ids = record.players.map(p=>p.id);
    const total = Object.keys(record.rr.matches).length;
    if(!total) return null;
    const done = Object.values(record.rr.matches).filter(m=>m.win!=null).length;
    if(done<total) return null;
    const st = tbkRrStandings(record.rr, ids, id=>teName(record,id));
    return st[0] ? st[0].id : null;
  }
  if(record.format==='SW'){
    if(!record.sw || !tbkSwissDrawn(record.sw)) return null;
    const lives = record.lives||3;
    const st = tbkSwDerive(record.players.map(p=>p.id), lives, record.sw.matches);
    const alive = record.players.filter(p=>st[p.id].alive);
    return alive.length===1 ? alive[0].id : null;
  }
  return null;
}
function teCheckComplete(record){
  const champId = teGetChampion(record);
  if(champId){ record.champion = teName(record, champId); record.status = 'completed'; }
}

function renderTeMatchesTab(record){
  const generated = record.bracket || record.rr || record.sw;
  if(!generated) return teRenderMatchesSetup(record);

  const ctl = `<div class="tbk-ctl">
    <span class="tbk-badge ${record.mode==='sim'?'sim':'op'}">${record.mode==='sim'?'Mô phỏng':'Vận hành'}</span>
    <b>${teFormatLabel(record.format)}</b><span class="cell-muted">· ${record.players.length} người chơi</span>
    ${record.mode==='sim' ? `<button class="btn btn-ghost" id="tbSimNext" style="margin-left:auto"><i class="ti ti-player-play"></i> Chạy 1 trận</button><button class="btn btn-primary" id="tbSimAll"><i class="ti ti-player-track-next"></i> Chạy hết</button>` : ''}
    <button class="btn btn-danger-outline" id="tbResetBtn" style="${record.mode==='sim'?'':'margin-left:auto'}"><i class="ti ti-refresh"></i> Tạo lại sơ đồ</button>
  </div>`;

  let body = '';
  if(record.format==='SE' || record.format==='DE'){
    body = `<div class="card" style="padding:0;overflow:hidden"><div class="tbk-wrap">
      <div class="tbk-view" id="tbkView"><div class="tbk-stage" id="tbkStage"></div></div>
      <div class="tbk-label" id="tbkLabel"></div>
      <div class="tbk-zoom"><button data-tbz="out" title="Thu nhỏ"><i class="ti ti-zoom-out"></i></button><button data-tbz="fit" title="Vừa khung"><i class="ti ti-focus-2"></i></button><button data-tbz="in" title="Phóng to"><i class="ti ti-zoom-in"></i></button></div>
    </div></div>`;
  } else if(record.format==='RR'){
    body = teRenderRR(record);
  } else {
    body = teRenderSwiss(record);
  }
  return ctl+body;
}

function teRenderMatchesSetup(record){
  const fmt = record.format || 'SE';
  const min = fmt==='DE' ? 3 : 2;
  const can = record.players.length>=min;
  const modeCard = (key,title,desc)=>{
    const on = (record.mode||'op')===key;
    return `<div data-tbmode="${key}" style="flex:1;min-width:220px;cursor:pointer;border:1px solid ${on?'var(--vd)':'var(--line-strong)'};background:${on?'var(--surface)':'#fff'};border-radius:10px;padding:14px">
      <b style="color:${on?'var(--vd)':'var(--ink)'}">${title}</b>
      <div class="cell-muted" style="margin-top:4px;font-size:12.5px">${desc}</div>
    </div>`;
  };
  return `<div class="card"><div class="card-head"><div><h2>Chế độ</h2><div class="desc">Chọn cách vận hành trước khi tạo sơ đồ thi đấu</div></div></div>
    <div class="card-body padded" style="display:flex;gap:10px;flex-wrap:wrap">
      ${modeCard('op','Vận hành giải thật','Ban tổ chức tự nhập kết quả từng trận, cộng điểm xếp hạng hội viên thật')}
      ${modeCard('sim','Mô phỏng','Tự sinh kết quả ngẫu nhiên để xem trước sơ đồ hoạt động — không cộng điểm thật')}
    </div>
  </div>
  ${teRenderPlayerSeedList(record)}
  ${(fmt==='SE'||fmt==='DE') ? teRenderSeedPairPreview(record) : ''}
  <div class="card" style="margin-top:16px"><div class="card-body padded" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div class="cell-muted">${can?`Sẵn sàng tạo sơ đồ cho ${record.players.length} người chơi theo thể thức <b>${teFormatLabel(fmt)}</b>. Danh sách người chơi sẽ khóa lại sau khi tạo.`:`Cần tối thiểu ${min} người chơi để tạo sơ đồ theo thể thức ${teFormatLabel(fmt)} (hiện có ${record.players.length}).`}</div>
    <button class="btn btn-primary" id="tbStartBtn" ${can?'':'disabled'}><i class="ti ti-swords"></i> Tạo sơ đồ thi đấu</button>
  </div></div>`;
}
function teRenderPlayerSeedList(record){
  if(!record.players.length){
    return `<div class="card" style="margin-top:16px"><div class="card-body padded"><div class="empty" style="padding:20px"><i class="ti ti-users"></i><b>Chưa có người chơi</b>Thêm hội viên hoặc khách mời ở tab "Danh sách người chơi" trước khi tạo sơ đồ.</div></div></div>`;
  }
  const chips = record.players.map((p,i)=>`<span class="badge" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-size:12.5px">
    <span style="color:var(--hint);font-weight:700">#${i+1}</span> <b>${escapeHtml(p.name)}</b>${p.club?` <span class="cell-muted">· ${escapeHtml(p.club)}</span>`:''}
  </span>`).join('');
  return `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Danh sách người chơi</h2><div class="desc">${record.players.length} người · Thứ tự hạt giống theo thứ tự thêm vào danh sách</div></div></div>
    <div class="card-body padded" style="display:flex;flex-wrap:wrap;gap:8px">${chips}</div>
  </div>`;
}
function teRenderSeedPairPreview(record){
  const n = record.players.length;
  if(n<2) return '';
  const size = tbkNextPow2(n);
  const seeds = tbkBracketSeeds(size);
  const pid = s=>(s<=n?record.players[s-1]:null);
  const rows = [];
  for(let i=0;i<size/2;i++){
    const a = pid(seeds[2*i]), b = pid(seeds[2*i+1]);
    rows.push({a,b});
  }
  const fixtures = rows.map(r=>`<div class="tbk-fix">
    <span class="pn">${r.a?`<span style="color:var(--hint);font-weight:700">#${record.players.indexOf(r.a)+1}</span> ${escapeHtml(r.a.name)}`:''}</span>
    <span class="vs">vs</span>
    <span class="pn r">${r.b?`${escapeHtml(r.b.name)} <span style="color:var(--hint);font-weight:700">#${record.players.indexOf(r.b)+1}</span>`:'<span class="cell-muted">(miễn đấu — BYE)</span>'}</span>
  </div>`).join('');
  return `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Xem trước bắt cặp vòng 1</h2><div class="desc">Ghép theo hạt giống${size>n?` · ${size-n} người được miễn đấu (BYE) vòng đầu`:''} — sẽ được chốt khi tạo sơ đồ</div></div></div>
    <div class="card-body padded">${fixtures}</div>
  </div>`;
}
function teStartBracket(record){
  record.players.forEach((p,i)=>{ p.seed=i+1; });
  const fmt = record.format || 'SE';
  const seedIds = record.players.map(p=>p.id);
  if(fmt==='SE') record.bracket = tbkGenSE(seedIds);
  else if(fmt==='DE') record.bracket = tbkGenDE(seedIds);
  else if(fmt==='RR') record.rr = tbkGenRR(seedIds);
  else record.sw = {round:1, matches:[], seq:1};
  if(record.status==='upcoming') record.status = 'ongoing';
  teRrTab = 0;
  teView = {tx:40, ty:30, scale:1};
  saveDB();
  renderSidebar();
  showToast('Đã tạo sơ đồ thi đấu');
  renderContent();
  if(fmt==='SE'||fmt==='DE') setTimeout(()=>teFitBracket(record), 30);
}
function teResetBracket(record){
  if(!confirm('Tạo lại sơ đồ sẽ xóa toàn bộ kết quả đã nhập và hoàn tác điểm xếp hạng đã cộng (nếu có). Danh sách người chơi được giữ nguyên. Tiếp tục?')) return;
  teReverseAllPoints(record);
  record.bracket = null; record.rr = null; record.sw = null;
  if(record.status==='completed') record.status = 'ongoing';
  record.champion = '';
  recomputeMemberRanking();
  saveDB();
  renderSidebar();
  showToast('Đã đặt lại sơ đồ thi đấu');
  renderContent();
}

/* ---- SE / DE bracket ---- */
function teLayoutSE(eng){
  const rounds=eng.rounds, CW=188, CH=62, GX=66, GY=20;
  const pos={}; const rh=CH+GY;
  rounds[0].forEach((id,i)=>pos[id]={x:0,y:i*rh});
  for(let r=1;r<rounds.length;r++) rounds[r].forEach((id,i)=>{
    const c1=pos[rounds[r-1][2*i]], c2=pos[rounds[r-1][2*i+1]]; pos[id]={x:r*(CW+GX), y:(c1.y+c2.y)/2};
  });
  const labels = rounds.map((rd,r)=>({x:r*(CW+GX), txt:tbkRoundName(r, rounds.length)}));
  return {pos, W:rounds.length*(CW+GX), H:rounds[0].length*rh, labels, CW, CH};
}
function teLayoutDE(eng){
  const WB=eng.WB, LB=eng.LB, CW=188, CH=62, GX=66, GY=18;
  const pos={}; const rh=CH+GY;
  WB[0].forEach((id,i)=>pos[id]={x:0,y:i*rh});
  for(let r=1;r<WB.length;r++) WB[r].forEach((id,i)=>{ const c1=pos[WB[r-1][2*i]], c2=pos[WB[r-1][2*i+1]]; pos[id]={x:r*(CW+GX), y:(c1.y+c2.y)/2}; });
  const wbH=WB[0].length*rh, band=wbH+50;
  LB.forEach((col,r)=>{ const x=r*(CW+GX); col.forEach((id,i)=>pos[id]={x, y:band+i*rh}); });
  const gfx = Math.max(WB.length, LB.length)*(CW+GX);
  pos[eng.gfId] = {x:gfx, y:(wbH)/2-CH/2};
  if(eng.matches[eng.gf2Id].status!=='void') pos[eng.gf2Id] = {x:gfx, y:wbH/2+rh};
  const labels=[]; WB.forEach((c,r)=>labels.push({x:r*(CW+GX), y:-22, txt:'WB '+tbkRoundName(r, WB.length)}));
  LB.forEach((c,r)=>labels.push({x:r*(CW+GX), y:band-22, txt:'LB Vòng '+(r+1)}));
  labels.push({x:gfx, y:-22, txt:'Chung kết'});
  const maxLBy = band + Math.max(...LB.map(c=>c.length))*rh;
  return {pos, W:gfx+CW, H:Math.max(wbH, maxLBy), labels, CW, CH};
}
function teMatchCardHtml(record, m, p, CW){
  const row=(pid,won)=>{
    const bye = pid==='BYE';
    const nm = pid==null ? '<span style="color:var(--hint)">— chờ —</span>' : (bye?'BYE':escapeHtml(teName(record,pid)));
    const player = (pid && pid!=='BYE') ? record.players.find(x=>x.id===pid) : null;
    const seed = player ? `#${player.seed}` : '';
    const sc = pid===m.p1 ? m.s1 : (pid===m.p2 ? m.s2 : null);
    return `<div class="br ${won?'w':''} ${bye?'bye':''}"><span class="sd">${seed}</span><span class="pn">${nm}</span><span class="sc">${sc!=null?sc:''}</span></div>`;
  };
  const aw = m.win!=null && m.win===m.p1, bw = m.win!=null && m.win===m.p2;
  const cls = (m.br==='GF'||m.br==='GF2') ? 'tbk-m gf' : 'tbk-m '+(m.status==='ready'?'ready':'');
  return `<div class="${cls}" data-tbm="${m.id}" style="left:${p.x}px;top:${p.y}px;width:${CW}px">${row(m.p1,aw)}${row(m.p2,bw)}</div>`;
}
function teDrawBracket(record){
  const eng = record.bracket;
  const stage = document.getElementById('tbkStage');
  if(!stage || !eng) return;
  const L = eng.type==='SE' ? teLayoutSE(eng) : teLayoutDE(eng);
  const M = eng.matches;
  let svg = `<svg class="tbk-conn" width="${L.W+200}" height="${L.H+120}">`;
  for(const id in M){
    const m=M[id]; const p=L.pos[id]; if(!p) continue;
    [['winTo','#22A56F'],['loseTo','#CD5B45']].forEach(([key,col])=>{
      const t=m[key]; if(!t || !L.pos[t[0]]) return;
      const tp=L.pos[t[0]];
      const x1=p.x+L.CW, y1=p.y+L.CH/2, x2=tp.x, y2=tp.y+(t[1]===1?16:46);
      const mx=(x1+x2)/2;
      svg += `<path d="M${x1} ${y1} H${mx} V${y2} H${x2}" stroke="${col}" stroke-width="1.5" fill="none" opacity="${key==='loseTo'?0.5:0.85}"/>`;
    });
  }
  svg += `</svg>`;
  let cards='';
  for(const id in M){ const m=M[id]; const p=L.pos[id]; if(!p) continue; if(m.br==='GF2'&&m.status==='void') continue; cards += teMatchCardHtml(record, m, p, L.CW); }
  const labs = L.labels.map(l=>`<div class="tbk-rlabel" style="left:${l.x}px;top:${(l.y!=null?l.y:-22)}px">${escapeHtml(l.txt)}</div>`).join('');
  stage.style.transform = `translate(${teView.tx}px,${teView.ty}px) scale(${teView.scale})`;
  stage.style.paddingTop = '28px';
  stage.innerHTML = svg+labs+cards;
  const champId = tbkElimChampion(eng);
  const label = document.getElementById('tbkLabel');
  if(label) label.innerHTML = champId ? `<i class="ti ti-trophy" style="color:var(--gold)"></i> Vô địch: <span class="tbk-champ">${escapeHtml(teName(record,champId))}</span>` : 'Kéo để di chuyển · cuộn để phóng to · bấm trận để nhập kết quả';
}
function teBindBracketView(record){
  teDrawBracket(record);
  const viewEl = document.getElementById('tbkView');
  if(!viewEl) return;
  viewEl.addEventListener('wheel', e=>{
    e.preventDefault();
    const r = viewEl.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    const ns = Math.min(2, Math.max(.35, teView.scale*(e.deltaY<0?1.12:0.89)));
    teView.tx = mx-(mx-teView.tx)*(ns/teView.scale);
    teView.ty = my-(my-teView.ty)*(ns/teView.scale);
    teView.scale = ns;
    teApplyView();
  }, {passive:false});
  viewEl.onpointerdown = e=>{ teDragInfo={x:e.clientX,y:e.clientY,tx:teView.tx,ty:teView.ty,moved:false}; viewEl.classList.add('drag'); viewEl.setPointerCapture(e.pointerId); };
  viewEl.onpointermove = e=>{ if(!teDragInfo) return; const dx=e.clientX-teDragInfo.x, dy=e.clientY-teDragInfo.y; if(Math.abs(dx)+Math.abs(dy)>4) teDragInfo.moved=true; teView.tx=teDragInfo.tx+dx; teView.ty=teDragInfo.ty+dy; teApplyView(); };
  viewEl.onpointerup = e=>{
    const moved = teDragInfo && teDragInfo.moved;
    viewEl.classList.remove('drag'); teDragInfo=null;
    if(!moved){ const card=e.target.closest('.tbk-m'); if(card) teOpenMatchModal(card.getAttribute('data-tbm')); }
  };
  document.querySelectorAll('[data-tbz]').forEach(b=>b.addEventListener('click', ()=>{
    const z=b.getAttribute('data-tbz');
    if(z==='in') teView.scale=Math.min(2, teView.scale*1.2);
    else if(z==='out') teView.scale=Math.max(.35, teView.scale/1.2);
    else return teFitBracket(record);
    teApplyView();
  }));
}
function teApplyView(){ const st=document.getElementById('tbkStage'); if(st) st.style.transform=`translate(${teView.tx}px,${teView.ty}px) scale(${teView.scale})`; }
function teFitBracket(record){
  const eng = record.bracket; if(!eng) return;
  const L = eng.type==='SE' ? teLayoutSE(eng) : teLayoutDE(eng);
  const v = document.getElementById('tbkView'); if(!v) return;
  const r = v.getBoundingClientRect();
  const sc = Math.min((r.width-40)/(L.W+40), (r.height-60)/(L.H+60), 1.1);
  teView.scale = Math.max(.35, sc); teView.tx = 20; teView.ty = 40; teApplyView();
}
function teOpenMatchModal(mid){
  const record = teRecordFromView();
  if(!record || !record.bracket) return;
  const M = record.bracket.matches; const m = M[mid];
  if(!m || m.p1==null || m.p2==null || m.p1==='BYE' || m.p2==='BYE') return;
  teMatchModal = {mid};
  const row=(pid,won)=>{
    const p = record.players.find(x=>x.id===pid);
    const sc = pid===m.p1 ? m.s1 : m.s2;
    return `<div class="tbk-modline"><span class="pn ${won?'tbk-winner':''}">${escapeHtml(p?p.name:'—')}</span><input type="number" min="0" id="tbm_s_${pid}" value="${sc!=null?sc:''}"></div>`;
  };
  document.getElementById('modalTitle').textContent = m.br==='GF'?'Chung kết':m.br==='GF2'?'Chung kết (tái đấu)':m.br==='L'?'Nhánh thua':'Trận đấu';
  document.getElementById('modalBody').innerHTML = `
    ${row(m.p1, m.win===m.p1)}${row(m.p2, m.win===m.p2)}
    <div class="form-grid" style="margin-top:14px">
      <div class="fld"><label>Điểm xếp hạng — Thắng</label><input type="number" id="tbm_wpts" value="${m.winPoints!=null?m.winPoints:TE_WIN_POINTS}"></div>
      <div class="fld"><label>Điểm xếp hạng — Thua</label><input type="number" id="tbm_lpts" value="${m.lossPoints!=null?m.lossPoints:TE_LOSS_POINTS}"></div>
    </div>
    ${record.mode==='sim' ? `<div style="margin-top:14px"><button type="button" class="btn btn-ghost" id="tbmAutoBtn"><i class="ti ti-dice-5"></i> Tự xử (mô phỏng ngẫu nhiên)</button></div>` : ''}
  `;
  document.querySelector('#modalOverlay .modal').classList.remove('wide');
  document.getElementById('modalDeleteBtn').style.display = 'none';
  document.getElementById('modalSaveBtn').style.display = '';
  document.getElementById('modalOverlay').classList.add('on');
  const auto = document.getElementById('tbmAutoBtn');
  if(auto) auto.addEventListener('click', ()=>{
    const r = tbkSimScore(m.p1, m.p2, pid=>tePlayerRating(record,pid));
    document.getElementById('tbm_s_'+m.p1).value = r.win===m.p1?r.ws:r.ls;
    document.getElementById('tbm_s_'+m.p2).value = r.win===m.p2?r.ws:r.ls;
  });
}
function closeTeMatchModal(){ document.getElementById('modalOverlay').classList.remove('on'); teMatchModal=null; }
function saveTeMatchModal(){
  const record = teRecordFromView();
  if(!record || !teMatchModal || !record.bracket) return;
  const mid = teMatchModal.mid;
  const M = record.bracket.matches; const m = M[mid];
  if(!m) return;
  const s1 = Number(document.getElementById('tbm_s_'+m.p1).value);
  const s2 = Number(document.getElementById('tbm_s_'+m.p2).value);
  if(!Number.isFinite(s1) || !Number.isFinite(s2) || s1===s2){ showToast('Vui lòng nhập tỷ số hợp lệ, phải có người thắng.', true); return; }
  const winPoints = Number(document.getElementById('tbm_wpts').value)||0;
  const lossPoints = Number(document.getElementById('tbm_lpts').value)||0;
  teSubmitElimResult(record, mid, s1, s2, winPoints, lossPoints);
  closeTeMatchModal();
}
function teSubmitElimResult(record, mid, s1, s2, winPoints, lossPoints){
  const M = record.bracket.matches; const m = M[mid];
  const winId = s1>s2 ? m.p1 : m.p2;
  if(m.status==='done'){
    const t = m.winTo && M[m.winTo[0]];
    if(t && t.status==='done'){ showToast('Không thể sửa: trận sau đã có kết quả. Hãy sửa từ trận muộn nhất.', true); return; }
    const oldLoserId = (m.win===m.p1?m.p2:m.p1);
    teReversePoints(record, m.win, oldLoserId, m.winPoints||0, m.lossPoints||0);
    if(m.winTo){ const tm=M[m.winTo[0]]; if(m.winTo[1]===1) tm.p1=null; else tm.p2=null; tm.status='wait'; }
    if(m.loseTo){ const tm=M[m.loseTo[0]]; if(m.loseTo[1]===1) tm.p1=null; else tm.p2=null; tm.status='wait'; }
  }
  const loseId = tbkDecide(M, mid, winId, s1, s2);
  m.winPoints = winPoints; m.lossPoints = lossPoints; m.decidedAt = Date.now();
  if(m.br==='GF'){
    const g2 = M[record.bracket.gf2Id];
    if(winId===m.p2){ g2.status='ready'; g2.p1=m.p1; g2.p2=m.p2; } else { g2.status='void'; }
  }
  tbkResolveByes(M);
  teAwardPoints(record, winId, loseId, winPoints, lossPoints);
  recomputeMemberRanking();
  teCheckComplete(record);
  saveDB();
  renderSidebar();
  showToast('Đã ghi nhận kết quả và cập nhật bảng xếp hạng');
  renderContent();
}

/* ---- Round Robin ---- */
function teRenderRR(record){
  const rr = record.rr;
  const ids = record.players.map(p=>p.id);
  const total = Object.keys(rr.matches).length;
  const done = Object.values(rr.matches).filter(m=>m.win!=null).length;
  const st = tbkRrStandings(rr, ids, id=>teName(record,id));
  const tbl = `<div class="card"><div class="card-head"><div><h2>Bảng xếp hạng</h2><div class="desc">${done}/${total} trận</div></div></div>
    <div class="tbl-wrap"><table><thead><tr><th style="width:34px">#</th><th>Người chơi</th><th style="width:60px">Thắng</th><th style="width:60px">Thua</th><th style="width:60px">+/−</th><th style="width:60px">Điểm</th></tr></thead>
    <tbody>${st.map((s,i)=>`<tr><td class="cell-muted">${i+1}</td><td><b>${escapeHtml(teName(record,s.id))}</b></td><td style="text-align:center">${s.w}</td><td style="text-align:center">${s.l}</td><td style="text-align:center">${s.gd>0?'+':''}${s.gd}</td><td style="text-align:center"><b>${s.pts}</b></td></tr>`).join('')}</tbody></table></div></div>`;
  const rounds = rr.rounds;
  if(teRrTab>=rounds.length) teRrTab=0;
  const tabs = `<div class="tbk-rrtab">${rounds.map((r,i)=>`<button class="${teRrTab===i?'on':''}" data-tbrt="${i}">Vòng ${i+1}</button>`).join('')}</div>`;
  const cur = rounds[teRrTab] || [];
  const fixtures = cur.map(id=>{
    const m=rr.matches[id]; const isDone=m.win!=null; const aw=m.win===m.a;
    if(isDone) return `<div class="tbk-fix"><span class="pn ${aw?'w':'l'}">${escapeHtml(teName(record,m.a))}</span><span class="tbk-res" style="padding:3px 9px;font-size:13px">${m.s1}–${m.s2}</span><span class="pn r ${aw?'l':'w'}">${escapeHtml(teName(record,m.b))}</span><button class="btn-icon" data-tbredit="${id}" title="Sửa"><i class="ti ti-edit"></i></button></div>`;
    return `<div class="tbk-fix"><span class="pn">${escapeHtml(teName(record,m.a))}</span><input type="number" min="0" id="tb_ra_${id}"><span class="vs">–</span><input type="number" min="0" id="tb_rb_${id}"><span class="pn r">${escapeHtml(teName(record,m.b))}</span><button class="btn-icon" data-tbrsave="${id}" title="Lưu"><i class="ti ti-device-floppy"></i></button></div>`;
  }).join('') || `<div class="empty">Vòng này không có trận.</div>`;
  const fix = `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Lịch thi đấu</h2></div></div>${tabs}<div class="card-body padded">${fixtures}</div></div>`;
  return tbl+fix;
}
function teSaveRRResult(mid){
  const record = teRecordFromView(); if(!record) return;
  const m = record.rr.matches[mid]; if(!m) return;
  const s1 = Number(document.getElementById('tb_ra_'+mid).value);
  const s2 = Number(document.getElementById('tb_rb_'+mid).value);
  if(!Number.isFinite(s1) || !Number.isFinite(s2) || s1===s2){ showToast('Vui lòng nhập tỷ số hợp lệ.', true); return; }
  m.s1=s1; m.s2=s2; m.win = s1>s2 ? m.a : m.b;
  m.winPoints = TE_WIN_POINTS; m.lossPoints = TE_LOSS_POINTS; m.decidedAt = Date.now();
  teAwardPoints(record, m.win, m.win===m.a?m.b:m.a, m.winPoints, m.lossPoints);
  recomputeMemberRanking();
  teCheckComplete(record);
  saveDB();
  renderSidebar();
  showToast('Đã ghi nhận kết quả và cập nhật bảng xếp hạng');
  renderContent();
}
function teEditRRResult(mid){
  const record = teRecordFromView(); if(!record) return;
  const m = record.rr.matches[mid]; if(!m) return;
  if(m.win!=null){
    teReversePoints(record, m.win, m.win===m.a?m.b:m.a, m.winPoints!=null?m.winPoints:TE_WIN_POINTS, m.lossPoints!=null?m.lossPoints:TE_LOSS_POINTS);
    recomputeMemberRanking();
  }
  m.win=null; m.s1=null; m.s2=null;
  saveDB();
  renderSidebar();
  renderContent();
}

/* ---- Swiss (lives) ---- */
function teRenderSwiss(record){
  const lives = record.lives||3;
  const sw = record.sw;
  const st = tbkSwDerive(record.players.map(p=>p.id), lives, sw.matches);
  const sorted = record.players.slice().sort((A,B)=>{
    const a=st[A.id], b=st[B.id];
    if(a.alive!==b.alive) return a.alive?-1:1;
    if(a.alive){ if(a.losses!==b.losses) return a.losses-b.losses; if(a.wins!==b.wins) return b.wins-a.wins; return tbkSwSos(st,b.id)-tbkSwSos(st,a.id); }
    return b.wins-a.wins;
  });
  const aliveCount = record.players.filter(p=>st[p.id].alive).length;
  let champHtml = '';
  if(aliveCount<=1 && tbkSwissDrawn(sw)){ const c=sorted[0]; champHtml = `<div class="tbk-champbar"><i class="ti ti-trophy" style="color:var(--gold)"></i> Vô địch: ${escapeHtml(c.name)}</div>`; }
  const lb = `<div class="card"><div class="card-head"><div><h2>Bảng xếp hạng</h2><div class="desc">${record.players.length} người · ${lives} mạng</div></div></div>
    <div class="card-body padded" style="padding-top:8px">${champHtml}${sorted.map((p,i)=>{
      const s=st[p.id]; const dead=!s.alive;
      const t = lives<=1?0:s.losses/(lives-1); const h=Math.round(150-t*142);
      let balls='<div class="tbk-lives">'; for(let k=0;k<lives;k++) balls+=`<div class="tbk-ball ${k<s.left?'':'gone'}"></div>`; balls+='</div>';
      return `<div class="tbk-row ${dead?'dead':''}"><div class="rk">${i+1}</div><div class="who"><b>${escapeHtml(p.name)}</b></div>
        ${dead?'<span class="tbk-grp" style="color:var(--hint);background:var(--surface)">—</span>':`<span class="tbk-grp" style="color:hsl(${h} 62% 34%);background:hsl(${h} 55% 92%)">${s.losses} thua</span>`}
        <div class="tbk-wl"><b>${s.wins}</b>–${s.losses}</div>${dead?'<div class="tbk-deadtag">Loại</div>':balls}</div>`;
    }).join('')}</div></div>`;

  const ms = tbkSwRoundMatches(sw);
  const roundDone = tbkSwRoundComplete(sw);
  const filled = ms.filter(m=>m.confirmed).length;
  let rp;
  if(!tbkSwissDrawn(sw)){
    rp = `<div class="card-body padded" style="text-align:center"><div style="font-weight:700;margin-bottom:4px">Vòng ${sw.round}</div><div class="cell-muted" style="margin-bottom:14px">${aliveCount} người còn trong giải.</div><button class="btn btn-primary" id="tbSwDrawBtn"><i class="ti ti-dice-5"></i> Bốc thăm vòng ${sw.round}</button></div>`;
  } else {
    rp = `<div class="card-body padded">${ms.map(m=>teSwMatchCard(record,m)).join('')}</div>`;
    if(roundDone && aliveCount>1) rp += `<div class="form-actions" style="justify-content:center;border-top:1px solid var(--line);padding:14px"><button class="btn btn-primary" id="tbSwNextBtn">Vòng tiếp theo <i class="ti ti-arrow-right"></i> (Vòng ${sw.round+1})</button></div>`;
  }
  const panel = `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Vòng ${sw.round}</h2><div class="desc">${!tbkSwissDrawn(sw)?'chưa bốc thăm':roundDone?'Hoàn tất '+filled+'/'+ms.length:'Đã nhập '+filled+'/'+ms.length}</div></div></div>${rp}</div>`;
  return `<div class="tbk-grid2"><div>${lb}</div><div>${panel}${teSwLog(record)}</div></div>`;
}
function teSwMatchCard(record,m){
  const A = record.players.find(p=>p.id===m.aId);
  if(m.bye) return `<div class="tbk-fix"><span class="pn w">${escapeHtml(A?A.name:'—')}</span><span class="tbk-byebadge">Miễn đấu</span></div>`;
  const B = record.players.find(p=>p.id===m.bId);
  if(m.confirmed){
    const aw = m.winnerId===m.aId;
    return `<div class="tbk-fix"><span class="pn ${aw?'w':'l'}">${escapeHtml(A?A.name:'—')}</span><span class="tbk-res" style="padding:3px 9px;font-size:13px">${m.sa}–${m.sb}</span><span class="pn r ${aw?'l':'w'}">${escapeHtml(B?B.name:'—')}</span><button class="btn-icon" data-tbswedit="${m.id}" title="Sửa"><i class="ti ti-edit"></i></button></div>`;
  }
  return `<div class="tbk-fix"><span class="pn">${escapeHtml(A?A.name:'—')}</span><input type="number" min="0" id="tb_sa_${m.id}"><span class="vs">–</span><input type="number" min="0" id="tb_sb_${m.id}"><span class="pn r">${escapeHtml(B?B.name:'—')}</span><button class="btn-icon" data-tbswsave="${m.id}" title="Lưu"><i class="ti ti-device-floppy"></i></button></div>`;
}
function teSwLog(record){
  const sw = record.sw;
  const conf = sw.matches.filter(m=>m.confirmed);
  const rows = conf.slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
  const body = rows.length ? rows.map(r=>{
    const A = record.players.find(p=>p.id===r.aId);
    let d;
    if(r.bye) d = `<span class="tbk-winner">${escapeHtml(A?A.name:'—')}</span> <span class="tbk-loser">— miễn đấu</span>`;
    else { const B=record.players.find(p=>p.id===r.bId); const aw=r.winnerId===r.aId;
      d = `<span class="${aw?'tbk-winner':'tbk-loser'}">${escapeHtml(A?A.name:'—')}</span> <b>${r.sa}–${r.sb}</b> <span class="${aw?'tbk-loser':'tbk-winner'}">${escapeHtml(B?B.name:'—')}</span>`; }
    return `<div class="tbk-lg"><div class="t">${r.ts?teFmtTime(r.ts):''}</div><div class="rr">V${r.round}</div><div>${d}</div></div>`;
  }).join('') : `<div class="empty" style="padding:20px">Chưa có trận.</div>`;
  return `<div class="card" style="margin-top:16px"><div class="card-head"><div><h2>Nhật ký trận đấu</h2><div class="desc">${rows.length} trận</div></div></div><div class="tbk-logtable">${body}</div></div>`;
}
function teSaveSwissResult(mid){
  const record = teRecordFromView(); if(!record) return;
  const m = record.sw.matches.find(x=>x.id===Number(mid)); if(!m) return;
  const sa = Number(document.getElementById('tb_sa_'+mid).value);
  const sb = Number(document.getElementById('tb_sb_'+mid).value);
  if(!Number.isFinite(sa) || !Number.isFinite(sb) || sa===sb){ showToast('Vui lòng nhập tỷ số hợp lệ.', true); return; }
  m.sa=sa; m.sb=sb; m.winnerId = sa>sb ? m.aId : m.bId; m.confirmed=true; m.ts=Date.now();
  m.winPoints = TE_WIN_POINTS; m.lossPoints = TE_LOSS_POINTS;
  teAwardPoints(record, m.winnerId, m.winnerId===m.aId?m.bId:m.aId, m.winPoints, m.lossPoints);
  recomputeMemberRanking();
  teCheckComplete(record);
  saveDB();
  renderSidebar();
  showToast('Đã ghi nhận kết quả và cập nhật bảng xếp hạng');
  renderContent();
}
function teEditSwissResult(mid){
  const record = teRecordFromView(); if(!record) return;
  const m = record.sw.matches.find(x=>x.id===Number(mid)); if(!m) return;
  if(m.confirmed && !m.bye){
    teReversePoints(record, m.winnerId, m.winnerId===m.aId?m.bId:m.aId, m.winPoints!=null?m.winPoints:TE_WIN_POINTS, m.lossPoints!=null?m.lossPoints:TE_LOSS_POINTS);
    recomputeMemberRanking();
  }
  m.confirmed=false; m.sa=null; m.sb=null; m.winnerId=null;
  saveDB();
  renderSidebar();
  renderContent();
}

/* ---- Simulator ---- */
function teSimStep(n){
  const record = teRecordFromView();
  if(!record) return;
  for(let c=0;c<n;c++){
    if(record.format==='SE' || record.format==='DE'){
      const M = record.bracket.matches;
      const ready = Object.values(M).filter(m=>m.status==='ready' && m.p1!=='BYE' && m.p2!=='BYE' && m.p1!=null && m.p2!=null);
      if(!ready.length) break;
      const m = ready[0];
      const r = tbkSimScore(m.p1, m.p2, pid=>tePlayerRating(record,pid));
      tbkDecide(M, m.id, r.win, r.win===m.p1?r.ws:r.ls, r.win===m.p1?r.ls:r.ws);
      if(m.br==='GF'){ const g2=M[record.bracket.gf2Id]; if(r.win===m.p2){ g2.status='ready'; g2.p1=m.p1; g2.p2=m.p2; } else g2.status='void'; }
      tbkResolveByes(M);
    } else if(record.format==='RR'){
      const M = record.rr.matches;
      const open = Object.values(M).filter(m=>m.win==null);
      if(!open.length) break;
      const m = open[0];
      const r = tbkSimScore(m.a, m.b, pid=>tePlayerRating(record,pid));
      m.win=r.win; m.s1=r.win===m.a?r.ws:r.ls; m.s2=r.win===m.a?r.ls:r.ws;
    } else if(record.format==='SW'){
      if(!tbkSwissDrawn(record.sw)) tbkSwissDraw(record.sw, record.players, record.lives||3, id=>teName(record,id));
      const open = tbkSwRoundMatches(record.sw).filter(m=>!m.confirmed && !m.bye);
      if(open.length){
        const m = open[0];
        const r = tbkSimScore(m.aId, m.bId, pid=>tePlayerRating(record,pid));
        m.sa=r.win===m.aId?r.ws:r.ls; m.sb=r.win===m.aId?r.ls:r.ws; m.winnerId=r.win; m.confirmed=true; m.ts=Date.now();
      } else if(tbkSwRoundComplete(record.sw)){
        if(!tbkSwissNext(record.sw, record.players, record.lives||3)) break;
      }
    }
  }
  teCheckComplete(record);
  saveDB();
  renderSidebar();
  renderContent();
  if(record.format==='SE'||record.format==='DE') teApplyView();
}

function attachTeMatchesTab(record){
  if(!record) return;
  document.querySelectorAll('[data-tbmode]').forEach(el=>el.addEventListener('click', ()=>{
    record.mode = el.getAttribute('data-tbmode'); saveDB(); renderContent();
  }));
  const startBtn = document.getElementById('tbStartBtn');
  if(startBtn) startBtn.addEventListener('click', ()=>teStartBracket(record));
  const resetBtn = document.getElementById('tbResetBtn');
  if(resetBtn) resetBtn.addEventListener('click', ()=>teResetBracket(record));
  const simNext = document.getElementById('tbSimNext');
  if(simNext) simNext.addEventListener('click', ()=>teSimStep(1));
  const simAll = document.getElementById('tbSimAll');
  if(simAll) simAll.addEventListener('click', ()=>teSimStep(9999));

  if(record.bracket) teBindBracketView(record);
  if(record.rr){
    document.querySelectorAll('[data-tbrt]').forEach(b=>b.addEventListener('click', ()=>{ teRrTab=+b.getAttribute('data-tbrt'); renderContent(); }));
    document.querySelectorAll('[data-tbrsave]').forEach(b=>b.addEventListener('click', ()=>teSaveRRResult(b.getAttribute('data-tbrsave'))));
    document.querySelectorAll('[data-tbredit]').forEach(b=>b.addEventListener('click', ()=>teEditRRResult(b.getAttribute('data-tbredit'))));
  }
  if(record.sw){
    const d = document.getElementById('tbSwDrawBtn');
    if(d) d.addEventListener('click', ()=>{ tbkSwissDraw(record.sw, record.players, record.lives||3, id=>teName(record,id)); saveDB(); renderContent(); });
    const nx = document.getElementById('tbSwNextBtn');
    if(nx) nx.addEventListener('click', ()=>{ tbkSwissNext(record.sw, record.players, record.lives||3); saveDB(); renderContent(); });
    document.querySelectorAll('[data-tbswsave]').forEach(b=>b.addEventListener('click', ()=>teSaveSwissResult(b.getAttribute('data-tbswsave'))));
    document.querySelectorAll('[data-tbswedit]').forEach(b=>b.addEventListener('click', ()=>teEditSwissResult(b.getAttribute('data-tbswedit'))));
  }
}

function attachTournamentEditorEvents(){
  document.querySelectorAll('[data-tetab]').forEach(t=>{
    t.addEventListener('click', ()=>{ teTab = t.getAttribute('data-tetab'); renderContent(); });
  });
  const cancelBtn = document.getElementById('teCancelBtn');
  if(cancelBtn) cancelBtn.addEventListener('click', ()=>{ teResetNewDraft(); setView('tournaments'); });
  const saveInfoBtn = document.getElementById('teSaveInfoBtn');
  if(saveInfoBtn) saveInfoBtn.addEventListener('click', teSaveInfo);
  const delBtn = document.getElementById('teDeleteBtn');
  if(delBtn) delBtn.addEventListener('click', teDeleteTournament);

  document.querySelectorAll('[data-prize-field]').forEach(input=>{
    input.addEventListener('change', ()=>{
      const record = teCurrentRecord();
      if(!record) return;
      const idx = Number(input.getAttribute('data-prize-idx'));
      const field = input.getAttribute('data-prize-field');
      record.prizes[idx][field] = input.value;
      if(!teNewDraft || currentView!=='tournament-edit:new') saveDB();
    });
  });
  const addPrizeBtn = document.getElementById('teAddPrizeBtn');
  if(addPrizeBtn) addPrizeBtn.addEventListener('click', ()=>{
    const record = teCurrentRecord();
    if(!record) return;
    teSyncInfoFieldsIntoRecord(record);
    record.prizes.push({rank:'', cash:'', item:''});
    if(currentView!=='tournament-edit:new') saveDB();
    renderContent();
  });
  document.querySelectorAll('[data-te-rm-prize]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const record = teCurrentRecord();
      if(!record) return;
      teSyncInfoFieldsIntoRecord(record);
      const idx = Number(btn.getAttribute('data-te-rm-prize'));
      record.prizes.splice(idx,1);
      if(currentView!=='tournament-edit:new') saveDB();
      renderContent();
    });
  });

  const addPlayersBtn = document.getElementById('teAddPlayersBtn');
  if(addPlayersBtn) addPlayersBtn.addEventListener('click', teAddPlayers);
  const addGuestBtn = document.getElementById('teAddGuestBtn');
  if(addGuestBtn) addGuestBtn.addEventListener('click', teAddGuest);
  const csvFileBtn = document.getElementById('teCsvFileBtn');
  const csvFileInput = document.getElementById('te_csv_file');
  if(csvFileBtn && csvFileInput){
    csvFileBtn.addEventListener('click', ()=>csvFileInput.click());
    csvFileInput.addEventListener('change', (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev)=>{ document.getElementById('te_csv').value = ev.target.result; };
      reader.readAsText(file, 'utf-8');
    });
  }
  const importCsvBtn = document.getElementById('teImportCsvBtn');
  if(importCsvBtn) importCsvBtn.addEventListener('click', teImportCsv);
  document.querySelectorAll('[data-te-rm-player]').forEach(btn=>{
    btn.addEventListener('click', ()=>teRemovePlayer(btn.getAttribute('data-te-rm-player')));
  });
  document.querySelectorAll('[data-te-fee]').forEach(sel=>{
    sel.addEventListener('change', ()=>teSetPlayerFeeStatus(sel.getAttribute('data-te-fee'), sel.value));
  });

  if(teTab==='matches') attachTeMatchesTab(teCurrentRecord());
}

async function teSaveInfo(){
  const id = currentView.slice('tournament-edit:'.length);
  const isNew = id==='new';
  const c = COLLECTIONS.tournaments;
  const data = {};
  let missingRequired = false;
  c.fields.forEach(f=>{
    let val = document.getElementById('f_'+f.key).value;
    if(f.type==='number' && val!=='') val = Number(val);
    if(f.required && (val===''||val===undefined||val===null)) missingRequired = true;
    data[f.key] = val;
  });
  if(missingRequired){ showToast('Vui lòng điền đầy đủ các trường bắt buộc (*)', true); return; }
  if(isNew){
    data.id = uid();
    data.players = [];
    data.prizes = (teNewDraft && teNewDraft.prizes) ? teNewDraft.prizes : TE_DEFAULT_PRIZES.map(p=>({...p}));
    DB.tournaments.push(data);
    teResetNewDraft();
    await saveDB();
    renderSidebar();
    showToast('Đã tạo giải đấu');
    setView('tournament-edit:'+data.id);
  } else {
    const idx = DB.tournaments.findIndex(r=>r.id===id);
    DB.tournaments[idx] = {...DB.tournaments[idx], ...data};
    await saveDB();
    renderSidebar();
    showToast('Đã lưu thông tin giải đấu');
    renderContent();
  }
}
function teCloneTournament(id){
  const src = teRecord(id);
  if(!src) return;
  const clone = JSON.parse(JSON.stringify(src));
  clone.id = uid();
  clone.name = src.name + ' (Bản sao)';
  clone.status = 'upcoming';
  clone.champion = '';
  clone.bracket = null;
  clone.rr = null;
  clone.sw = null;
  clone.mode = 'op';
  clone.players = (src.players||[]).map(p=>({...p, id:uid(), registeredAt:Date.now(), feeStatus:'unpaid'}));
  DB.tournaments.push(clone);
  saveDB();
  renderSidebar();
  showToast('Đã nhân bản giải đấu — danh sách người chơi được giữ nguyên, chưa ghép cặp vòng đầu');
  setView('tournament-edit:'+clone.id);
}
function teDeleteTournament(){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  const label = record ? record.name : 'giải đấu này';
  if(confirm(`Xóa "${label}" khỏi Giải đấu? Toàn bộ danh sách người chơi và kết quả sẽ bị xóa. Hành động này không thể hoàn tác.`)){
    DB.tournaments = DB.tournaments.filter(r=>r.id!==id);
    saveDB();
    renderSidebar();
    showToast('Đã xóa giải đấu');
    setView('tournaments');
  }
}

function teAddPlayers(){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  const sel = document.getElementById('te_p_members');
  const ids = Array.from(sel.selectedOptions).map(o=>o.value);
  if(!ids.length){ showToast('Vui lòng chọn ít nhất một hội viên', true); return; }
  let added = 0;
  ids.forEach(memberId=>{
    if(record.players.some(p=>p.memberId===memberId)) return;
    const m = DB.members.find(x=>x.id===memberId);
    if(!m) return;
    record.players.push({id:uid(), memberId, name:m.name, club:m.club||'', registeredAt:Date.now(), feeStatus:'unpaid'});
    added++;
  });
  saveDB();
  renderSidebar();
  showToast(`Đã thêm ${added} hội viên vào danh sách`);
  renderContent();
}
function teAddGuest(){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  const nameInput = document.getElementById('te_p_name').value.trim();
  const clubInput = document.getElementById('te_p_club').value.trim();
  if(!nameInput){ showToast('Vui lòng nhập họ tên khách mời', true); return; }
  record.players.push({id:uid(), memberId:null, name:nameInput, club:clubInput, registeredAt:Date.now(), feeStatus:'unpaid'});
  saveDB();
  renderSidebar();
  showToast('Đã thêm khách mời');
  renderContent();
}
function teImportCsv(){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  const raw = document.getElementById('te_csv').value;
  teCsvText = raw;
  const lines = raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length===0){ showToast('Vui lòng dán hoặc tải lên danh sách', true); return; }
  let added = 0;
  lines.forEach(line=>{
    const cols = line.split(',').map(c=>c.trim());
    const name = cols[0];
    if(!name) return;
    const idToken = cols[1] || '';
    const club = cols[2] || '';
    let member = null;
    if(idToken) member = DB.members.find(m=>m.phone===idToken || m.code===idToken);
    if(member && record.players.some(p=>p.memberId===member.id)) return;
    record.players.push({
      id:uid(),
      memberId: member ? member.id : null,
      name: member ? member.name : name,
      club: member ? (member.club||club) : club,
      registeredAt: Date.now(),
      feeStatus: 'unpaid'
    });
    added++;
  });
  teCsvText = '';
  saveDB();
  renderSidebar();
  showToast(`Đã nhập ${added} người chơi từ danh sách`);
  renderContent();
}
function teSetPlayerFeeStatus(pid, status){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  const p = record.players.find(x=>x.id===pid);
  if(!p) return;
  p.feeStatus = status;
  saveDB();
  renderContent();
}
function teRemovePlayer(pid){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  const inBracket = record.bracket && Object.values(record.bracket.matches).some(m=>m.p1===pid || m.p2===pid);
  const inRR = record.rr && Object.values(record.rr.matches).some(m=>m.a===pid || m.b===pid);
  const inSw = record.sw && record.sw.matches.some(m=>m.aId===pid || m.bId===pid);
  if(inBracket || inRR || inSw){
    showToast('Không thể xóa: người chơi đã có trong sơ đồ thi đấu. Hãy "Tạo lại sơ đồ" trước.', true);
    return;
  }
  record.players = record.players.filter(p=>p.id!==pid);
  saveDB();
  renderSidebar();
  showToast('Đã xóa người chơi');
  renderContent();
}

function recomputeMemberRanking(){
  const categories = new Set();
  DB.members.forEach(m=>(m.disciplines||[]).forEach(d=>categories.add(d.category)));
  categories.forEach(cat=>{
    const entries = [];
    DB.members.forEach(m=>{ const d=(m.disciplines||[]).find(x=>x.category===cat); if(d) entries.push(d); });
    const prevRank = new Map(entries.map(d=>[d, d.rank]));
    entries.sort((a,b)=>(b.points||0)-(a.points||0));
    entries.forEach((d,i)=>{
      const newRank = i+1;
      const oldRank = prevRank.get(d) ?? newRank;
      const delta = oldRank - newRank;
      d.rank = newRank;
      d.trend = delta>0 ? 'up' : (delta<0 ? 'down' : 'eq');
      d.trendValue = Math.abs(delta);
    });
  });
}

