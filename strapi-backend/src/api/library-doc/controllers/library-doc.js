'use strict';
/* Site public đọc /api/library-docs ẩn danh để dựng danh sách "Văn bản & Luật".
   Không trả đường dẫn /uploads thật cho người đọc ẩn danh — xem lý do đầy đủ ở
   src/utils/library-doc-file.js. Request đã đăng nhập (CMS) vẫn nhận đủ media. */
const { createCoreController } = require('@strapi/strapi').factories;
const { publicDoc } = require('../../../utils/library-doc-file');

/* hasFile/downloadUrl suy ra từ quan hệ media, nên phải tự nạp quan hệ đó thay
   vì trông chờ người gọi nhớ truyền ?populate=file — quên một lần là cả trang
   Thư viện mất nút tải mà không có lỗi nào báo ra. */
function forceFilePopulate(ctx) {
  const q = ctx.query || (ctx.query = {});
  const p = q.populate;
  if (p === '*' ) return;
  if (Array.isArray(p)) { if (p.indexOf('file') < 0) p.push('file'); return; }
  if (p && typeof p === 'object') { p.file = true; return; }
  q.populate = p ? [String(p), 'file'] : ['file'];
}

module.exports = createCoreController('api::library-doc.library-doc', () => ({
  async find(ctx) {
    forceFilePopulate(ctx);
    const res = await super.find(ctx);
    if (!ctx.state.user && Array.isArray(res.data)) res.data.forEach(publicDoc);
    return res;
  },
  async findOne(ctx) {
    forceFilePopulate(ctx);
    const res = await super.findOne(ctx);
    if (!ctx.state.user) publicDoc(res.data);
    return res;
  },
}));
