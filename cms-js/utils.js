/* =========================================================
   UTILS
   ========================================================= */
function escapeHtml(str){
  return String(str??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(str){ return escapeHtml(str); }
function stripHtml(html){ return String(html??'').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function fmtDate(d){
  if(!d) return '—';
  const parts = String(d).split('-');
  if(parts.length===3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}
/* ---------- Hiệu lực hội viên của một VĐV ----------
   LUÔN soi lại theo hồ sơ trong module "Hội viên & Xếp hạng", không đọc giá trị
   `memberValid` đã lưu trên bản ghi VĐV: hồ sơ hội viên hết hạn hay vừa được
   duyệt hội phí thì bản ghi VĐV không tự đổi theo, nên giá trị đã lưu chỉ là
   ảnh chụp lúc thêm vào danh sách. Vận hành cũng không được bật/tắt tay — hiệu
   lực là thuộc tính của hồ sơ hội viên, không phải của bản ghi VĐV.

   Quy tắc trùng với matchMember ở máy chủ (strapi-backend/src/utils/
   tournament-entry.js): khớp theo CCCD, còn hiệu lực = status 'active' VÀ hạn
   tính đến HẾT ngày `expiry`. */
function cccdKey(v){ return String(v??'').replace(/[^\dA-Za-z]/g, ''); }

function taMemberMatch(cccd){
  const key = cccdKey(cccd);
  if(!key) return {found:false, valid:false, code:'', label:'Chưa có số căn cước để đối chiếu', tone:'gray'};

  const m = (DB.members||[]).find(x=> cccdKey(x.cccd) === key);
  if(!m) return {found:false, valid:false, code:'', label:'Chưa có hồ sơ hội viên', tone:'gray'};

  const today = new Date(); today.setHours(0,0,0,0);
  const expiry = m.expiry ? new Date(m.expiry) : null;
  const hasExpiry = expiry && !isNaN(expiry.getTime());
  const expired = hasExpiry && expiry < today;
  const valid = m.status === 'active' && !expired;

  let label;
  if(valid) label = hasExpiry ? `Đang hiệu lực đến ${fmtDate(m.expiry)}` : 'Đang hiệu lực';
  else if(m.status === 'pending') label = 'Chờ thanh toán hội phí';
  else label = hasExpiry ? `Hết hạn ${fmtDate(m.expiry)}` : 'Hết hạn';

  return {found:true, valid, code:m.code||'', label, tone: valid ? 'green' : 'gold', member:m};
}

let toastTimer=null;
function showToast(msg, isError){
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  const icon = t.querySelector('i');
  icon.className = isError ? 'ti ti-alert-circle' : 'ti ti-circle-check';
  icon.style.color = isError ? 'var(--danger)' : 'var(--tag-green)';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}

