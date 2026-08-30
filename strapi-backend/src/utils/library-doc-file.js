'use strict';
/* Tệp đính kèm của "Văn bản & Luật".

   Tài liệu là nội dung công khai — ai vào site cũng phải tải được. Cái cần chặn
   là bot quét sạch thư mục tệp và công cụ tìm kiếm lập chỉ mục thẳng file PDF.
   Ba lớp, không lớp nào dựa vào robots.txt (robots.txt của hai tên miền đang do
   Cloudflare quản lý, sửa trong repo không có tác dụng):

     1. API công khai KHÔNG trả đường dẫn /uploads thật — chỉ trả downloadUrl trỏ
        vào endpoint của mình. Không có URL thì không có gì để bot lần theo.
     2. Endpoint tải đặt X-Robots-Tag: noindex, nofollow, noarchive và ép tải về
        (Content-Disposition: attachment) thay vì mở trong tab.
     3. Giới hạn tần suất theo IP để không hút được cả kho trong một lượt.

   Request đã đăng nhập (CMS) vẫn nhận đủ đối tượng media để hiện tên tệp đang
   đính kèm và cho thay tệp.
*/

const path = require('node:path');

/* Kiểu nội dung theo đuôi tệp. Danh sách đóng: đuôi lạ trả về octet-stream để
   trình duyệt tải xuống chứ không tự diễn giải (svg/html mà trả đúng kiểu thì
   thành trang chạy script trên chính tên miền này). */
const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

function contentTypeFor(ext) {
  return CONTENT_TYPES[String(ext || '').toLowerCase()] || DEFAULT_CONTENT_TYPE;
}

/** Đuôi tệp chấp nhận cho tài liệu — khớp enum fileType của content type. */
const ALLOWED_EXTENSIONS = Object.keys(CONTENT_TYPES);

function isAllowedExtension(ext) {
  return ALLOWED_EXTENSIONS.indexOf(String(ext || '').toLowerCase()) > -1;
}

/**
 * Tên tệp an toàn để đặt vào Content-Disposition.
 * Bỏ đường dẫn, dấu nháy và ký tự xuống dòng — nếu không thì tên tệp do người
 * tải lên đặt có thể chèn thêm header hoặc trỏ ra ngoài thư mục.
 */
function safeFileName(name, fallback) {
  var base = path.basename(String(name == null ? '' : name));
  base = base.replace(/[\r\n"\\]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return base || (fallback || 'tai-lieu');
}

/** Đường dẫn tải của một tài liệu — chỉ cần documentId, không lộ vị trí tệp. */
function downloadPath(documentId) {
  return '/api/library-docs/' + encodeURIComponent(String(documentId || '')) + '/download';
}

/**
 * Bản ghi trả cho người đọc ẩn danh: bỏ đối tượng media (chứa url, hash, tên tệp
 * gốc, các kích cỡ khác) và thay bằng đúng những gì trang cần để vẽ dòng tải về.
 */
function publicDoc(entry) {
  if (!entry) return entry;
  /* Đã dọn rồi thì thôi: lần gọi thứ hai sẽ không còn entry.file nên sẽ kết luận
     nhầm là "chưa đính tệp" trong khi downloadUrl vẫn nằm đó. */
  if (Object.prototype.hasOwnProperty.call(entry, 'hasFile')) return entry;
  var file = entry.file;
  delete entry.file;
  if (file && file.url) {
    entry.hasFile = true;
    entry.downloadUrl = downloadPath(entry.documentId);
    // Dung lượng do Strapi tính (KB) — dùng khi admin bỏ trống ô "Dung lượng".
    if (file.size != null) entry.fileSizeKb = file.size;
  } else {
    entry.hasFile = false;
  }
  return entry;
}

module.exports = {
  CONTENT_TYPES,
  DEFAULT_CONTENT_TYPE,
  ALLOWED_EXTENSIONS,
  contentTypeFor,
  isAllowedExtension,
  safeFileName,
  downloadPath,
  publicDoc,
};
