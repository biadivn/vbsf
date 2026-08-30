'use strict';
/* Trả tệp đính kèm của một tài liệu.

   Endpoint này là đường DUY NHẤT site công bố để tải tài liệu; đường dẫn
   /uploads thật không xuất hiện ở API công khai. Xem src/utils/library-doc-file.js. */
const fs = require('node:fs');
const path = require('node:path');
const {
  contentTypeFor, isAllowedExtension, safeFileName,
} = require('../../../utils/library-doc-file');

const UID = 'api::library-doc.library-doc';

module.exports = {
  async download(ctx) {
    const doc = await strapi.documents(UID).findOne({
      documentId: ctx.params.documentId,
      populate: ['file'],
    });
    // Cùng một thông báo cho "không có tài liệu" và "tài liệu chưa đính tệp":
    // không cần cho người gọi biết documentId nào có thật.
    if (!doc || !doc.file || !doc.file.url) return ctx.notFound('Không tìm thấy tệp.');

    const ext = String(doc.file.ext || path.extname(doc.file.url) || '').toLowerCase();
    if (!isAllowedExtension(ext)) return ctx.notFound('Không tìm thấy tệp.');

    /* Chỉ phục vụ tệp nằm trong thư mục uploads. doc.file.url do Strapi sinh ra,
       nhưng ghép đường dẫn từ dữ liệu thì luôn phải chốt lại phạm vi — bản ghi bị
       sửa tay trong CSDL không được biến endpoint này thành công cụ đọc file
       tuỳ ý trên máy chủ. */
    const uploadsDir = path.join(strapi.dirs.static.public, 'uploads');
    const abs = path.resolve(strapi.dirs.static.public, '.' + doc.file.url);
    if (path.relative(uploadsDir, abs).startsWith('..') || path.isAbsolute(path.relative(uploadsDir, abs))) {
      strapi.log.warn('[library-doc] đường dẫn tệp nằm ngoài uploads: ' + doc.file.url);
      return ctx.notFound('Không tìm thấy tệp.');
    }
    if (!fs.existsSync(abs)) return ctx.notFound('Không tìm thấy tệp.');

    const name = safeFileName(doc.file.name, (doc.title || 'tai-lieu') + ext);
    ctx.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    ctx.set('Content-Type', contentTypeFor(ext));
    // attachment: trình duyệt tải về thay vì mở inline, và bộ máy tìm kiếm
    // không coi đây là một trang để lập chỉ mục.
    ctx.set('Content-Disposition', 'attachment; filename="' + name + '"');
    ctx.set('Cache-Control', 'private, max-age=300');
    ctx.body = fs.createReadStream(abs);
  },
};
