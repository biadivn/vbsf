'use strict';
/* Xoá dữ liệu mẫu đã nạp bằng scripts/seed.js ra khỏi Strapi.

   Vì sao cần: seed.js chỉ nạp khi collection đang rỗng, nhưng một khi đã nạp
   thì các bản tin / giải đấu / đối tác mẫu nằm lại trong CSDL và site hiển thị
   chúng y như nội dung thật. Sửa code chỉ làm trang TRỐNG khi CSDL trống —
   muốn trang trống thì phải xoá bản ghi.

   Mặc định CHỈ IN RA sẽ xoá gì, không xoá. Thêm --yes mới xoá thật:

     node scripts/clear-demo-content.js            # xem trước
     node scripts/clear-demo-content.js --yes      # xoá nội dung website
     node scripts/clear-demo-content.js --yes --include-members

   Hội viên và hội viên tổ chức KHÔNG nằm trong nhóm mặc định: sau khi mở cho
   người dùng đăng ký, hai bảng đó lẫn cả hồ sơ thật lẫn hồ sơ mẫu, xoá cả bảng
   là mất dữ liệu thật. Muốn xoá thì nói rõ bằng --include-members, và nên xoá
   từng hồ sơ trong CMS nếu đã có người đăng ký.

   Đơn từ site gửi lên (đăng ký thi đấu, VĐV thuộc đội, báo chuyển khoản, liên
   hệ) không do seed.js tạo nên script này không đụng tới. */
const { compileStrapi, createStrapi } = require('@strapi/strapi');

/* Đúng các collection mà seed.js nạp dữ liệu mẫu — không thêm bảng nào khác,
   để script không bao giờ xoá quá tay. */
const WEBSITE_CONTENT = [
  ['api::news-article.news-article', 'Tin tức'],
  ['api::tournament.tournament', 'Giải đấu'],
  ['api::partner.partner', 'Đối tác & Tài trợ'],
  ['api::library-doc.library-doc', 'Văn bản & Luật'],
  ['api::media-item.media-item', 'Thư viện Media'],
  ['api::leader.leader', 'Ban lãnh đạo'],
];

const MEMBERS = [
  ['api::member.member', 'Hội viên & Xếp hạng'],
  ['api::member-org.member-org', 'Hội viên tổ chức'],
];

async function clearCollection(instance, uid, label, apply) {
  const count = await instance.documents(uid).count();
  if (!count) {
    console.log(`BỎ QUA  ${label}: đã rỗng`);
    return 0;
  }
  if (!apply) {
    console.log(`SẼ XOÁ  ${label}: ${count} bản ghi`);
    return count;
  }
  /* Xoá theo từng trang thay vì tải hết về: bảng Hội viên có thể rất dài, và
     mỗi vòng lặp lại đọc trang đầu nên không cần lần theo offset. */
  let removed = 0;
  for (;;) {
    const page = await instance.documents(uid).findMany({ fields: ['id'], limit: 100 });
    if (!page.length) break;
    for (const doc of page) {
      await instance.documents(uid).delete({ documentId: doc.documentId });
      removed += 1;
    }
  }
  console.log(`ĐÃ XOÁ  ${label}: ${removed} bản ghi`);
  return removed;
}

(async () => {
  const apply = process.argv.includes('--yes');
  const withMembers = process.argv.includes('--include-members');
  const targets = WEBSITE_CONTENT.concat(withMembers ? MEMBERS : []);

  const app = await compileStrapi();
  const instance = await createStrapi(app).load();
  try {
    let total = 0;
    for (const [uid, label] of targets) {
      total += await clearCollection(instance, uid, label, apply);
    }
    if (!withMembers) {
      console.log('\n(Hội viên & Hội viên tổ chức được giữ nguyên — thêm --include-members nếu muốn xoá.)');
    }
    if (!apply) {
      console.log(`\nXEM TRƯỚC — tổng cộng ${total} bản ghi. Chạy lại với --yes để xoá thật.`);
    } else {
      console.log(`\nHOÀN TẤT — đã xoá ${total} bản ghi.`);
    }
  } catch (err) {
    console.error('CLEAR FAILED:', err);
    process.exitCode = 1;
  } finally {
    await instance.destroy();
  }
})();
