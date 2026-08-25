/* =========================================================
   AUTH — Đăng nhập, đăng xuất, đổi/đặt lại mật khẩu, quản lý tài khoản
   Xác thực thật qua Strapi (plugin Users & Permissions), KHÔNG dùng dữ liệu giả.
   ========================================================= */
// Local dev (file:// hoặc localhost): Strapi chạy riêng ở cổng 1337.
// Trên live: Strapi được nginx reverse-proxy dưới CÙNG domain với CMS
// (xem deploy/nginx/vbsf-cms.biadi.vn.conf), nên dùng path tương đối (same-origin).
const STRAPI_URL = (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:1337' : '';
const CMS_JWT_KEY = 'vbsf_cms_jwt';
const CMS_REFRESH_KEY = 'vbsf_cms_refresh';
// Vai trò "Authenticated" mặc định của Strapi users-permissions (id=1 trên cài đặt mới).
const CMS_ACCOUNT_ROLE_ID = 1;

let CMS_CURRENT_USER = null;

function getStoredTokens(){
  try{
    return { jwt: localStorage.getItem(CMS_JWT_KEY), refreshToken: localStorage.getItem(CMS_REFRESH_KEY) };
  }catch(e){ return { jwt:null, refreshToken:null }; }
}
function storeTokens(jwt, refreshToken){
  try{
    if(jwt) localStorage.setItem(CMS_JWT_KEY, jwt);
    if(refreshToken) localStorage.setItem(CMS_REFRESH_KEY, refreshToken);
  }catch(e){}
}
function clearTokens(){
  try{ localStorage.removeItem(CMS_JWT_KEY); localStorage.removeItem(CMS_REFRESH_KEY); }catch(e){}
}

async function refreshAccessToken(){
  const { refreshToken } = getStoredTokens();
  if(!refreshToken) return false;
  try{
    const res = await fetch(STRAPI_URL+'/api/auth/refresh', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ refreshToken })
    });
    if(!res.ok) return false;
    const out = await res.json();
    storeTokens(out.jwt, out.refreshToken);
    return true;
  }catch(e){ return false; }
}

async function apiFetch(path, options, retry){
  options = options || {};
  if(retry===undefined) retry = true;
  const { jwt } = getStoredTokens();
  const headers = Object.assign({'Content-Type':'application/json'}, options.headers||{});
  if(jwt) headers['Authorization'] = 'Bearer '+jwt;
  const res = await fetch(STRAPI_URL+path, Object.assign({}, options, { headers }));
  if(res.status===401 && retry){
    const refreshed = await refreshAccessToken();
    if(refreshed) return apiFetch(path, options, false);
  }
  return res;
}

async function refreshAccountsFromApi(){
  try{
    const res = await apiFetch('/api/users');
    if(!res.ok){ DB.accounts = []; return; }
    const users = await res.json();
    DB.accounts = users.map(u=>({ id:String(u.id), displayName:u.displayName||'', username:u.username }));
  }catch(e){ DB.accounts = []; }
}

async function saveRemoteAccount(id, data){
  try{
    let res;
    if(id){
      const body = { displayName: data.displayName, username: data.username, email: data.username };
      if(data.password) body.password = data.password;
      res = await apiFetch('/api/users/'+id, { method:'PUT', body: JSON.stringify(body) });
    } else {
      res = await apiFetch('/api/users', { method:'POST', body: JSON.stringify({
        username: data.username, email: data.username, password: data.password,
        displayName: data.displayName, confirmed: true, role: CMS_ACCOUNT_ROLE_ID
      })});
    }
    if(!res.ok){
      const out = await res.json().catch(()=>({}));
      showToast(out.error && out.error.message || 'Không thể lưu tài khoản', true);
      return false;
    }
    await refreshAccountsFromApi();
    return true;
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
    return false;
  }
}

async function deleteRemoteAccount(id){
  try{
    const res = await apiFetch('/api/users/'+id, { method:'DELETE' });
    if(!res.ok){ showToast('Không thể xóa tài khoản', true); return false; }
    await refreshAccountsFromApi();
    return true;
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
    return false;
  }
}

async function resetAccountPassword(key, id){
  const record = DB[key].find(r=>r.id===id);
  if(!record) return;
  const next = prompt(`Nhập mật khẩu mới cho tài khoản "${record.displayName || record.username}":`);
  if(next===null) return;
  if(next.length < 6){ showToast('Mật khẩu phải có ít nhất 6 ký tự', true); return; }
  const res = await apiFetch('/api/users/'+id, { method:'PUT', body: JSON.stringify({ password: next }) });
  if(!res.ok){ showToast('Không thể đặt lại mật khẩu', true); return; }
  showToast('Đã đặt lại mật khẩu');
}

