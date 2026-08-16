/* =========================================================
   PAGE SECTIONS (mô phỏng — chưa kết nối thật với index.html)
   ========================================================= */
const PAGE_SECTIONS_REGISTRY = {
  'trang-chu': {label:'Trang chủ', icon:'ti-home', path:'/', sections:[
    {key:'hero', label:'Banner giải đấu nổi bật + Tin nổi bật', fields:[
      {key:'bannerTag', label:'Nhãn banner', type:'text', default:'GIẢI ĐẤU NỔI BẬT'},
      {key:'bannerTitle', label:'Tiêu đề banner', type:'text', span2:true, default:'Giải Vô địch Billiards & Snooker Quốc gia 2026'},
      {key:'bannerSubtitle', label:'Mô tả banner', type:'text', span2:true, default:'Khởi tranh 12/06 · Nhà thi đấu Phú Thọ, TP.HCM'},
      {key:'sideLabel', label:'Nhãn khối "Tin nổi bật"', type:'text', default:'Tin nổi bật'}
    ]},
    {key:'bxh-home', label:'Bảng xếp hạng quốc gia (trích)', title:'Bảng xếp hạng quốc gia', apiIntegrated:true},
    {key:'lich-giai-dau', label:'Lịch giải đấu sắp diễn ra', title:'Lịch giải đấu sắp diễn ra', apiIntegrated:true},
    {key:'tin-tuc-home', label:'Tin tức mới nhất', title:'Tin tức mới nhất', newsPicker:true},
    {key:'cta-hoi-vien', label:'CTA — Trở thành hội viên', fields:[
      {key:'title', label:'Tiêu đề', type:'text', span2:true, default:'Trở thành hội viên chính thức của VBSF'},
      {key:'subtitle', label:'Mô tả', type:'text', span2:true, default:'Đăng ký trực tuyến, theo dõi xếp hạng cá nhân và tham gia hệ thống giải đấu quốc gia.'},
      {key:'buttonText', label:'Nút bấm', type:'text', default:'Đăng ký hội viên'}
    ]},
    {key:'doi-tac-home', label:'Đối tác & nhà tài trợ', partnerPicker:true}
  ]},
  'gioi-thieu': {label:'Giới thiệu', icon:'ti-info-circle', path:'/gioi-thieu', sections:[
    {key:'thong-tin-chung', label:'Thông tin chung & số liệu', title:'Về Liên đoàn', fields:[
      {key:'paragraph', label:'Đoạn giới thiệu', type:'textarea', span2:true, rows:4, default:'Liên đoàn Billiards & Snooker Việt Nam (VBSF) là tổ chức xã hội – nghề nghiệp đại diện cho phong trào billiards & snooker trên cả nước.'},
      {key:'visionText', label:'Tầm nhìn', type:'textarea', default:'Đưa billiards & snooker Việt Nam phát triển chuyên nghiệp, minh bạch và hội nhập quốc tế.'},
      {key:'missionText', label:'Sứ mệnh', type:'textarea', default:'Chuẩn hóa hệ thống thi đấu, xếp hạng công bằng và mở rộng phong trào tới mọi cấp độ người chơi.'}
    ]},
    {key:'ban-lanh-dao', label:'Ban lãnh đạo & sơ đồ tổ chức', title:'Ban lãnh đạo', items:true, itemCount:4, maxItems:4,
      itemFields:[{key:'name', label:'Họ và tên', type:'text'},{key:'role', label:'Chức vụ', type:'text'}]},
    {key:'bo-mon', label:'Bộ môn thi đấu', title:'Billiards & Snooker', items:true, itemCount:3, maxItems:3,
      itemFields:[{key:'name', label:'Tên bộ môn', type:'text'},{key:'desc', label:'Mô tả', type:'text'},{key:'tags', label:'Nội dung (phân cách bởi ,)', type:'text'}]}
  ]},
  'tin-tuc': {label:'Tin tức', icon:'ti-news', path:'/tin-tuc', sections:[
    {key:'tin-noi-bat', label:'Bài viết nổi bật', fields:[
      {key:'tag', label:'Chuyên mục', type:'text', default:'HOẠT ĐỘNG VBSF'},
      {key:'title', label:'Tiêu đề', type:'text', span2:true, default:'VBSF công bố hệ thống thi đấu quốc gia năm 2026'},
      {key:'excerpt', label:'Tóm tắt', type:'textarea', span2:true, default:'Hệ thống giải đấu năm 2026 gồm các giải vô địch quốc gia, cúp khu vực và hệ thống tích điểm xếp hạng áp dụng cho tất cả nội dung pool, carom và snooker.'},
      {key:'date', label:'Ngày đăng', type:'text', default:'02/06/2026'}
    ]},
    {key:'danh-sach-tin', label:'Danh sách tin tức', newsPicker:true},
    {key:'sidebar-tin-tuc', label:'Sidebar (tìm kiếm, chuyên mục, tin xem nhiều)'}
  ]},
  'giai-dau': {label:'Giải đấu', icon:'ti-trophy', path:'/giai-dau', sections:[
    {key:'dang-dien-ra', label:'Giải đang diễn ra', apiIntegrated:true},
    {key:'sap-dien-ra', label:'Giải sắp diễn ra', title:'Sắp diễn ra', apiIntegrated:true},
    {key:'ket-qua-gan-day', label:'Kết quả gần đây', title:'Kết quả gần đây', apiIntegrated:true}
  ]},
  'ranking': {label:'Xếp hạng', icon:'ti-medal', path:'/xep-hang', sections:[
    {key:'top3', label:'Top 3 (podium)', title:'Top 3 · Pool 9 bi', apiIntegrated:true},
    {key:'bang-xep-hang', label:'Bảng xếp hạng chi tiết', apiIntegrated:true}
  ]},
  'thu-vien': {label:'Thư viện', icon:'ti-books', path:'/thu-vien', sections:[
    {key:'van-ban-luat', label:'Văn bản & Luật thi đấu', title:'Văn bản & Luật thi đấu', items:true, itemCount:6, maxItems:6,
      itemFields:[{key:'title', label:'Tên tài liệu', type:'text'},{key:'fileType', label:'Định dạng', type:'text'},{key:'size', label:'Dung lượng', type:'text'},{key:'date', label:'Ngày', type:'text'},{key:'tag', label:'Phân loại', type:'text'}]},
    {key:'thu-vien-media', label:'Thư viện media', title:'Thư viện media', items:true, itemCount:4, maxItems:4,
      itemFields:[{key:'title', label:'Tên album', type:'text'},{key:'mediaType', label:'Loại (photo/video)', type:'text'},{key:'count', label:'Số lượng', type:'text'}]}
  ]},
  'hoi-vien': {label:'Hội viên', icon:'ti-users', path:'/hoi-vien', sections:[
    {key:'form-dang-ky', label:'Form đăng ký hội viên', fields:[
      {key:'feeLabel', label:'Nhãn hội phí', type:'text', default:'Hội phí năm 2026'},
      {key:'feeAmount', label:'Số tiền', type:'text', default:'300.000đ'},
      {key:'bankName', label:'Ngân hàng', type:'text', default:'Vietcombank'},
      {key:'bankAccount', label:'Số tài khoản', type:'text', default:'00xx xxx xxx'}
    ]},
    {key:'danh-sach-hoi-vien', label:'Danh sách người chơi (hội viên)', title:'Danh sách hội viên', apiIntegrated:true}
  ]},
  'doi-tac': {label:'Đối tác', icon:'ti-building', path:'/doi-tac', sections:[
    {key:'gioi-thieu-doi-tac', label:'Đoạn giới thiệu', fields:[
      {key:'paragraph', label:'Nội dung', type:'textarea', span2:true, default:'Liên đoàn Billiards & Snooker Việt Nam trân trọng cảm ơn các đối tác và nhà tài trợ đã đồng hành, góp phần thúc đẩy phong trào và nâng tầm các giải đấu billiards & snooker trên cả nước.'}
    ]},
    {key:'doi-tac-chien-luoc', label:'Đối tác chiến lược', title:'Đối tác chiến lược', partnerPicker:true},
    {key:'tai-tro-kim-cuong', label:'Nhà tài trợ Kim cương', title:'Nhà tài trợ Kim cương', partnerPicker:true},
    {key:'tai-tro-vang', label:'Nhà tài trợ Vàng', title:'Nhà tài trợ Vàng', partnerPicker:true},
    {key:'doi-tac-dong-hanh', label:'Đối tác đồng hành', title:'Đối tác đồng hành', partnerPicker:true},
    {key:'cta-doi-tac', label:'CTA — Trở thành đối tác', fields:[
      {key:'title', label:'Tiêu đề', type:'text', span2:true, default:'Trở thành đối tác của VBSF'},
      {key:'subtitle', label:'Mô tả', type:'text', span2:true, default:'Cùng đồng hành phát triển phong trào billiards & snooker và kết nối với cộng đồng cơ thủ toàn quốc.'},
      {key:'buttonText', label:'Nút bấm', type:'text', default:'Liên hệ hợp tác'}
    ]}
  ]},
  'lien-he': {label:'Liên hệ', icon:'ti-phone', path:'/lien-he', sections:[
    {key:'thong-tin-lien-he', label:'Thông tin liên hệ', title:'Thông tin liên hệ', fields:[
      {key:'address', label:'Địa chỉ', type:'text', span2:true, default:'Số ..., Quận ..., Hà Nội, Việt Nam'},
      {key:'email', label:'Email', type:'text', default:'info@billiards.org.vn'},
      {key:'phone', label:'Điện thoại', type:'text', default:'024 xxxx xxxx'},
      {key:'hours', label:'Giờ làm việc', type:'text', span2:true, default:'Thứ 2 – Thứ 6 · 08:00 – 17:00'}
    ]},
    {key:'form-lien-he', label:'Form gửi liên hệ'},
    {key:'ban-do', label:'Bản đồ'}
  ]}
};
/* ---- Trang & section tùy chỉnh (do admin tạo thêm) ---- */
function getPageRegistry(pageKey){
  return PAGE_SECTIONS_REGISTRY[pageKey] || (DB.customPages && DB.customPages[pageKey]) || null;
}
function getAllPageKeys(){
  return [...Object.keys(PAGE_SECTIONS_REGISTRY), ...Object.keys(DB.customPages||{})];
}
function getPageLabel(pageKey){
  const meta = DB.pageMeta && DB.pageMeta[pageKey];
  if(meta && meta.title) return meta.title;
  const reg = getPageRegistry(pageKey);
  return reg ? reg.label : pageKey;
}
function getPageIcon(pageKey){ const reg = getPageRegistry(pageKey); return (reg && reg.icon) || 'ti-file'; }
function getPagePath(pageKey){
  const meta = DB.pageMeta && DB.pageMeta[pageKey];
  if(meta && meta.slug) return meta.slug;
  const reg = getPageRegistry(pageKey);
  return (reg && reg.path) || '';
}
function getSectionCatalog(pageKey){
  const builtIn = (PAGE_SECTIONS_REGISTRY[pageKey] && PAGE_SECTIONS_REGISTRY[pageKey].sections) || [];
  const custom = (DB.customSections && DB.customSections[pageKey]) || [];
  return [...builtIn, ...custom];
}
function getSectionDef(pageKey, key){
  return getSectionCatalog(pageKey).find(s=>s.key===key);
}
function getSectionLabel(pageKey, key){
  const entry = (DB.pageSections[pageKey]||[]).find(e=>e.key===key);
  const def = getSectionDef(pageKey, key);
  return (entry && entry.labelOverride) || (def && def.label) || key;
}
function makeDefaultSectionEntry(s){
  const entry = {key:s.key, enabled:true, title: s.title!==undefined ? s.title : undefined, itemCount: s.items ? s.itemCount : undefined, backgroundImage:null};
  if(s.fields){ entry.content = {}; s.fields.forEach(f=>{ entry.content[f.key] = f.default||''; }); }
  if(s.itemFields){ entry.items = Array.from({length:s.itemCount||1}, ()=>{ const it={}; s.itemFields.forEach(f=>it[f.key]=''); return it; }); }
  if(s.tournamentSelect){ entry.tournamentIds = []; }
  if(s.newsPicker){ entry.newsIds = []; }
  if(s.partnerPicker){ entry.partnerIds = []; }
  if(s.tournamentSelect || s.newsPicker){
    entry.pickerMode = 'manual';
    if(!s.singleSelect) entry.autoCount = 3;
  }
  return entry;
}
function ensurePageMeta(pageKey){
  if(!DB.pageMeta[pageKey]){
    const reg = getPageRegistry(pageKey);
    DB.pageMeta[pageKey] = {slug: (reg && reg.path) || ('/'+pageKey), title: (reg && reg.label) || pageKey, metaTitle:'', metaDescription:''};
  }
}
/** Đảm bảo DB.pageSections khớp với danh mục section hiện tại (thêm section mới lần đầu, không tự thêm lại section admin đã xóa, bù field còn thiếu). */
function normalizePageSections(){
  if(!DB.customPages) DB.customPages = {};
  if(!DB.customSections) DB.customSections = {};
  if(!DB.pageMeta) DB.pageMeta = {};
  if(!DB.pageSections) DB.pageSections = {};
  if(!DB.pageSectionKeysEverAdded) DB.pageSectionKeysEverAdded = {};
  getAllPageKeys().forEach(pageKey=>{
    ensurePageMeta(pageKey);
    if(!Array.isArray(DB.pageSections[pageKey])) DB.pageSections[pageKey] = [];
    if(!Array.isArray(DB.pageSectionKeysEverAdded[pageKey])) DB.pageSectionKeysEverAdded[pageKey] = DB.pageSections[pageKey].map(e=>e.key);
    const catalog = getSectionCatalog(pageKey);
    const everAdded = DB.pageSectionKeysEverAdded[pageKey];
    catalog.forEach(s=>{
      if(!DB.pageSections[pageKey].find(e=>e.key===s.key) && !everAdded.includes(s.key)){
        DB.pageSections[pageKey].push(makeDefaultSectionEntry(s));
        everAdded.push(s.key);
      }
    });
    DB.pageSections[pageKey] = DB.pageSections[pageKey].filter(e=>catalog.find(s=>s.key===e.key));
    DB.pageSections[pageKey].forEach(e=>{
      const s = catalog.find(r=>r.key===e.key);
      if(e.backgroundImage===undefined) e.backgroundImage = null;
      if(s.tournamentSelect){
        if(!Array.isArray(e.tournamentIds)) e.tournamentIds = e.tournamentId ? [e.tournamentId] : [];
        delete e.tournamentId;
      } else {
        delete e.tournamentIds;
      }
      if(s.newsPicker && !Array.isArray(e.newsIds)) e.newsIds = [];
      if(s.partnerPicker){ if(!Array.isArray(e.partnerIds)) e.partnerIds = []; } else { delete e.partnerIds; }
      if(s.tournamentSelect || s.newsPicker){
        if(e.pickerMode!=='auto' && e.pickerMode!=='manual') e.pickerMode = 'manual';
        if(!s.singleSelect && (typeof e.autoCount!=='number' || e.autoCount<1)) e.autoCount = 3;
        if(s.singleSelect) delete e.autoCount;
      } else {
        delete e.pickerMode; delete e.autoCount;
      }
      if(!s.items){ delete e.items; delete e.itemCount; }
      if(!s.fields){ delete e.content; }
    });
  });
}

