/* =========================================================
   PAGE MODAL (tạo trang mới / cài đặt trang: slug, title, metadata)
   ========================================================= */
let pageModal = null;
const PAGE_META_FIELDS = [
  {key:'title', label:'Tên trang', type:'text', required:true, span2:true},
  {key:'slug', label:'Slug (đường dẫn)', type:'text', required:true, placeholder:'/ten-trang'},
  {key:'metaTitle', label:'Meta title (SEO)', type:'text'},
  {key:'metaDescription', label:'Meta description (SEO)', type:'textarea', span2:true, rows:3}
];
function slugify(str){
  return '/'+String(str).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/đ/g,'d').replace(/Đ/g,'d')
    .replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
}
const NEW_PAGE_FIELDS = [
  {key:'title', label:'Tên trang', type:'text', required:true, span2:true, placeholder:'VD: Sự kiện đặc biệt'}
];
function slugify(str){
  return '/'+String(str).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/đ/g,'d').replace(/Đ/g,'d')
    .replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
}
function openPageModal(){
  editingCollection = null; editingId = null; addSectionModal = null;
  pageModal = {values:{title:''}};
  document.getElementById('modalTitle').textContent = 'Tạo trang mới';
  document.getElementById('modalDeleteBtn').style.display = 'none';
  const body = document.getElementById('modalBody');
  body.innerHTML = `<div class="form-grid">` + NEW_PAGE_FIELDS.map(f=>
    `<div class="fld ${f.span2?'span2':''}"><label>${f.label}${f.required?' <span class="req">*</span>':''}</label>${renderField(f, pageModal.values[f.key])}</div>`
  ).join('') + `<div class="hint" style="margin-top:2px">Bạn có thể chỉnh slug và metadata SEO ngay trong màn hình chi tiết của trang sau khi tạo.</div></div>`;
  document.getElementById('modalOverlay').classList.add('on');
}
async function savePageModal(){
  const title = document.getElementById('f_title').value.trim();
  if(!title){ showToast('Vui lòng nhập tên trang', true); return; }
  const slug = slugify(title);
  const base = slug.replace(/^\//,'') || 'trang-moi';
  let pageKey = base, i = 2;
  while(getAllPageKeys().includes(pageKey)) pageKey = `${base}-${i++}`;
  DB.customPages[pageKey] = {label:title, icon:'ti-file', path:slug};
  DB.customSections[pageKey] = [];
  DB.pageSections[pageKey] = [];
  DB.pageSectionKeysEverAdded[pageKey] = [];
  DB.pageMeta[pageKey] = {slug, title, metaTitle:'', metaDescription:''};
  await saveDB();
  closePageModal();
  setView('page:'+pageKey);
  showToast('Đã tạo trang mới');
}
function closePageModal(){
  pageModal = null;
  document.getElementById('modalOverlay').classList.remove('on');
}

