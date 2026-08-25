/* =========================================================
   STRAPI DATA — đồng bộ các collection nội dung (news, partners,
   library_docs, library_media) và 2 singleton (settings, contact)
   với Strapi. Dùng chung apiFetch()/getStoredTokens() từ auth.js.

   Ghi chú: tournaments, members, members_org CHƯA được nối vào Strapi
   ở đây — các collection này còn phụ thuộc dữ liệu component/quan hệ
   phức tạp (giải đấu: bracket/players/prizes; hội viên: disciplines/
   freeMatches) và bộ máy giải đấu cục bộ (tournament-editor.js), nên
   việc đồng bộ đầy đủ để lại cho một lần làm riêng.
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
      payload[f.key] = data[f.key];
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
