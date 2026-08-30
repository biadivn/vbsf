'use strict';
/* Gắn X-Robots-Tag cho mọi phản hồi dưới /uploads.

   API công khai không còn công bố đường dẫn /uploads của tài liệu, nhưng đường
   dẫn vẫn có thể lọt ra ngoài (ai đó dán link, hoặc ảnh trong bài viết vốn dùng
   thẳng /uploads). Header này nói với bộ máy tìm kiếm là đừng lập chỉ mục file
   dù bắt gặp bằng cách nào — và nó không phụ thuộc robots.txt, vốn đang do
   Cloudflare quản lý nên sửa trong repo không có tác dụng. */
module.exports = () => async (ctx, next) => {
  if (ctx.path.startsWith('/uploads/')) {
    ctx.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  await next();
};
