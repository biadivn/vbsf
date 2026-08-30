/* =========================================================
   RECORD EDITOR (full-page add/edit for collections with pageEdit:true,
   thay cho modal — hiện dùng cho Hội viên & Hội viên tổ chức)
   Hội viên có thêm tab "Lịch sử thi đấu" (giải đấu + đấu tự do).
   ========================================================= */
let reTab = 'info';
let reHistFilter = '';

function renderRecordEditor(key, id){
  const c = COLLECTIONS[key];
  const isNew = id==='new';
  const record = isNew ? {} : (DB[key].find(r=>r.id===id) || {});
  const hasHistory = key==='members' && !isNew;
  if(isNew) reTab = 'info';
  if(!hasHistory && reTab==='history') reTab = 'info';

  const tabsHtml = hasHistory ? `<div style="display:flex;gap:22px;border-bottom:1px solid var(--line);margin-bottom:20px">
    <span class="gd-tab ${reTab==='info'?'on':''}" data-retab="info"><i class="ti ti-info-circle" style="margin-right:5px"></i>Thông tin</span>
    <span class="gd-tab ${reTab==='history'?'on':''}" data-retab="history"><i class="ti ti-history" style="margin-right:5px"></i>Lịch sử thi đấu</span>
  </div>` : '';

  const body = reTab==='history' ? renderMemberHistoryTab(record) : renderRecordInfoTab(key, record, isNew);
  return hasHistory ? `<div class="news-editor">${tabsHtml}${body}</div>` : body;
}

