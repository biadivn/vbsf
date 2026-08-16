/* =========================================================
   EXPORT / IMPORT
   ========================================================= */
function exportData(){
  const blob = new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vbsf-cms-data.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất file JSON');
}
function importData(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (ev)=>{
    try{
      const parsed = JSON.parse(ev.target.result);
      DB = parsed;
      await saveDB();
      renderSidebar(); renderTopbar(); renderContent();
      showToast('Đã nhập dữ liệu thành công');
    }catch(err){
      showToast('File JSON không hợp lệ', true);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

