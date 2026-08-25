/* =========================================================
   STRAPI DATA — đồng bộ các collection nội dung (news, partners,
   library_docs, library_media, members, members_org, tournaments) và
   2 singleton (settings, contact) với Strapi. Dùng chung
   apiFetch()/getStoredTokens() từ auth.js.

   tournaments: engine cục bộ (tournament-editor.js) vẫn mutate trực tiếp
   record trong DB.tournaments (bracket/Swiss/vòng tròn, ~20 điểm gọi
   saveDB()) — mỗi điểm đó gọi thêm teSyncTournamentToStrapi(record) để
   đẩy toàn bộ trạng thái (info + players + prizes + bracket/rr/sw) lên
   Strapi. players là Strapi component, không lưu được field "id" tùy ý
   nên dùng "localId" làm id ổn định — xem mapStrapiEntryToRecord.

   members: CRUD hồ sơ chính đi qua saveRemoteCollectionRecord (record-editor.js).
   Sub-editor "Xếp hạng theo bộ môn" + "Lịch sử thi đấu tự do" chỉnh
   disciplines/freeMatches riêng, không nằm trong c.fields, nên đồng bộ
   qua pushMemberDisciplinesPatch()/syncAllMemberDisciplines() thay vì
   saveRemoteCollectionRecord.
   ========================================================= */
const SINGLETON_API_PATH = { settings:'setting', contact:'contact-info' };

async function uploadDataUri(dataUri, filenameHint){
  const blobRes = await fetch(dataUri);
  const blob = await blobRes.blob();
  const ext = (blob.type.split('/')[1] || 'png');
  const form = new FormData();
  form.append('files', blob, `${filenameHint}-${Date.now()}.${ext}`);
  const { jwt } = getStoredTokens();
  const headers = {};
  if(jwt) headers['Authorization'] = 'Bearer '+jwt;
  const res = await fetch(STRAPI_URL+'/api/upload', { method:'POST', headers, body: form });
  if(!res.ok) throw new Error('upload failed');
  const out = await res.json();
  return out[0].id;
}

function mediaUrl(media){
  if(!media || !media.url) return '';
  return media.url.startsWith('http') ? media.url : STRAPI_URL + media.url;
}

function mapStrapiEntryToRecord(c, item){
  const rec = { id: item.documentId };
  c.fields.forEach(f=>{
    rec[f.key] = f.type==='image' ? mediaUrl(item[f.key]) : item[f.key];
  });
  // Field không nằm trong form chỉnh sửa (c.fields) nhưng CMS vẫn cần đọc để
  // hiển thị/vận hành — vd. disciplines/freeMatches (hội viên), bracket/rr/sw/mode
  // (giải đấu). Khai báo qua COLLECTIONS[key].extraFields, copy trực tiếp.
  (c.extraFields||[]).forEach(k=>{ if(item[k]!==undefined) rec[k] = item[k]; });
  // players/prizes là Strapi component (repeatable) — cần map lại hình dạng vì
  // component không lưu được field "id" tùy ý (Strapi reserve tên này); dùng
  // "localId" làm id ổn định cho player, khớp với tham chiếu p1/p2/a/b/aId/bId
  // bên trong bracket/rr/sw JSON.
  if(item.players) rec.players = item.players.map(p=>({
    id: p.localId, memberId: p.memberId || null, name: p.name, club: p.club || '',
    registeredAt: p.registeredAt ? new Date(p.registeredAt).getTime() : Date.now(),
    feeStatus: p.feeStatus || 'unpaid', seed: p.seed || undefined, rating: p.rating || undefined
  }));
  if(item.prizes) rec.prizes = item.prizes.map(p=>({ rank: p.rank||'', cash: p.cash||'', item: p.item||'' }));
  return rec;
}

/* ---------- Giải đấu — đồng bộ toàn bộ trạng thái (info + players + prizes +
   bracket/rr/sw) lên Strapi. Engine cục bộ (tournament-editor.js) mutate trực
   tiếp record trong DB.tournaments rồi gọi các hàm dưới đây để đẩy lên server. ---------- */
function teNz(v){ return (v===''||v===undefined) ? null : v; }
function tePlayersToStrapiPayload(players){
  return (players||[]).map(p=>({
    localId: p.id, memberId: p.memberId||null, name: p.name, club: p.club||null,
    registeredAt: p.registeredAt ? new Date(p.registeredAt).toISOString() : null,
    feeStatus: p.feeStatus||'unpaid', seed: p.seed||null, rating: p.rating||null
  }));
}
function tePrizesToStrapiPayload(prizes){
  return (prizes||[]).map(p=>({ rank: p.rank||'', cash: p.cash||'', item: p.item||'' }));
}
function teBuildTournamentPayload(record){
  return {
    name: record.name, category: teNz(record.category), format: teNz(record.format),
    lives: (record.lives!=null && record.lives!=='') ? Number(record.lives) : null,
    status: teNz(record.status), mode: teNz(record.mode),
    date: teNz(record.date),
    participants: (record.participants!=null && record.participants!=='') ? Number(record.participants) : null,
    location: teNz(record.location), note: teNz(record.note), regDeadline: teNz(record.regDeadline),
    liveRound: teNz(record.liveRound), champion: teNz(record.champion), entryFee: teNz(record.entryFee),
    rules: teNz(record.rules), metaTitle: teNz(record.metaTitle), metaDescription: teNz(record.metaDescription),
    players: tePlayersToStrapiPayload(record.players), prizes: tePrizesToStrapiPayload(record.prizes),
    bracket: record.bracket||null, rr: record.rr||null, sw: record.sw||null
  };
}
async function teCreateTournamentOnStrapi(data){
  try{
    const res = await apiFetch('/api/tournaments', { method:'POST', body: JSON.stringify({ data: teBuildTournamentPayload(data) }) });
    if(!res.ok){
      const out = await res.json().catch(()=>({}));
      showToast((out.error && out.error.message) || 'Không thể tạo giải đấu', true);
      return null;
    }
    const out = await res.json();
    return out.data.documentId;
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
    return null;
  }
}
async function teSyncTournamentToStrapi(record){
  if(!record || !record.id) return;
  try{
    const res = await apiFetch(`/api/tournaments/${record.id}`, { method:'PUT', body: JSON.stringify({ data: teBuildTournamentPayload(record) }) });
    if(!res.ok) showToast('Không thể đồng bộ giải đấu lên máy chủ', true);
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
  }
}

