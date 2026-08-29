/* =========================================================
   ĐỌC CẤU HÌNH KHỐI (SECTION) MÀ CMS LƯU TRONG `page-content`

   Hình dạng CMS ghi ra — xem cms-js/page-sections-registry.js
   (makeDefaultSectionEntry / normalizePageSections):

     { key, enabled, title, content:{...}, backgroundImage,
       newsIds | partnerIds | tournamentIds,
       pickerMode: 'manual' | 'auto', autoCount }

   Trước đây site đọc `entry.values` — một khoá CMS không bao giờ ghi — nên mọi
   thứ admin sửa trong "Trang website" đều không tới được trang thật, mà cũng
   không báo lỗi gì. Gom toàn bộ việc đọc cấu hình vào đây để hai bên không lệch
   nhau lần nữa, và để có unit test canh.
   ========================================================= */

/** Cấu hình của một khối trên một trang, hoặc null nếu admin chưa đụng tới. */
function sectionEntry(pageContent, pageId, key) {
  var all = pageContent && pageContent.data && pageContent.data.pageSections;
  var list = (all && all[pageId]) || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].key === key) return list[i];
  }
  return null;
}

/** Admin đã tắt khối này trong CMS. */
function sectionHidden(entry) {
  return !!entry && entry.enabled === false;
}

/**
 * Danh sách hiển thị của một khối có bộ chọn.
 *
 *   pickerMode 'manual' → đúng các bản ghi đã chọn, giữ nguyên thứ tự admin sắp.
 *   pickerMode 'auto'   → autoCount bản ghi đầu danh sách (đã sắp sẵn theo ngày).
 *   chưa cấu hình       → fallbackCount bản ghi đầu danh sách.
 *
 * Id đã chọn mà bản ghi bị xoá thì bỏ qua, không để lại ô trống. Chọn tay mà
 * chưa chọn gì thì vẫn hiện bản mới nhất — khối trống trên trang thật khó hiểu
 * hơn nhiều so với khối hiện tạm dữ liệu mới.
 */
function pickItems(entry, all, idKey, fallbackCount) {
  var list = all || [];
  if (entry && entry.pickerMode === 'manual') {
    var ids = entry[idKey] || [];
    var byId = {};
    list.forEach(function (x) { if (x && x.documentId) byId[x.documentId] = x; });
    var chosen = [];
    ids.forEach(function (id) { if (byId[id]) chosen.push(byId[id]); });
    if (chosen.length) return chosen;
  } else if (entry && typeof entry.autoCount === 'number' && entry.autoCount > 0) {
    return list.slice(0, entry.autoCount);
  }
  return list.slice(0, fallbackCount);
}

/** Bản ghi duy nhất của bộ chọn 1 (vd. giải đấu nổi bật ở banner trang chủ). */
function pickOne(entry, all, idKey) {
  var ids = (entry && entry[idKey]) || [];
  var list = all || [];
  for (var i = 0; i < ids.length; i++) {
    for (var j = 0; j < list.length; j++) {
      if (list[j] && list[j].documentId === ids[i]) return list[j];
    }
  }
  return null;
}

/**
 * Giá trị một ô cấu hình, ưu tiên thứ tự: admin nhập → giá trị suy từ dữ liệu
 * thật (vd. tên giải đã chọn) → chuỗi rỗng để bên gọi giữ nguyên chữ tĩnh.
 */
function contentValue(entry, key, derived) {
  var v = entry && entry.content && entry.content[key];
  if (v != null && String(v).trim() !== '') return String(v);
  return derived == null ? '' : String(derived);
}

if (typeof module === 'object' && module.exports) {
  module.exports = { sectionEntry, sectionHidden, pickItems, pickOne, contentValue };
}
