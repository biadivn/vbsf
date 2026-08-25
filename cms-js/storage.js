/* =========================================================
   STORAGE
   ========================================================= */
const STORAGE_KEY='vbsf_cms_data_v1';
let DB=null;
let syncingKey=null;

async function loadDB(){
  try{
    const res = await window.storage.get(STORAGE_KEY, false);
    if(res && res.value){
      DB = JSON.parse(res.value);
      let needsSave=false;
      for(const table of Object.keys(DB_TABLES)){
        if(!Array.isArray(DB[table])){ DB[table] = await fetchFromDatabase(table); needsSave=true; }
      }
      normalizePageSections();
      needsSave = true;
      if(needsSave) await saveDB();
      DB.accounts = [];
      return;
    }
  }catch(e){ /* key not found or storage unavailable */ }
  DB = seedData();
  for(const table of Object.keys(DB_TABLES)){
    DB[table] = await fetchFromDatabase(table);
  }
  DB.pageSections = {}; DB.customPages = {}; DB.customSections = {}; DB.pageMeta = {}; DB.pageSectionKeysEverAdded = {};
  normalizePageSections();
  await saveDB();
  DB.accounts = [];
}

async function syncFromDatabase(key){
  syncingKey = key;
  renderContent();
  const rows = await fetchFromDatabase(key);
  const toggleKey = COLLECTIONS[key] && COLLECTIONS[key].toggleVisibility;
  if(toggleKey){
    const prevByName = {};
    (DB[key]||[]).forEach(r=>{ if(r[toggleKey]) prevByName[r.name] = true; });
    rows.forEach(r=>{ if(prevByName[r.name]) r[toggleKey] = true; });
  }
  DB[key] = rows;
  syncingKey = null;
  await saveDB();
  renderSidebar();
  renderContent();
  showToast(`Đã đồng bộ ${rows.length} mục từ cơ sở dữ liệu`);
}
async function saveDB(){
  try{
    await window.storage.set(STORAGE_KEY, JSON.stringify(DB), false);
  }catch(e){
    console.error('Storage save failed', e);
    showToast('Không thể lưu dữ liệu (lỗi bộ nhớ)', true);
  }
}