function renderRecordInfoTab(key, record, isNew){
  const c = COLLECTIONS[key];
  modalImageValues = {};
  modalFileValues = {};
  editingRecordFiles = {};
  c.fields.forEach(f=>{
    if(f.type==='image') modalImageValues[f.key] = record[f.key] || null;
    if(f.type==='file') editingRecordFiles[f.key] = record[f.key] || null;
  });
  const sections = [];
  c.fields.forEach(f=>{
    const title = f.section || null;
    let group = sections.find(s=>s.title===title);
    if(!group){ group = {title, fields:[]}; sections.push(group); }
    group.fields.push(f);
  });
  return `<div class="record-editor">
    <div class="form-card" style="max-width:840px">
      ${sections.map((s,i)=>`<div class="re-section" style="${i>0?'margin-top:22px;padding-top:18px;border-top:1px solid var(--line)':''}">
        ${s.title ? `<label style="font-size:12.5px;color:var(--ink);font-weight:600;display:block;margin-bottom:12px">${s.title}</label>` : ''}
        <div class="form-grid">${s.fields.map(f=>{
          return `<div class="fld ${f.span2?'span2':''}"><label>${f.label}${f.required?' <span class="req">*</span>':''}</label>${f.type==='richtext' ? renderRichTextField(f, record[f.key]) : renderField(f, record[f.key])}</div>`;
        }).join('')}</div>
      </div>`).join('')}
      ${key==='members' && !isNew ? renderMemberDisciplinesSection(record) : ''}
      <div class="form-actions" style="justify-content:space-between">
        ${!isNew ? `<button class="btn btn-danger-outline" id="reDeleteBtn"><i class="ti ti-trash"></i> Xóa ${c.single}</button>` : `<span></span>`}
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" id="reCancelBtn">Hủy</button>
          <button class="btn btn-primary" id="reSaveBtn"><i class="ti ti-check"></i> ${isNew?'Thêm mới':'Lưu thay đổi'}</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- Xếp hạng theo bộ môn ---------- */
function renderMemberDisciplinesSection(record){
  const catOptions = COLLECTIONS.members.fields.find(f=>f.key==='category').options;
  const disciplines = record.disciplines || [];
  const rows = disciplines.map((d,i)=>`<tr>
    <td><b>${escapeHtml(d.category)}</b>${record.category===d.category?' <span class="badge">Chính</span>':''}</td>
    <td><input type="number" data-re-disc-points="${i}" value="${d.points||0}" style="width:90px;border:1px solid var(--line-strong);border-radius:6px;padding:6px 8px"></td>
    <td class="cell-muted">${d.rank!=null?('#'+d.rank):'—'}</td>
    <td><input type="number" min="0" data-re-disc-matches="${i}" value="${d.matches||0}" style="width:70px;border:1px solid var(--line-strong);border-radius:6px;padding:6px 8px"></td>
    <td class="actions"><button class="btn-icon" data-re-rm-disc="${i}" title="Xóa hồ sơ"><i class="ti ti-trash"></i></button></td>
  </tr>`).join('');
  const available = catOptions.filter(o=>!disciplines.some(d=>d.category===o));
  return `<div class="re-section" style="margin-top:22px;padding-top:18px;border-top:1px solid var(--line)">
    <label style="font-size:12.5px;color:var(--ink);font-weight:600;display:block;margin-bottom:12px">Xếp hạng theo bộ môn</label>
    ${disciplines.length ? `<div class="tbl-wrap"><table><thead><tr><th>Bộ môn</th><th>Điểm</th><th>Hạng</th><th>Số trận</th><th style="width:50px"></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="cell-muted" style="margin-bottom:10px">Chưa có hồ sơ xếp hạng bộ môn nào.</div>`}
    ${available.length ? `<div style="display:flex;gap:8px;align-items:flex-end;margin-top:12px;flex-wrap:wrap">
      <div class="fld" style="flex:1;min-width:180px"><label>Thêm bộ môn</label><select id="re_disc_new_cat"><option value="">— Chọn —</option>${available.map(o=>`<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`).join('')}</select></div>
      <button class="btn btn-ghost" id="reAddDisciplineBtn"><i class="ti ti-plus"></i> Thêm bộ môn</button>
    </div>` : ''}
  </div>`;
}
function reAddDiscipline(record){
  const sel = document.getElementById('re_disc_new_cat');
  const cat = sel ? sel.value : '';
  if(!cat){ showToast('Vui lòng chọn bộ môn', true); return; }
  if(!record.disciplines) record.disciplines = [];
  if(record.disciplines.some(d=>d.category===cat)) return;
  record.disciplines.push({category:cat, points:0, rank:null, matches:0, trend:'eq', trendValue:0});
  recomputeMemberRanking();
  saveDB();
  syncAllMemberDisciplines();
  renderSidebar();
  showToast('Đã thêm hồ sơ bộ môn');
  renderContent();
}
function reUpdateDisciplinePoints(record, idx, value){
  const d = record.disciplines && record.disciplines[idx]; if(!d) return;
  d.points = Number(value)||0;
  recomputeMemberRanking();
  saveDB();
  syncAllMemberDisciplines();
  renderSidebar();
  renderContent();
}
function reUpdateDisciplineMatches(record, idx, value){
  const d = record.disciplines && record.disciplines[idx]; if(!d) return;
  d.matches = Math.max(0, Number(value)||0);
  saveDB();
  pushMemberDisciplinesPatch(record);
}
function reRemoveDiscipline(record, idx){
  const d = record.disciplines && record.disciplines[idx]; if(!d) return;
  if(!confirm(`Xóa hồ sơ xếp hạng "${d.category}"? Lịch sử thi đấu bộ môn này vẫn được giữ lại.`)) return;
  record.disciplines.splice(idx,1);
  recomputeMemberRanking();
  saveDB();
  syncAllMemberDisciplines();
  renderSidebar();
  showToast('Đã xóa hồ sơ bộ môn');
  renderContent();
}

/* ---------- Lịch sử thi đấu (giải đấu + đấu tự do) ---------- */
function reMemberMatchHistory(memberId){
  const rows = [];
  DB.tournaments.forEach(t=>{
    if(t.mode==='sim') return;
    const players = t.players||[];
    const me = players.find(p=>p.memberId===memberId);
    if(!me) return;
    const nameOf = pid=>{ if(pid==='BYE') return 'BYE'; const p=players.find(x=>x.id===pid); return p?p.name:'—'; };
    if(t.bracket){
      Object.values(t.bracket.matches).forEach(m=>{
        if(m.status!=='done' || m.p1==null || m.p2==null || m.p1==='BYE' || m.p2==='BYE') return;
        if(m.p1!==me.id && m.p2!==me.id) return;
        const isP1 = m.p1===me.id;
        const won = m.win===me.id;
        rows.push({category:t.category, event:t.name, opponent:nameOf(isP1?m.p2:m.p1), score:`${isP1?m.s1:m.s2}–${isP1?m.s2:m.s1}`, points:won?(m.winPoints||0):(m.lossPoints||0), won, ts:m.decidedAt||null, free:false});
      });
    }
    if(t.rr){
      Object.values(t.rr.matches).forEach(m=>{
        if(m.win==null || (m.a!==me.id && m.b!==me.id)) return;
        const isA = m.a===me.id;
        const won = m.win===me.id;
        rows.push({category:t.category, event:t.name, opponent:nameOf(isA?m.b:m.a), score:`${isA?m.s1:m.s2}–${isA?m.s2:m.s1}`, points:won?(m.winPoints!=null?m.winPoints:TE_WIN_POINTS):(m.lossPoints!=null?m.lossPoints:TE_LOSS_POINTS), won, ts:m.decidedAt||null, free:false});
      });
    }
    if(t.sw){
      t.sw.matches.filter(m=>m.confirmed && !m.bye && (m.aId===me.id || m.bId===me.id)).forEach(m=>{
        const isA = m.aId===me.id;
        const won = m.winnerId===me.id;
        rows.push({category:t.category, event:t.name, opponent:nameOf(isA?m.bId:m.aId), score:`${isA?m.sa:m.sb}–${isA?m.sb:m.sa}`, points:won?(m.winPoints!=null?m.winPoints:TE_WIN_POINTS):(m.lossPoints!=null?m.lossPoints:TE_LOSS_POINTS), won, ts:m.ts||null, free:false});
      });
    }
  });
  const member = DB.members.find(x=>x.id===memberId);
  (member && member.freeMatches || []).forEach(fm=>{
    rows.push({category:fm.category, event:'Đấu tự do', opponent:fm.opponent, score:`${fm.score1}–${fm.score2}`, points:fm.points, won:fm.score1>fm.score2, ts:fm.ts, free:true, id:fm.id});
  });
  rows.sort((a,b)=>(b.ts||0)-(a.ts||0));
  return rows;
}
function reFmtHistTime(ts){
  if(!ts) return '—';
  const d = new Date(ts), p = x=>String(x).padStart(2,'0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function renderMemberHistoryTab(record){
  const allRows = reMemberMatchHistory(record.id);
  const catOptions = COLLECTIONS.members.fields.find(f=>f.key==='category').options;
  const histCats = [...new Set(allRows.map(r=>r.category).filter(Boolean))];
  if(reHistFilter && !histCats.includes(reHistFilter)) reHistFilter = '';
  const filterBar = histCats.length>1 ? `<div class="tbk-rrtab" style="border-bottom:none;padding:0 0 14px">
    <button class="${reHistFilter===''?'on':''}" data-re-hist-filter="">Tất cả</button>
    ${histCats.map(c=>`<button class="${reHistFilter===c?'on':''}" data-re-hist-filter="${escapeAttr(c)}">${escapeHtml(c)}</button>`).join('')}
  </div>` : '';
  const rows = reHistFilter ? allRows.filter(r=>r.category===reHistFilter) : allRows;
  const rowsHtml = rows.map(r=>`<tr>
    <td>${escapeHtml(r.category||'—')}</td>
    <td class="cell-muted">${escapeHtml(r.opponent||'—')}</td>
    <td style="white-space:nowrap"><b style="color:${r.won?'var(--tag-green)':'var(--danger)'}">${escapeHtml(r.score)}</b></td>
    <td><b style="color:${r.points>=0?'var(--tag-green)':'var(--danger)'}">${r.points>=0?'+':''}${r.points}</b></td>
    <td class="cell-muted">${reFmtHistTime(r.ts)}</td>
    <td>${r.free ? `<span class="badge">Đấu tự do</span>` : `<span class="status blue">${escapeHtml(r.event)}</span>`}</td>
    <td class="actions">${r.free ? `<button class="btn-icon" data-re-rm-free="${r.id}" title="Xóa"><i class="ti ti-x"></i></button>` : ''}</td>
  </tr>`).join('');

  return `<div class="card"><div class="card-head"><div><h2>Ghi nhận trận đấu tự do</h2><div class="desc">Trận không thuộc giải đấu nào — cộng/trừ điểm xếp hạng trực tiếp</div></div></div>
    <div class="card-body padded">
      <div class="form-grid">
        <div class="fld"><label>Nội dung thi đấu</label><select id="re_fm_category"><option value="">— Chọn —</option>${catOptions.map(o=>`<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`).join('')}</select></div>
        <div class="fld"><label>Đối thủ</label><input type="text" id="re_fm_opponent" placeholder="Tên đối thủ"></div>
        <div class="fld"><label>Tỷ số của tôi</label><input type="number" min="0" id="re_fm_score1"></div>
        <div class="fld"><label>Tỷ số đối thủ</label><input type="number" min="0" id="re_fm_score2"></div>
        <div class="fld"><label>Điểm hạng thay đổi</label><input type="number" id="re_fm_points" placeholder="VD: 10 hoặc -5"></div>
        <div class="fld"><label>Ngày thi đấu</label><input type="date" id="re_fm_date"></div>
      </div>
      <div class="form-actions" style="justify-content:flex-end;border-top:none;padding-top:10px;margin-top:10px">
        <button class="btn btn-primary" id="reAddFreeMatchBtn"><i class="ti ti-plus"></i> Thêm trận đấu tự do</button>
      </div>
    </div>
  </div>
  ${filterBar}
  <div class="tbl-wrap" style="margin-top:${histCats.length>1?0:16}px">
    ${rows.length===0 ? `<div class="empty"><i class="ti ti-history"></i><b>Chưa có lịch sử thi đấu</b>${allRows.length?'Không có trận nào ở bộ môn này.':'Hội viên chưa tham gia trận đấu nào trong giải hoặc đấu tự do.'}</div>` : `<table><thead><tr><th>Nội dung thi đấu</th><th>Đối thủ</th><th>Tỷ số</th><th>Điểm hạng thay đổi</th><th>Thời gian thi đấu</th><th>Sự kiện</th><th style="width:50px"></th></tr></thead><tbody>${rowsHtml}</tbody></table>`}
  </div>`;
}
function reAddFreeMatch(record){
  const category = document.getElementById('re_fm_category').value;
  const opponent = document.getElementById('re_fm_opponent').value.trim();
  const score1 = document.getElementById('re_fm_score1').value;
  const score2 = document.getElementById('re_fm_score2').value;
  const points = document.getElementById('re_fm_points').value;
  const date = document.getElementById('re_fm_date').value;
  if(!opponent || score1==='' || score2==='' || points===''){ showToast('Vui lòng nhập đầy đủ đối thủ, tỷ số và điểm thay đổi', true); return; }
  const s1 = Number(score1), s2 = Number(score2), pts = Number(points);
  if(!Number.isFinite(s1) || !Number.isFinite(s2) || s1===s2){ showToast('Tỷ số không hợp lệ — phải có người thắng', true); return; }
  if(!category){ showToast('Vui lòng chọn nội dung thi đấu', true); return; }
  record.freeMatches = [...(record.freeMatches||[]), {id:uid(), category, opponent, score1:s1, score2:s2, points:pts, date, ts:date?new Date(date).getTime():Date.now()}];
  applyDisciplinePoints(record, category, pts, 1);
  recomputeMemberRanking();
  saveDB();
  syncAllMemberDisciplines();
  showToast('Đã ghi nhận trận đấu tự do và cập nhật điểm xếp hạng');
  renderContent();
}
function reRemoveFreeMatch(record, fmId){
  const fm = (record.freeMatches||[]).find(x=>x.id===fmId);
  if(!fm) return;
  if(!confirm('Xóa trận đấu tự do này? Điểm xếp hạng đã cộng sẽ được hoàn tác.')) return;
  applyDisciplinePoints(record, fm.category, -fm.points, -1);
  record.freeMatches = record.freeMatches.filter(x=>x.id!==fmId);
  recomputeMemberRanking();
  saveDB();
  syncAllMemberDisciplines();
  showToast('Đã xóa trận đấu tự do');
  renderContent();
}

function attachRecordEditorEvents(key){
  document.querySelectorAll('[data-retab]').forEach(t=>{
    t.addEventListener('click', ()=>{ reTab = t.getAttribute('data-retab'); renderContent(); });
  });
  if(reTab==='history' && key==='members'){
    const id = currentView.slice((key+'-edit:').length);
    const record = DB.members.find(r=>r.id===id);
    if(!record) return;
    const addBtn = document.getElementById('reAddFreeMatchBtn');
    if(addBtn) addBtn.addEventListener('click', ()=>reAddFreeMatch(record));
    document.querySelectorAll('[data-re-rm-free]').forEach(btn=>{
      btn.addEventListener('click', ()=>reRemoveFreeMatch(record, btn.getAttribute('data-re-rm-free')));
    });
    document.querySelectorAll('[data-re-hist-filter]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ reHistFilter = btn.getAttribute('data-re-hist-filter'); renderContent(); });
    });
    return;
  }
  attachRTEEvents();
  attachModalImageEvents();
  document.querySelectorAll('[data-multiselect]').forEach(chip=>{
    chip.addEventListener('click', ()=> chip.classList.toggle('on'));
  });
  const cancelBtn = document.getElementById('reCancelBtn');
  if(cancelBtn) cancelBtn.addEventListener('click', ()=>setView(key));
  const saveBtn = document.getElementById('reSaveBtn');
  if(saveBtn) saveBtn.addEventListener('click', ()=>saveRecordEditor(key));
  const delBtn = document.getElementById('reDeleteBtn');
  if(delBtn) delBtn.addEventListener('click', ()=>deleteRecordEditor(key));
  if(key==='members'){
    const id = currentView.slice((key+'-edit:').length);
    const record = DB.members.find(r=>r.id===id);
    if(record){
      const addDiscBtn = document.getElementById('reAddDisciplineBtn');
      if(addDiscBtn) addDiscBtn.addEventListener('click', ()=>reAddDiscipline(record));
      document.querySelectorAll('[data-re-disc-points]').forEach(input=>{
        input.addEventListener('change', ()=>reUpdateDisciplinePoints(record, Number(input.getAttribute('data-re-disc-points')), input.value));
      });
      document.querySelectorAll('[data-re-disc-matches]').forEach(input=>{
        input.addEventListener('change', ()=>reUpdateDisciplineMatches(record, Number(input.getAttribute('data-re-disc-matches')), input.value));
      });
      document.querySelectorAll('[data-re-rm-disc]').forEach(btn=>{
        btn.addEventListener('click', ()=>reRemoveDiscipline(record, Number(btn.getAttribute('data-re-rm-disc'))));
      });
    }
  }
}
async function saveRecordEditor(key){
  const c = COLLECTIONS[key];
  const id = currentView.slice((key+'-edit:').length);
  const isNew = id==='new';
  const data = {};
  let missingRequired = false;
  c.fields.forEach(f=>{
    let val;
    if(f.type==='checkbox'){ val = document.getElementById('f_'+f.key).classList.contains('on'); }
    else if(f.type==='image'){ val = modalImageValues[f.key] || ''; }
    else if(f.type==='file'){ val = modalFileValues[f.key] !== undefined ? modalFileValues[f.key] : (editingRecordFiles[f.key] || null); }
    else if(f.type==='richtext'){ val = document.getElementById('rte_'+f.key).innerHTML; }
    else if(f.type==='multiselect'){
      val = Array.from(document.querySelectorAll(`[data-multiselect="${f.key}"].on`)).map(el=>el.getAttribute('data-value'));
    }
    else {
      val = document.getElementById('f_'+f.key).value;
      if(f.type==='number' && val!=='') val = Number(val);
    }
    if(f.type==='password' && val==='' && !isNew) return;
    if(f.required && (val===''||val===undefined||val===null)) missingRequired = true;
    data[f.key] = val;
  });
  if(missingRequired){ showToast('Vui lòng điền đầy đủ các trường bắt buộc (*)', true); return; }

  if(c.remote){
    const ok = await saveRemoteCollectionRecord(key, isNew?null:id, data);
    if(!ok) return;
    renderSidebar();
    showToast(isNew ? 'Đã thêm mới' : 'Đã lưu thay đổi');
    setView(key);
    return;
  }

  if(isNew){
    data.id = uid();
    DB[key].push(data);
  } else {
    const idx = DB[key].findIndex(r=>r.id===id);
    DB[key][idx] = {...DB[key][idx], ...data};
  }
  await saveDB();
  renderSidebar();
  showToast(isNew ? 'Đã thêm mới' : 'Đã lưu thay đổi');
  setView(key);
}
async function deleteRecordEditor(key){
  const id = currentView.slice((key+'-edit:').length);
  const c = COLLECTIONS[key];
  const record = DB[key].find(r=>r.id===id);
  const label = record ? (record.name||record.title||`${c.single} này`) : `${c.single} này`;
  if(confirm(`Xóa "${label}" khỏi ${c.label}? Hành động này không thể hoàn tác.`)){
    if(c.remote){
      const ok = await deleteRemoteCollectionRecord(key, id);
      if(!ok) return;
      renderSidebar();
      showToast('Đã xóa');
      setView(key);
      return;
    }
    DB[key] = DB[key].filter(r=>r.id!==id);
    saveDB();
    renderSidebar();
    showToast('Đã xóa');
    setView(key);
  }
}