const SETTINGS_FIELDS = [
  {key:'orgName', label:'Tên đầy đủ tổ chức', type:'text', span2:true},
  {key:'orgShort', label:'Tên viết tắt', type:'text'},
  {key:'foundedYear', label:'Năm thành lập', type:'text'},
  {key:'memberCount', label:'Số hội viên (hiển thị)', type:'text'},
  {key:'clubCount', label:'Số câu lạc bộ (hiển thị)', type:'text'},
  {key:'provinceCount', label:'Số tỉnh/thành (hiển thị)', type:'text'},
  {key:'about', label:'Giới thiệu chung', type:'textarea', span2:true, rows:5},
  {key:'heroTitle', label:'Giải đấu nổi bật (trang chủ)', type:'text', span2:true},
  {key:'heroSubtitle', label:'Mô tả giải đấu nổi bật', type:'text', span2:true},
  {key:'memberFee', label:'Hội phí năm (VNĐ)', type:'text'},
  {key:'bankName', label:'Ngân hàng', type:'text'},
  {key:'bankAccount', label:'Số tài khoản', type:'text'},
  {key:'bankHolder', label:'Chủ tài khoản', type:'text'}
];

const CONTACT_FIELDS = [
  {key:'address', label:'Địa chỉ', type:'text', span2:true},
  {key:'email', label:'Email', type:'text'},
  {key:'phone', label:'Điện thoại', type:'text'},
  {key:'hours', label:'Giờ làm việc', type:'text', span2:true},
  {key:'facebook', label:'Facebook (URL)', type:'text'},
  {key:'youtube', label:'YouTube (URL)', type:'text'},
  {key:'tiktok', label:'TikTok (URL)', type:'text'}
];

