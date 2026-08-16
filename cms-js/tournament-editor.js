/* =========================================================
   TOURNAMENT EDITOR (full-screen editor for Giải đấu, thay cho modal)
   Quản lý: Thông tin giải đấu · Danh sách người chơi (upload) ·
   Cặp đấu & Kết quả (tính điểm ranking hội viên tự động)
   ========================================================= */
const TE_WIN_POINTS = 25;
const TE_LOSS_POINTS = 5;
let teTab = 'info';
let teCsvText = '';

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

function renderTournamentEditor(id){
  const isNew = id==='new';
  let record;
  if(isNew){
    if(!teNewDraft) teNewDraft = {name:'',category:'',status:'upcoming',date:'',participants:'',location:'',note:'',champion:'',entryFee:TE_DEFAULT_ENTRY_FEE,rules:TE_DEFAULT_RULES,prizes:TE_DEFAULT_PRIZES.map(p=>({...p})),players:[],matches:[]};
    record = teNewDraft;
  } else {
    record = teRecord(id) || {};
  }
  if(!record.players) record.players = [];
  if(!record.matches) record.matches = [];
  if(!record.prizes || !record.prizes.length) record.prizes = TE_DEFAULT_PRIZES.map(p=>({...p}));
  if(isNew) teTab = 'info';
  if(!isNew && teTab!=='info' && teTab!=='players' && teTab!=='matches') teTab = 'info';

  const tabs = [
    {key:'info', label:'Thông tin', icon:'ti-info-circle'},
    {key:'players', label:`Danh sách người chơi${record.players.length?` (${record.players.length})`:''}`, icon:'ti-users', disabled:isNew},
    {key:'matches', label:`Cặp đấu & Kết quả${record.matches.length?` (${record.matches.length})`:''}`, icon:'ti-swords', disabled:isNew}
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

function teMemberOptions(){
  return DB.members.map(m=>`<option value="${m.id}">${escapeHtml(m.name)} — ${escapeHtml(m.code||'')}${m.club?` (${escapeHtml(m.club)})`:''}</option>`).join('');
}

function renderTePlayersTab(record){
  const rows = record.players.map(p=>{
    const m = p.memberId ? DB.members.find(x=>x.id===p.memberId) : null;
    return `<tr data-pid="${p.id}">
      <td>${escapeHtml(p.name)}</td>
      <td class="cell-muted">${escapeHtml(p.club||'—')}</td>
      <td class="cell-muted">${escapeHtml(p.category||record.category||'—')}</td>
      <td>${m ? `<span class="status green">Hội viên · ${escapeHtml(m.code||'')}</span>` : `<span class="status gray">Khách mời</span>`}</td>
      <td class="actions"><button class="btn-icon" data-te-rm-player="${p.id}" title="Xóa"><i class="ti ti-x"></i></button></td>
    </tr>`;
  }).join('');

  return `<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">
    <div class="card" style="flex:1;min-width:320px">
      <div class="card-head"><div><h2>Thêm người chơi</h2><div class="desc">Chọn hội viên đã có trong hệ thống hoặc thêm khách mời</div></div></div>
      <div class="card-body padded">
        <div class="form-grid">
          <div class="fld"><label>Chọn hội viên (tùy chọn)</label><select id="te_p_member"><option value="">— Khách mời / nhập tên tự do —</option>${teMemberOptions()}</select></div>
          <div class="fld"><label>Họ tên</label><input type="text" id="te_p_name" placeholder="Bắt buộc nếu không chọn hội viên"></div>
          <div class="fld"><label>Câu lạc bộ</label><input type="text" id="te_p_club" placeholder="CLB / Đơn vị"></div>
          <div class="fld"><label>Nội dung thi đấu</label><input type="text" id="te_p_category" placeholder="${escapeAttr(record.category||'Pool 9 bi')}"></div>
        </div>
        <div class="form-actions" style="justify-content:flex-end;border-top:none;padding-top:10px;margin-top:10px">
          <button class="btn btn-primary" id="teAddPlayerBtn"><i class="ti ti-plus"></i> Thêm vào danh sách</button>
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
    ${record.players.length===0 ? `<div class="empty"><i class="ti ti-users"></i><b>Chưa có người chơi</b>Thêm hội viên hoặc nhập danh sách ở trên.</div>` : `<table><thead><tr><th>Họ tên</th><th>CLB</th><th>Nội dung</th><th>Liên kết</th><th style="width:60px"></th></tr></thead><tbody>${rows}</tbody></table>`}
  </div>`;
}

function teNextRound(record){
  return record.matches.length ? Math.max(...record.matches.map(m=>m.round||1)) + (teLatestRoundDone(record) ? 1 : 0) : 1;
}
function teLatestRound(record){
  return record.matches.length ? Math.max(...record.matches.map(m=>m.round||1)) : 0;
}
function teLatestRoundDone(record){
  const lr = teLatestRound(record);
  if(!lr) return true;
  return record.matches.filter(m=>m.round===lr).every(m=>m.status==='done');
}
function tePlayerName(record, pid){
  if(!pid) return null;
  const p = record.players.find(x=>x.id===pid);
  return p ? p.name : '—';
}
function tePairedPlayerIds(record, round){
  const set = new Set();
  record.matches.filter(m=>m.round===round).forEach(m=>{ set.add(m.p1Id); if(m.p2Id) set.add(m.p2Id); });
  return set;
}
function teRoundContenders(record){
  const lr = teLatestRound(record);
  if(!lr) return record.players.map(p=>p.id);
  if(!teLatestRoundDone(record)) return [];
  return record.matches.filter(m=>m.round===lr).map(m=>m.winnerId).filter(Boolean);
}

function renderTeMatchesTab(record){
  const lr = teLatestRound(record);
  const roundDone = teLatestRoundDone(record);
  const contenders = teRoundContenders(record);
  const nextRoundNum = lr ? lr+1 : 1;
  const canDrawNext = record.status!=='completed' && (lr===0 ? record.players.length>=2 : (roundDone && contenders.length>=2));

  const drawSection = canDrawNext ? `<div class="card" style="margin-bottom:20px">
      <div class="card-head"><div><h2>${lr===0?'Bốc thăm vòng 1':`Bốc thăm vòng ${nextRoundNum}`}</h2><div class="desc">${lr===0?`Ghép ngẫu nhiên ${record.players.length} người chơi thành các cặp đấu`:`Ghép ngẫu nhiên ${contenders.length} người thắng vòng ${lr} vào vòng tiếp theo`}</div></div>
      <button class="btn btn-primary" id="teDrawBtn"><i class="ti ti-dice"></i> Bốc thăm tự động</button></div>
    </div>` : (record.status==='completed' ? '' : (lr>0 && !roundDone ? `<div class="card" style="margin-bottom:20px"><div class="card-body padded" style="color:var(--hint);font-size:13px"><i class="ti ti-clock"></i> Hoàn tất kết quả vòng ${lr} trước khi bốc thăm vòng tiếp theo.</div></div>` : ''));

  const manualOptions = (excludeId)=> record.players.filter(p=>p.id!==excludeId).map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const manualSection = record.status!=='completed' ? `<div class="card" style="margin-bottom:20px">
    <div class="card-head"><div><h2>Ghép cặp thủ công</h2><div class="desc">Tự chọn 2 người chơi và vòng đấu</div></div></div>
    <div class="card-body padded">
      <div class="form-grid">
        <div class="fld"><label>Người chơi 1</label><select id="te_m_p1"><option value="">— Chọn —</option>${manualOptions()}</select></div>
        <div class="fld"><label>Người chơi 2</label><select id="te_m_p2"><option value="">— Chọn —</option>${manualOptions()}</select></div>
        <div class="fld"><label>Vòng đấu</label><input type="number" id="te_m_round" min="1" value="${nextRoundNum}"></div>
      </div>
      <div class="form-actions" style="justify-content:flex-end;border-top:none;padding-top:10px;margin-top:10px">
        <button class="btn btn-primary" id="teManualPairBtn"><i class="ti ti-plus"></i> Tạo cặp đấu</button>
      </div>
    </div>
  </div>` : '';

  const rounds = {};
  record.matches.forEach(m=>{ (rounds[m.round]=rounds[m.round]||[]).push(m); });
  const roundKeys = Object.keys(rounds).map(Number).sort((a,b)=>a-b);

  let matchesHtml = '';
  if(roundKeys.length===0){
    matchesHtml = `<div class="tbl-wrap"><div class="empty"><i class="ti ti-swords"></i><b>Chưa có cặp đấu</b>Bốc thăm tự động hoặc ghép cặp thủ công ở trên.</div></div>`;
  } else {
    matchesHtml = roundKeys.map(rn=>{
      const rowsHtml = rounds[rn].map(m=>{
        const p1 = tePlayerName(record, m.p1Id);
        const p2 = m.p2Id ? tePlayerName(record, m.p2Id) : null;
        if(!p2){
          return `<tr data-mid="${m.id}"><td colspan="4"><b>${escapeHtml(p1)}</b> <span class="badge">Miễn đấu vòng này</span></td><td class="actions"></td></tr>`;
        }
        if(m.status==='done'){
          const winnerName = tePlayerName(record, m.winnerId);
          return `<tr data-mid="${m.id}">
            <td><b>${escapeHtml(p1)}</b></td>
            <td style="white-space:nowrap"><b style="color:var(--vg)">${m.score1}</b> — <b style="color:var(--vg)">${m.score2}</b></td>
            <td><b>${escapeHtml(p2)}</b></td>
            <td><span class="status green">Thắng: ${escapeHtml(winnerName)}</span></td>
            <td class="actions"></td>
          </tr>`;
        }
        return `<tr data-mid="${m.id}">
          <td><b>${escapeHtml(p1)}</b></td>
          <td style="white-space:nowrap"><input type="number" min="0" id="te_score1_${m.id}" style="width:52px;text-align:center;border:1px solid var(--line-strong);border-radius:6px;padding:5px"> — <input type="number" min="0" id="te_score2_${m.id}" style="width:52px;text-align:center;border:1px solid var(--line-strong);border-radius:6px;padding:5px"></td>
          <td><b>${escapeHtml(p2)}</b></td>
          <td><span class="status gold">Chưa có kết quả</span></td>
          <td class="actions">
            <button class="btn-icon" data-te-save-result="${m.id}" title="Lưu kết quả"><i class="ti ti-device-floppy"></i></button>
            <button class="btn-icon" data-te-rm-match="${m.id}" title="Xóa cặp đấu"><i class="ti ti-trash"></i></button>
          </td>
        </tr>`;
      }).join('');
      return `<div style="margin-bottom:18px"><div class="gd-h" style="font-size:13.5px">Vòng ${rn}</div>
        <div class="tbl-wrap"><table><thead><tr><th>Người chơi 1</th><th style="width:120px">Tỷ số</th><th>Người chơi 2</th><th style="width:170px">Trạng thái</th><th style="width:80px"></th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
      </div>`;
    }).join('');
  }

  return `<div style="font-size:12px;color:var(--hint);margin-bottom:16px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:10px 14px">
      <i class="ti ti-info-circle"></i> Thắng trận: <b>+${TE_WIN_POINTS} điểm</b> · Thua trận: <b>+${TE_LOSS_POINTS} điểm</b> · Mỗi trận: <b>+1 số trận đã đấu</b>. Bảng xếp hạng hội viên (mục "Hội viên & Xếp hạng") được tính lại tự động ngay sau khi lưu kết quả. Chỉ người chơi được liên kết với hội viên mới được cộng điểm.
    </div>
    ${drawSection}${manualSection}${matchesHtml}`;
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

  const addPlayerBtn = document.getElementById('teAddPlayerBtn');
  if(addPlayerBtn) addPlayerBtn.addEventListener('click', teAddPlayer);
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

  const drawBtn = document.getElementById('teDrawBtn');
  if(drawBtn) drawBtn.addEventListener('click', teDrawRound);
  const manualPairBtn = document.getElementById('teManualPairBtn');
  if(manualPairBtn) manualPairBtn.addEventListener('click', teManualPair);
  document.querySelectorAll('[data-te-save-result]').forEach(btn=>{
    btn.addEventListener('click', ()=>teSaveMatchResult(btn.getAttribute('data-te-save-result')));
  });
  document.querySelectorAll('[data-te-rm-match]').forEach(btn=>{
    btn.addEventListener('click', ()=>teRemoveMatch(btn.getAttribute('data-te-rm-match')));
  });
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
    data.matches = [];
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

function teAddPlayer(){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  const memberId = document.getElementById('te_p_member').value;
  const nameInput = document.getElementById('te_p_name').value.trim();
  const clubInput = document.getElementById('te_p_club').value.trim();
  const categoryInput = document.getElementById('te_p_category').value.trim();
  let player;
  if(memberId){
    const m = DB.members.find(x=>x.id===memberId);
    if(!m) return;
    if(record.players.some(p=>p.memberId===memberId)){ showToast('Hội viên này đã có trong danh sách', true); return; }
    player = {id:uid(), memberId, name:m.name, club:m.club||clubInput, category:categoryInput||m.category||record.category};
  } else {
    if(!nameInput){ showToast('Vui lòng nhập họ tên hoặc chọn hội viên', true); return; }
    player = {id:uid(), memberId:null, name:nameInput, club:clubInput, category:categoryInput||record.category};
  }
  record.players.push(player);
  saveDB();
  renderSidebar();
  showToast('Đã thêm người chơi');
  document.getElementById('te_p_name').value='';
  document.getElementById('te_p_club').value='';
  document.getElementById('te_p_category').value='';
  document.getElementById('te_p_member').value='';
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
      category: (member && member.category) || record.category
    });
    added++;
  });
  teCsvText = '';
  saveDB();
  renderSidebar();
  showToast(`Đã nhập ${added} người chơi từ danh sách`);
  renderContent();
}
function teRemovePlayer(pid){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  if(record.matches.some(m=>m.p1Id===pid || m.p2Id===pid)){
    showToast('Không thể xóa: người chơi đã có trong cặp đấu. Hãy xóa cặp đấu liên quan trước.', true);
    return;
  }
  record.players = record.players.filter(p=>p.id!==pid);
  saveDB();
  renderSidebar();
  showToast('Đã xóa người chơi');
  renderContent();
}

