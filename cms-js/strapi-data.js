/* =========================================================
   STRAPI DATA — đồng bộ các collection nội dung (news, partners,
   library_docs, library_media, members, members_org) và 2 singleton
   (settings, contact) với Strapi. Dùng chung apiFetch()/getStoredTokens()
   từ auth.js.

   Ghi chú: tournaments CHƯA được nối vào Strapi ở đây — mặc dù Strapi đã
   có content-type "tournament" đầy đủ (bracket/players/prizes json/component),
   bộ máy giải đấu cục bộ (tournament-editor.js + tournament-engine.js) ghi
   trực tiếp vào DB.tournaments qua ~20 điểm gọi saveDB() rải rác trong logic
   sinh bracket/Swiss/vòng tròn — nối đầy đủ cần một lần làm riêng, không
   bolt-on an toàn trong lượt sửa này. Tương tự, phần chỉnh sửa "disciplines"
   (Hạng/Điểm) trong hồ sơ hội viên vẫn chỉ lưu cục bộ — CRUD hồ sơ chính đã
   nối Strapi nhưng sub-editor điểm/hạng theo từng nội dung thi đấu là tính
   năng nested phức tạp hơn, để lại làm sau nếu cần.
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
  // Không phải field chỉnh sửa qua form nhưng cần hiển thị (cột Hạng/Điểm ở
  // danh sách hội viên đọc trực tiếp từ disciplines).
  if(item.disciplines) rec.disciplines = item.disciplines;
  if(item.freeMatches) rec.freeMatches = item.freeMatches;
  return rec;
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
