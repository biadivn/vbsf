/* =========================================================
   INIT
   ========================================================= */
function closeActiveModal(){ i18nModal ? closeI18nModal() : (addSectionModal ? closeAddSectionModal() : (pageModal ? closePageModal() : (teMatchModal ? closeTeMatchModal() : closeModal()))); }
document.getElementById('modalClose').addEventListener('click', closeActiveModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeActiveModal);
document.getElementById('modalSaveBtn').addEventListener('click', ()=> i18nModal ? saveI18nModal() : (addSectionModal ? saveAddSectionModal() : (pageModal ? savePageModal() : (teMatchModal ? saveTeMatchModal() : saveModal()))));
document.getElementById('modalDeleteBtn').addEventListener('click', ()=>{ if(i18nModal || addSectionModal || pageModal || teMatchModal) return; deleteModal(); });
document.getElementById('modalOverlay').addEventListener('click', (e)=>{ if(e.target.id==='modalOverlay') closeActiveModal(); });
document.getElementById('navtgl').addEventListener('click', ()=>document.getElementById('sidebar').classList.toggle('open'));
document.addEventListener('click', (e)=>{
  const sw = e.target.closest('.switch[data-toggle]');
  if(sw) sw.classList.toggle('on');
});
