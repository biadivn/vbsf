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

