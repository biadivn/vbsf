/* =========================================================
   NAV / STATE
   ========================================================= */
let currentView = 'dashboard';
let searchTerm = '';
let filterValue = '';
let editingCollection = null;
let editingId = null;
let activeSectionKey = null;
let sectionEditBuffer = null;

const NAV_GROUPS = [
  {label:null, items:[{key:'dashboard', label:'Tổng quan', icon:'ti-layout-dashboard'}]},
  {label:'Quản lý website', items:[
    {key:'pages', label:'Trang website', icon:'ti-layout-2'},
    {key:'news', label:COLLECTIONS.news.label, icon:'ti-news'},
    {key:'settings', label:'Thông tin tổ chức', icon:'ti-settings'},
    {key:'contact', label:'Liên hệ', icon:'ti-address-book'},
  ]},
  {label:'Quản lý giải đấu', items:[
    {key:'tournaments', label:COLLECTIONS.tournaments.label, icon:'ti-trophy'},
  ]},
  {label:'Quản lý Hội viên', items:[
    {key:'members', label:COLLECTIONS.members.label, icon:'ti-users'},
    {key:'members_org', label:COLLECTIONS.members_org.label, icon:'ti-building'},
    {key:'partners', label:COLLECTIONS.partners.label, icon:'ti-building'},
  ]},
  {label:'Thư viện', items:[
    {key:'library_docs', label:'Văn bản & Luật', icon:'ti-file-text'},
    {key:'library_media', label:'Media', icon:'ti-photo'},
  ]},
  {label:'Quản trị hệ thống', items:[
    {key:'accounts', label:COLLECTIONS.accounts.label, icon:'ti-user-shield'},
  ]}
];

function countFor(key){
  if(COLLECTIONS[key]) return DB[key].length;
  return null;
}

function renderSidebar(){
  const nav = document.getElementById('sbNav');
  nav.innerHTML = NAV_GROUPS.map(group=>{
    const label = group.label ? `<div class="sb-group-label">${group.label}</div>` : '';
    const items = group.items.map(it=>{
      const c = countFor(it.key);
      const active = (currentView===it.key || (it.key==='pages' && currentView.startsWith('page:')) || (it.key==='news' && currentView.startsWith('news-edit:')) || (it.key==='tournaments' && currentView.startsWith('tournament-edit:')) || (COLLECTIONS[it.key] && COLLECTIONS[it.key].pageEdit && currentView.startsWith(it.key+'-edit:'))) ? 'active' : '';
      return `<div class="sb-item ${active}" data-nav="${it.key}">
        <span class="lft"><i class="ti ${it.icon}"></i>${it.label}</span>
        ${c!==null ? `<span class="sb-count">${c}</span>` : ''}
      </div>`;
    }).join('');
    return label+items;
  }).join('');
  nav.querySelectorAll('[data-nav]').forEach(el=>{
    el.addEventListener('click', ()=>{ setView(el.getAttribute('data-nav')); document.getElementById('sidebar').classList.remove('open'); });
  });
}

function getPageEditKey(view){
  return Object.keys(COLLECTIONS).find(key=> COLLECTIONS[key].pageEdit && view.startsWith(key+'-edit:')) || null;
}

function setView(view){
  currentView = view;
  searchTerm = '';
  filterValue = '';
  renderSidebar();
  renderTopbar();
  renderContent();
}