async function tryRestoreSession(){
  const { jwt } = getStoredTokens();
  if(!jwt) return false;
  try{
    const res = await apiFetch('/api/users/me');
    if(!res.ok){ clearTokens(); return false; }
    CMS_CURRENT_USER = await res.json();
    return true;
  }catch(e){ return false; }
}

async function showCmsApp(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = '';
  await refreshAccountsFromApi();
  const remoteKeys = Object.keys(COLLECTIONS).filter(k=>COLLECTIONS[k].remote && !COLLECTIONS[k].strapiUsers);
  await Promise.all([
    ...remoteKeys.map(k=>refreshRemoteCollection(k)),
    refreshSingletonFromApi('settings'),
    refreshSingletonFromApi('contact')
  ]);
  renderSidebar();
  renderTopbar();
  renderContent();
}

function showCmsLogin(message){
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  const err = document.getElementById('loginError');
  err.textContent = message || '';
  err.style.display = message ? 'block' : 'none';
  document.getElementById('loginUsername').focus();
}

async function handleCmsLogin(e){
  e.preventDefault();
  const identifier = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.querySelector('#loginForm button[type=submit]');
  submitBtn.disabled = true;
  try{
    const res = await fetch(STRAPI_URL+'/api/auth/local', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ identifier, password })
    });
    const out = await res.json().catch(()=>({}));
    if(!res.ok){
      showCmsLogin(out.error && out.error.status===400 ? 'Tên đăng nhập hoặc mật khẩu không đúng' : 'Không thể đăng nhập. Vui lòng thử lại.');
      return;
    }
    storeTokens(out.jwt, out.refreshToken);
    CMS_CURRENT_USER = out.user;
    await showCmsApp();
  }catch(err){
    showCmsLogin('Không thể kết nối máy chủ Strapi'+(STRAPI_URL ? ' tại '+STRAPI_URL : ''));
  }finally{
    submitBtn.disabled = false;
  }
}

async function handleCmsLogout(e){
  e.preventDefault();
  try{ await apiFetch('/api/auth/logout', { method:'POST' }); }catch(e){}
  clearTokens();
  CMS_CURRENT_USER = null;
  location.reload();
}

function openChangePasswordModal(e){
  if(e) e.preventDefault();
  document.getElementById('pwCurrent').value = '';
  document.getElementById('pwNew').value = '';
  document.getElementById('pwConfirm').value = '';
  document.getElementById('pwModalOverlay').classList.add('on');
  document.getElementById('sidebar').classList.remove('open');
}

function closeChangePasswordModal(){
  document.getElementById('pwModalOverlay').classList.remove('on');
}

async function saveChangePassword(){
  const current = document.getElementById('pwCurrent').value;
  const next = document.getElementById('pwNew').value;
  const confirmVal = document.getElementById('pwConfirm').value;
  if(next.length < 6){ showToast('Mật khẩu mới phải có ít nhất 6 ký tự', true); return; }
  if(next !== confirmVal){ showToast('Xác nhận mật khẩu mới không khớp', true); return; }
  try{
    const res = await apiFetch('/api/auth/change-password', {
      method:'POST',
      body: JSON.stringify({ currentPassword: current, password: next, passwordConfirmation: confirmVal })
    });
    const out = await res.json().catch(()=>({}));
    if(!res.ok){
      const msg = out.error && out.error.message==='The provided current password is invalid'
        ? 'Mật khẩu hiện tại không đúng' : (out.error && out.error.message) || 'Không thể đổi mật khẩu';
      showToast(msg, true);
      return;
    }
    storeTokens(out.jwt, out.refreshToken);
    CMS_CURRENT_USER = out.user;
    closeChangePasswordModal();
    showToast('Đã đổi mật khẩu');
  }catch(e){
    showToast('Không thể kết nối máy chủ Strapi', true);
  }
}

document.getElementById('loginForm').addEventListener('submit', handleCmsLogin);
document.getElementById('logoutLink').addEventListener('click', handleCmsLogout);
document.getElementById('changePasswordLink').addEventListener('click', openChangePasswordModal);
document.getElementById('pwModalClose').addEventListener('click', closeChangePasswordModal);
document.getElementById('pwCancelBtn').addEventListener('click', closeChangePasswordModal);
document.getElementById('pwSaveBtn').addEventListener('click', saveChangePassword);
document.getElementById('pwModalOverlay').addEventListener('click', (e)=>{ if(e.target.id==='pwModalOverlay') closeChangePasswordModal(); });

(async function initCms(){
  await loadDB();
  if(await tryRestoreSession()) showCmsApp(); else showCmsLogin();
})();