/* ---------- Hội viên — đồng bộ disciplines/freeMatches (chỉnh sửa trong
   sub-editor "Xếp hạng theo bộ môn" / "Lịch sử thi đấu", tách khỏi CRUD
   trường chính đã có ở saveRemoteCollectionRecord). ---------- */
async function pushMemberDisciplinesPatch(member){
  if(!member || !member.id) return;
  const disciplines = (member.disciplines||[]).map(d=>({
    category: d.category, points: d.points||0, rank: d.rank!=null?d.rank:null,
    matches: d.matches||0, trend: d.trend||'eq', trendValue: d.trendValue||0
  }));
  const freeMatches = (member.freeMatches||[]).map(fm=>({
    category: fm.category, opponent: fm.opponent, score1: fm.score1, score2: fm.score2,
    points: fm.points, date: fm.date||null
  }));
  try{
    const res = await apiFetch(`/api/members/${member.id}`, { method:'PUT', body: JSON.stringify({ data: { disciplines, freeMatches } }) });
    if(!res.ok) showToast('Không thể đồng bộ xếp hạng hội viên lên máy chủ', true);
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
  }
}
async function syncAllMemberDisciplines(){
  await Promise.all((DB.members||[]).map(m=>pushMemberDisciplinesPatch(m)));
}

async function refreshRemoteCollection(key){
  const c = COLLECTIONS[key];
  try{
    let page = 1, all = [], pageCount = 1;
    do{
      const res = await apiFetch(`/api/${c.apiPath}?pagination[page]=${page}&pagination[pageSize]=100&populate=*`);
      if(!res.ok) break;
      const out = await res.json();
      all = all.concat(out.data || []);
      pageCount = (out.meta && out.meta.pagination && out.meta.pagination.pageCount) || 1;
      page++;
    } while(page <= pageCount);
    DB[key] = all.map(item=>mapStrapiEntryToRecord(c, item));
  }catch(e){
    DB[key] = DB[key] || [];
  }
}

async function saveRemoteCollectionRecord(key, id, data){
  const c = COLLECTIONS[key];
  try{
    const payload = {};
    for(const f of c.fields){
      if(f.type==='image'){
        const val = data[f.key];
        if(val && val.startsWith('data:')) payload[f.key] = await uploadDataUri(val, f.key);
        else if(val === '') payload[f.key] = null;
        continue;
      }
      const val = data[f.key];
      // Strapi enumeration/date fields từ chối chuỗi rỗng ("") — chỉ nhận đúng
      // một giá trị enum hoặc null. Select/date chưa chọn luôn gửi lên "".
      payload[f.key] = val === '' ? null : val;
    }
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/${c.apiPath}/${id}` : `/api/${c.apiPath}`;
    const res = await apiFetch(url, { method, body: JSON.stringify({ data: payload }) });
    if(!res.ok){
      const out = await res.json().catch(()=>({}));
      showToast((out.error && out.error.message) || 'Không thể lưu', true);
      return false;
    }
    await refreshRemoteCollection(key);
    return true;
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
    return false;
  }
}

async function deleteRemoteCollectionRecord(key, id){
  const c = COLLECTIONS[key];
  try{
    const res = await apiFetch(`/api/${c.apiPath}/${id}`, { method:'DELETE' });
    if(!res.ok){ showToast('Không thể xóa', true); return false; }
    await refreshRemoteCollection(key);
    return true;
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
    return false;
  }
}

async function refreshSingletonFromApi(key){
  const apiPath = SINGLETON_API_PATH[key];
  try{
    const res = await apiFetch(`/api/${apiPath}`);
    if(!res.ok) return; // singleton chưa có dữ liệu — giữ nguyên seed mặc định
    const out = await res.json();
    if(out.data) DB[key] = Object.assign({}, DB[key], out.data);
  }catch(e){ /* Strapi không truy cập được — giữ dữ liệu hiện có */ }
}

async function saveSingletonToApi(key, data){
  const apiPath = SINGLETON_API_PATH[key];
  try{
    const res = await apiFetch(`/api/${apiPath}`, { method:'PUT', body: JSON.stringify({ data }) });
    if(!res.ok){
      const out = await res.json().catch(()=>({}));
      showToast((out.error && out.error.message) || 'Không thể lưu', true);
      return false;
    }
    return true;
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
    return false;
  }
}
