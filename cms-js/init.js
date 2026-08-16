/* =========================================================
   INIT
   ========================================================= */
function closeActiveModal(){ addSectionModal ? closeAddSectionModal() : (pageModal ? closePageModal() : closeModal()); }
document.getElementById('modalClose').addEventListener('click', closeActiveModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeActiveModal);
document.getElementById('modalSaveBtn').addEventListener('click', ()=> addSectionModal ? saveAddSectionModal() : (pageModal ? savePageModal() : saveModal()));
document.getElementById('modalDeleteBtn').addEventListener('click', ()=>{ if(addSectionModal || pageModal) return; deleteModal(); });
document.getElementById('modalOverlay').addEventListener('click', (e)=>{ if(e.target.id==='modalOverlay') closeActiveModal(); });
document.getElementById('navtgl').addEventListener('click', ()=>document.getElementById('sidebar').classList.toggle('open'));
document.addEventListener('click', (e)=>{
  const sw = e.target.closest('.switch[data-toggle]');
  if(sw) sw.classList.toggle('on');
});

(async function init(){
  await loadDB();
  renderSidebar();
  renderTopbar();
  renderContent();
})();