function teDrawRound(){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  const lr = teLatestRound(record);
  const round = lr ? lr+1 : 1;
  let pool;
  if(!lr){
    pool = record.players.map(p=>p.id);
  } else {
    pool = teRoundContenders(record);
  }
  if(pool.length<2){ showToast('Không đủ người chơi để bốc thăm', true); return; }
  const shuffled = [...pool];
  for(let i=shuffled.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
  const newMatches = [];
  for(let i=0;i<shuffled.length;i+=2){
    if(i+1<shuffled.length){
      newMatches.push({id:uid(), round, p1Id:shuffled[i], p2Id:shuffled[i+1], score1:null, score2:null, status:'pending', winnerId:null});
    } else {
      newMatches.push({id:uid(), round, p1Id:shuffled[i], p2Id:null, score1:null, score2:null, status:'done', winnerId:shuffled[i]});
    }
  }
  record.matches.push(...newMatches);
  teCheckTournamentComplete(record);
  saveDB();
  showToast(`Đã bốc thăm ${newMatches.length} cặp đấu cho vòng ${round}`);
  renderContent();
}
function teManualPair(){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  const p1 = document.getElementById('te_m_p1').value;
  const p2 = document.getElementById('te_m_p2').value;
  const round = Number(document.getElementById('te_m_round').value) || 1;
  if(!p1 || !p2){ showToast('Vui lòng chọn đủ 2 người chơi', true); return; }
  if(p1===p2){ showToast('Vui lòng chọn 2 người chơi khác nhau', true); return; }
  record.matches.push({id:uid(), round, p1Id:p1, p2Id:p2, score1:null, score2:null, status:'pending', winnerId:null});
  saveDB();
  showToast('Đã tạo cặp đấu');
  renderContent();
}
function teRemoveMatch(mid){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  record.matches = record.matches.filter(m=>m.id!==mid);
  saveDB();
  showToast('Đã xóa cặp đấu');
  renderContent();
}

function recomputeMemberRanking(){
  const prevRank = {};
  DB.members.forEach(m=>{ prevRank[m.id] = m.rank; });
  const sorted = [...DB.members].sort((a,b)=>(b.points||0)-(a.points||0));
  sorted.forEach((m,i)=>{
    const newRank = i+1;
    const oldRank = prevRank[m.id] ?? newRank;
    const delta = oldRank - newRank;
    m.rank = newRank;
    m.trend = delta>0 ? 'up' : (delta<0 ? 'down' : 'eq');
    m.trendValue = Math.abs(delta);
  });
}

function teCheckTournamentComplete(record){
  const lr = teLatestRound(record);
  if(!lr) return;
  const roundMatches = record.matches.filter(m=>m.round===lr);
  if(roundMatches.length===1 && roundMatches[0].status==='done' && roundMatches[0].p2Id){
    const championName = tePlayerName(record, roundMatches[0].winnerId);
    record.champion = championName;
    record.status = 'completed';
  }
}

function teSaveMatchResult(mid){
  const id = currentView.slice('tournament-edit:'.length);
  const record = teRecord(id);
  if(!record) return;
  const match = record.matches.find(m=>m.id===mid);
  if(!match) return;
  const s1 = document.getElementById('te_score1_'+mid).value;
  const s2 = document.getElementById('te_score2_'+mid).value;
  if(s1===''||s2===''){ showToast('Vui lòng nhập tỷ số cho cả 2 người chơi', true); return; }
  const score1 = Number(s1), score2 = Number(s2);
  if(score1===score2){ showToast('Tỷ số không được hòa — cần xác định người thắng', true); return; }
  const winnerId = score1>score2 ? match.p1Id : match.p2Id;
  const loserId = score1>score2 ? match.p2Id : match.p1Id;
  match.score1 = score1; match.score2 = score2; match.status = 'done'; match.winnerId = winnerId;

  const winnerPlayer = record.players.find(p=>p.id===winnerId);
  const loserPlayer = record.players.find(p=>p.id===loserId);
  if(winnerPlayer && winnerPlayer.memberId){
    const m = DB.members.find(x=>x.id===winnerPlayer.memberId);
    if(m){ m.points = (m.points||0) + TE_WIN_POINTS; m.matches = (m.matches||0) + 1; }
  }
  if(loserPlayer && loserPlayer.memberId){
    const m = DB.members.find(x=>x.id===loserPlayer.memberId);
    if(m){ m.points = (m.points||0) + TE_LOSS_POINTS; m.matches = (m.matches||0) + 1; }
  }
  recomputeMemberRanking();
  teCheckTournamentComplete(record);
  saveDB();
  renderSidebar();
  showToast('Đã ghi nhận kết quả và cập nhật bảng xếp hạng');
  renderContent();
}
