'use strict';
/* =========================================================
   NỘI DUNG WEBSITE — trích từ prototype tĩnh `VBSF Web.html`
   (bản demo public site: trang chủ, giới thiệu, tin tức, giải đấu,
   ranking, thư viện, hội viên, đối tác, liên hệ).

   Module thuần dữ liệu, không phụ thuộc Strapi — dùng bởi
   scripts/migrate-website-content.js. Tách riêng để có thể diff/đối
   chiếu với prototype khi nội dung tĩnh thay đổi.

   Quy ước:
   - Chỗ nào prototype có sẵn giá trị thì lấy nguyên văn.
   - Chỗ nào prototype chỉ là placeholder (mã hội viên, SĐT, CCCD của
     các cơ thủ chỉ xuất hiện trong bảng xếp hạng; tên nhà tài trợ chỉ
     là ô logo trống) thì sinh giá trị deterministic và được đánh dấu
     bằng comment GENERATED — đổi lại trong CMS khi có dữ liệu thật.
   ========================================================= */

/** '12/06/2026' -> '2026-06-12' (Strapi date field). '' / '—' -> null. */
function d(dmy) {
  if (!dmy || dmy === '—') return null;
  const [dd, mm, yyyy] = dmy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

/* ---------------------------------------------------------
   1. Single types — Thông tin tổ chức & Liên hệ
   Nguồn: trang Giới thiệu, trang Liên hệ, footer, block hero trang chủ,
   khối hội phí + VietQR ở trang Hội viên.
   --------------------------------------------------------- */
const settings = {
  orgName: 'Liên đoàn Billiards & Snooker Việt Nam',
  orgShort: 'VBSF',
  foundedYear: '200x',
  memberCount: '1.500+',
  clubCount: '120+',
  provinceCount: '30+',
  about:
    'Liên đoàn Billiards & Snooker Việt Nam (VBSF) là tổ chức xã hội – nghề nghiệp đại diện cho phong trào billiards & snooker trên cả nước. Liên đoàn giữ vai trò quản lý chuyên môn, tổ chức hệ thống thi đấu quốc gia, phát triển vận động viên và kết nối với các tổ chức billiards quốc tế.',
  heroTitle: 'Giải Vô địch Billiards & Snooker Quốc gia 2026',
  heroSubtitle: 'Khởi tranh 12/06 · Nhà thi đấu Phú Thọ, TP.HCM',
  feeFirstTime: '200.000đ',
  feeAnnualFull: '500.000đ',
  feeAnnualHalf: '250.000đ',
  feeRenewal: '500.000đ',
  bankName: 'Vietcombank',
  bankAccount: '00xx xxx xxx',
  bankHolder: 'LĐ Billiards & Snooker VN',
};

const contact = {
  address: 'Số ..., Quận ..., Hà Nội, Việt Nam',
  email: 'info@billiards.org.vn',
  phone: '024 xxxx xxxx',
  hours: 'Thứ 2 – Thứ 6 · 08:00 – 17:00',
  facebook: '',
  youtube: '',
  tiktok: '',
};

/* ---------------------------------------------------------
   2. Tin tức — trang Tin tức (1 bài nổi bật + 6 bài lưới),
   sidebar "Tin nổi bật" trang chủ và block "Tin xem nhiều".
   --------------------------------------------------------- */
const FEATURED_CONTENT = `<p>Liên đoàn Billiards &amp; Snooker Việt Nam (VBSF) vừa chính thức công bố hệ thống thi đấu quốc gia năm 2026, với cấu trúc giải đấu xuyên suốt và cơ chế tích điểm xếp hạng áp dụng cho tất cả các nội dung.</p>
<p>Theo công bố, hệ thống năm 2026 được tổ chức theo ba cấp độ: giải vô địch quốc gia, các cúp khu vực, và hệ thống giải tích điểm tại các câu lạc bộ thành viên. Mục tiêu là tạo ra một lộ trình thi đấu liên tục cho cơ thủ ở mọi trình độ.</p>
<h3>Cấu trúc giải đấu</h3>
<p>Hệ thống được thiết kế thành các nhóm giải chính, phối hợp với nhau để bảo đảm cơ thủ có cơ hội thi đấu thường xuyên:</p>
<ul>
<li><strong>Giải Vô địch Quốc gia</strong> — tổ chức riêng cho từng nội dung pool, carom và snooker.</li>
<li><strong>Cúp khu vực</strong> — vòng loại theo ba miền Bắc, Trung, Nam.</li>
<li><strong>Giải tích điểm câu lạc bộ</strong> — diễn ra thường xuyên tại các CLB thành viên.</li>
</ul>
<h3>Tích điểm xếp hạng</h3>
<p>Tất cả kết quả thi đấu trong hệ thống sẽ được ghi nhận và quy đổi thành điểm xếp hạng quốc gia, công bố công khai trên cổng thông tin của Liên đoàn. Bảng xếp hạng được cập nhật theo từng nội dung, bảo đảm tính minh bạch và khách quan.</p>
<blockquote>"Hệ thống xếp hạng minh bạch là nền tảng để phát triển bền vững phong trào billiards các cấp."</blockquote>
<p>Lịch thi đấu chi tiết và thể lệ từng giải sẽ được Liên đoàn công bố trong thời gian tới trên chuyên mục Giải đấu.</p>
<p><em>#Hệ thống thi đấu #Xếp hạng #Mùa giải 2026</em></p>`;

const news = [
  {
    title: 'VBSF công bố hệ thống thi đấu quốc gia năm 2026',
    category: 'Hoạt động VBSF',
    date: d('02/06/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: true,
    excerpt:
      'Hệ thống giải đấu năm 2026 gồm các giải vô địch quốc gia, cúp khu vực và hệ thống tích điểm xếp hạng áp dụng cho tất cả nội dung pool, carom và snooker.',
    content: FEATURED_CONTENT,
  },
  {
    title: 'Khởi tranh vòng loại khu vực phía Nam',
    category: 'Giải đấu',
    date: d('02/06/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: false,
    excerpt: 'Hơn 120 cơ thủ tranh tài tại vòng loại khu vực.',
    content:
      '<p>Hơn 120 cơ thủ tranh tài tại vòng loại khu vực phía Nam — chặng mở màn cho hệ thống giải quốc gia mùa 2026.</p>',
  },
  {
    title: 'Khung chuẩn trọng tài cấp quốc gia',
    category: 'Đào tạo',
    date: d('28/05/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: false,
    excerpt: 'Chương trình đào tạo và cấp chứng nhận trọng tài.',
    content:
      '<p>VBSF công bố khung chuẩn trọng tài cấp quốc gia, kèm chương trình đào tạo và cấp chứng nhận cho đội ngũ trọng tài các cấp.</p>',
  },
  {
    title: 'Cơ thủ Việt Nam giành vé dự giải châu Á',
    category: 'Quốc tế',
    date: d('20/05/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: false,
    excerpt: 'Thành tích ấn tượng tại vòng loại Đông Nam Á.',
    content:
      '<p>Các cơ thủ Việt Nam giành vé dự giải vô địch châu Á sau thành tích ấn tượng tại vòng loại Đông Nam Á.</p>',
  },
  {
    title: 'Lịch thi đấu hệ thống quốc gia quý III/2026',
    category: 'Hoạt động VBSF',
    date: d('15/05/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: false,
    excerpt: 'Lịch thi đấu hệ thống giải quốc gia quý III/2026.',
    content:
      '<p>Liên đoàn công bố lịch thi đấu hệ thống giải quốc gia quý III/2026 cho tất cả các nội dung pool, carom và snooker.</p>',
  },
  {
    title: 'Giải Carom 3 băng các CLB toàn quốc khởi động',
    category: 'Trong nước',
    date: d('16/05/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: false,
    excerpt: 'Mùa giải mới quy tụ các CLB mạnh cả nước.',
    content: '<p>Mùa giải Carom 3 băng các CLB toàn quốc khởi động, quy tụ các CLB mạnh trên cả nước.</p>',
  },
  {
    title: 'Ký kết hợp tác phát triển hệ thống xếp hạng',
    category: 'Hoạt động VBSF',
    date: d('10/05/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: false,
    excerpt: 'Hướng tới chuẩn hóa dữ liệu và minh bạch xếp hạng.',
    content:
      '<p>Lễ ký kết hợp tác phát triển hệ thống xếp hạng, hướng tới chuẩn hóa dữ liệu và minh bạch xếp hạng quốc gia.</p>',
  },
  {
    title: 'Tổng kết mùa giải Pool 2025',
    category: 'Giải đấu',
    date: d('28/04/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: false,
    excerpt: 'Nhìn lại những dấu ấn của mùa giải vừa qua.',
    content: '<p>Nhìn lại những dấu ấn của mùa giải Pool 2025 — các giải đấu, gương mặt và kỷ lục đáng nhớ.</p>',
  },
  // GENERATED: 2 mục trong block "Tin xem nhiều" của prototype không kèm ngày
  // đăng — ngày dưới đây là giả định để bài hiển thị đúng thứ tự thời gian.
  {
    title: 'Cập nhật bảng xếp hạng tháng 5',
    category: 'Hoạt động VBSF',
    date: d('05/05/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: false,
    excerpt: 'Bảng xếp hạng quốc gia kỳ tháng 5/2026 đã được cập nhật.',
    content: '<p>Bảng xếp hạng quốc gia kỳ tháng 5/2026 đã được cập nhật cho tất cả các nội dung thi đấu.</p>',
  },
  {
    title: 'Thể lệ đăng ký hội viên 2026',
    category: 'Hoạt động VBSF',
    date: d('20/01/2026'),
    author: 'Ban Truyền thông VBSF',
    featured: false,
    excerpt: 'Hướng dẫn thủ tục, hội phí và quyền lợi hội viên VBSF năm 2026.',
    content:
      '<p>Hướng dẫn thủ tục đăng ký, mức hội phí và quyền lợi dành cho hội viên cá nhân, hội viên tổ chức của VBSF năm 2026.</p>',
  },
].map((n) => ({ ...n, metaTitle: n.title, metaDescription: n.excerpt }));

/* ---------------------------------------------------------
   3. Thư viện — Văn bản & Luật + Media. Nguồn: trang Thư viện.
   --------------------------------------------------------- */
const libraryDocs = [
  { title: 'Quy chế hệ thống thi đấu quốc gia 2026', fileType: 'PDF', tag: 'Quy chế', size: '1,2 MB', date: d('12/05/2026') },
  { title: 'Luật thi đấu Pool (8 / 9 / 10 bi)', fileType: 'PDF', tag: 'Luật', size: '2,4 MB', date: d('01/03/2026') },
  { title: 'Luật thi đấu Carom (1 băng & 3 băng)', fileType: 'PDF', tag: 'Luật', size: '1,8 MB', date: d('01/03/2026') },
  { title: 'Luật thi đấu Snooker', fileType: 'PDF', tag: 'Luật', size: '2,1 MB', date: d('01/03/2026') },
  { title: 'Đơn đăng ký hội viên (biểu mẫu)', fileType: 'DOCX', tag: 'Biểu mẫu', size: '240 KB', date: d('10/01/2026') },
  { title: 'Thông báo lịch thi đấu quý III/2026', fileType: 'PDF', tag: 'Thông báo', size: '560 KB', date: d('20/05/2026') },
];

// Prototype không hiển thị ngày cho các album/video -> để trống (null).
const mediaItems = [
  { title: 'Giải VĐQG Pool 2025', mediaType: 'photo', count: 48, date: null },
  { title: 'Lễ ký kết hợp tác', mediaType: 'photo', count: 12, date: null },
  { title: 'Chung kết Carom 3 băng 2025', mediaType: 'video', count: 1, date: null },
  { title: 'Hướng dẫn luật Snooker', mediaType: 'video', count: 1, date: null },
];

/* ---------------------------------------------------------
   4. Đối tác & Nhà tài trợ — trang Đối tác.
   Prototype chỉ đặt tên cho 2 đối tác chiến lược; các hạng còn lại là ô
   logo trống (3 Kim cương / 4 Vàng / 6 Đồng hành) -> sinh tên placeholder
   đúng số lượng để bố cục trang giữ nguyên.
   --------------------------------------------------------- */
const partners = [
  { name: 'Tên đối tác 1', tier: 'Đối tác chiến lược', description: '<p>Đối tác công nghệ & hệ thống xếp hạng</p>' },
  { name: 'Tên đối tác 2', tier: 'Đối tác chiến lược', description: '<p>Đối tác hệ thống câu lạc bộ</p>' },
  // GENERATED: placeholder cho các ô logo trống trong prototype.
  ...Array.from({ length: 3 }, (_, i) => ({
    name: `Nhà tài trợ Kim cương ${i + 1}`,
    tier: 'Nhà tài trợ Kim cương',
    description: '',
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    name: `Nhà tài trợ Vàng ${i + 1}`,
    tier: 'Nhà tài trợ Vàng',
    description: '',
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    name: `Đối tác đồng hành ${i + 1}`,
    tier: 'Đối tác đồng hành',
    description: '',
  })),
];

/* ---------------------------------------------------------
   5. Hội viên tổ chức — ORG_DB trong script của prototype
   (khớp bảng "Hội viên tổ chức" ở trang Danh sách hội viên).
   --------------------------------------------------------- */
const memberOrgs = [
  {
    code: 'VBSF-TC-2019-001', name: 'CLB Sài Gòn', orgType: 'Câu lạc bộ', taxCode: '',
    province: 'TP.HCM', address: 'Quận 1, TP.HCM',
    repName: 'Nguyễn Văn Hòa', repTitle: 'Chủ nhiệm CLB', repPhone: '0901112233', repEmail: 'clbsaigon@vbsf.org.vn',
    phone: '0901112233', password: '123456', package: 'Gói Tiêu chuẩn',
    joinDate: '2019-01-01', expiry: d('31/12/2026'), status: 'active',
  },
  {
    code: 'VBSF-TC-2020-002', name: 'CLB Thủ Đô', orgType: 'Câu lạc bộ', taxCode: '',
    province: 'Hà Nội', address: 'Cầu Giấy, Hà Nội',
    repName: 'Trần Thị Mai', repTitle: 'Chủ nhiệm CLB', repPhone: '0912223344', repEmail: 'clbthudo@vbsf.org.vn',
    phone: '0912223344', password: '123456', package: 'Gói Tiêu chuẩn',
    joinDate: '2020-01-01', expiry: d('30/11/2026'), status: 'active',
  },
  {
    code: 'VBSF-TC-2021-003', name: 'CLB Sông Hàn', orgType: 'Câu lạc bộ', taxCode: '',
    province: 'Đà Nẵng', address: 'Hải Châu, Đà Nẵng',
    repName: 'Lê Văn Đức', repTitle: 'Chủ nhiệm CLB', repPhone: '0923334455', repEmail: 'clbsonghan@vbsf.org.vn',
    phone: '0923334455', password: '123456', package: 'Gói Cơ bản',
    joinDate: '2021-01-01', expiry: d('15/10/2026'), status: 'active',
  },
  {
    code: 'VBSF-TC-2022-004', name: 'Meow Billiards', orgType: 'Doanh nghiệp', taxCode: '',
    province: 'Bình Dương', address: 'Thủ Dầu Một, Bình Dương',
    repName: 'Phạm Anh Tuấn', repTitle: 'Giám đốc', repPhone: '0934445566', repEmail: 'meowbilliards@vbsf.org.vn',
    phone: '0934445566', password: '123456', package: 'Gói Nâng cao',
    joinDate: '2022-01-01', expiry: null, status: 'pending',
  },
  {
    code: 'VBSF-TC-2023-005', name: 'CLB Cảng', orgType: 'Câu lạc bộ', taxCode: '',
    province: 'Hải Phòng', address: 'Hồng Bàng, Hải Phòng',
    repName: 'Đỗ Thành Long', repTitle: 'Chủ nhiệm CLB', repPhone: '0945556677', repEmail: 'clbcang@vbsf.org.vn',
    phone: '0945556677', password: '123456', package: 'Gói Cơ bản',
    joinDate: '2023-01-01', expiry: d('31/12/2025'), status: 'expired',
  },
];

/* ---------------------------------------------------------
   6. Hội viên cá nhân & xếp hạng
   Nguồn: MEMBER_DB trong script prototype (5 hồ sơ đầy đủ, dùng để đăng
   nhập demo) + bảng xếp hạng quốc gia trang Ranking (carousel Top 3 của
   9 cặp nhóm/bộ môn + bảng hạng 4–12 nội dung Pool nam).
   Prototype gọi tab nam là "Pool" — map về enum "Pool 9 bi" của schema.
   --------------------------------------------------------- */

// [group, category, rank, name, province, points, matches, trend, trendValue]
// matches = 0 nghĩa là prototype không công bố số trận cho bộ môn đó.
const RANKING_ROWS = [
  ['Nam', 'Pool 9 bi', 1, 'Nguyễn Phúc Long', 'TP.HCM', 2485, 45, 'up', 1],
  ['Nam', 'Pool 9 bi', 2, 'Trần Quốc Bảo', 'Hà Nội', 2410, 44, 'down', 1],
  ['Nam', 'Pool 9 bi', 3, 'Lê Minh Khôi', 'Đà Nẵng', 2388, 43, 'eq', 0],
  ['Nam', 'Pool 9 bi', 4, 'Phạm Anh Tú', 'Bình Dương', 2301, 42, 'up', 2],
  ['Nam', 'Pool 9 bi', 5, 'Đỗ Thành Nam', 'Hải Phòng', 2256, 38, 'down', 1],
  ['Nam', 'Pool 9 bi', 6, 'Vũ Hoàng Sơn', 'Hà Nội', 2198, 40, 'up', 1],
  ['Nam', 'Pool 9 bi', 7, 'Ngô Gia Huy', 'Cần Thơ', 2154, 35, 'eq', 0],
  ['Nam', 'Pool 9 bi', 8, 'Bùi Đức Anh', 'TP.HCM', 2097, 33, 'up', 3],
  ['Nam', 'Pool 9 bi', 9, 'Lý Trường Giang', 'Đà Nẵng', 2041, 31, 'down', 2],
  ['Nam', 'Pool 9 bi', 10, 'Hoàng Minh Quân', 'Nghệ An', 1988, 29, 'up', 1],
  ['Nam', 'Pool 9 bi', 11, 'Đặng Văn Hậu', 'Bình Định', 1945, 28, 'eq', 0],
  ['Nam', 'Pool 9 bi', 12, 'Trịnh Bá Phước', 'Hà Nội', 1902, 27, 'down', 1],

  ['Nam', 'Carom 1 băng', 1, 'Đặng Văn Hậu', 'Bình Định', 2150, 0, 'eq', 0],
  ['Nam', 'Carom 1 băng', 2, 'Trịnh Bá Phước', 'Hà Nội', 2088, 0, 'eq', 0],
  ['Nam', 'Carom 1 băng', 3, 'Ngô Gia Huy', 'Cần Thơ', 2041, 0, 'eq', 0],

  ['Nam', 'Carom 3 băng', 1, 'Trần Quốc Bảo', 'Hà Nội', 2290, 0, 'eq', 0],
  ['Nam', 'Carom 3 băng', 2, 'Bùi Đức Anh', 'TP.HCM', 2204, 0, 'eq', 0],
  ['Nam', 'Carom 3 băng', 3, 'Lý Trường Giang', 'Đà Nẵng', 2132, 0, 'eq', 0],

  ['Nam', 'Snooker', 1, 'Lê Minh Khôi', 'Đà Nẵng', 2075, 0, 'eq', 0],
  ['Nam', 'Snooker', 2, 'Đỗ Thành Nam', 'Hải Phòng', 1988, 0, 'eq', 0],
  ['Nam', 'Snooker', 3, 'Vũ Hoàng Sơn', 'Hà Nội', 1902, 0, 'eq', 0],

  ['Nam', 'English Billiards', 1, 'Hoàng Minh Quân', 'Nghệ An', 1820, 0, 'eq', 0],
  ['Nam', 'English Billiards', 2, 'Ngô Gia Huy', 'Cần Thơ', 1755, 0, 'eq', 0],
  ['Nam', 'English Billiards', 3, 'Bùi Đức Anh', 'TP.HCM', 1690, 0, 'eq', 0],

  ['Nữ', 'Pool 9 bi', 1, 'Đinh Thị Lan', 'Hà Nội', 1640, 0, 'eq', 0],
  ['Nữ', 'Pool 9 bi', 2, 'Phạm Thu Trang', 'TP.HCM', 1588, 0, 'eq', 0],
  ['Nữ', 'Pool 9 bi', 3, 'Ngô Hải Yến', 'Đà Nẵng', 1512, 0, 'eq', 0],

  ['Nữ', 'Carom 3 băng', 1, 'Vũ Thị Hòa', 'TP.HCM', 1470, 0, 'eq', 0],
  ['Nữ', 'Carom 3 băng', 2, 'Đinh Thị Lan', 'Hà Nội', 1402, 0, 'eq', 0],
  ['Nữ', 'Carom 3 băng', 3, 'Lâm Bảo Ngọc', 'Đà Nẵng', 1355, 0, 'eq', 0],

  ['VĐV trẻ', 'Pool 9 bi', 1, 'Trịnh Xuân Sơn', 'TP.HCM', 1380, 0, 'eq', 0],
  ['VĐV trẻ', 'Pool 9 bi', 2, 'Phan Đức Thịnh', 'Hà Nội', 1320, 0, 'eq', 0],
  ['VĐV trẻ', 'Pool 9 bi', 3, 'Đoàn Minh Tuấn', 'Đà Nẵng', 1265, 0, 'eq', 0],

  ['VĐV trẻ', 'Carom 3 băng', 1, 'Vương Quốc Huy', 'TP.HCM', 1298, 0, 'eq', 0],
  ['VĐV trẻ', 'Carom 3 băng', 2, 'Dương Anh Kiệt', 'Hà Nội', 1240, 0, 'eq', 0],
  ['VĐV trẻ', 'Carom 3 băng', 3, 'Lý Gia Bảo', 'Đà Nẵng', 1187, 0, 'eq', 0],
];

// Hồ sơ đầy đủ có sẵn trong prototype (MEMBER_DB) — dùng cho đăng nhập demo.
const KNOWN_MEMBER_PROFILES = {
  'Nguyễn Phúc Long': { code: 'VBSF-2026-00098', phone: '0901234567', cccd: '079095001234', club: 'CLB Sài Gòn', province: 'TP.HCM', status: 'active', expiry: d('31/12/2026') },
  'Trần Quốc Bảo': { code: 'VBSF-2026-00071', phone: '0912345678', cccd: '001094005678', club: 'CLB Thủ Đô', province: 'Hà Nội', status: 'active', expiry: d('30/11/2026') },
  'Lê Minh Khôi': { code: 'VBSF-2026-00112', phone: '0923456789', cccd: '048096009012', club: 'CLB Sông Hàn', province: 'Đà Nẵng', status: 'active', expiry: d('15/10/2026') },
  'Phạm Anh Tú': { code: 'VBSF-2026-00123', phone: '0934567890', cccd: '074097003456', club: 'Meow Billiards', province: 'Bình Dương', status: 'pending', expiry: null },
  'Đỗ Thành Nam': { code: 'VBSF-2025-00410', phone: '0945678901', cccd: '031093007890', club: 'CLB Cảng', province: 'Hải Phòng', status: 'expired', expiry: d('31/12/2025') },
};

/** Gom RANKING_ROWS thành danh sách hội viên, mỗi người 1..n disciplines. */
function buildMembers() {
  const byName = new Map();
  for (const [group, category, rank, name, province, points, matches, trend, trendValue] of RANKING_ROWS) {
    if (!byName.has(name)) byName.set(name, { name, group, province, disciplines: [] });
    const m = byName.get(name);
    m.disciplines.push({ category, points, rank, matches, trend, trendValue });
  }

  let generated = 0;
  return [...byName.values()].map((m) => {
    const known = KNOWN_MEMBER_PROFILES[m.name];
    // GENERATED: prototype chỉ hiện tên/đơn vị/điểm cho các cơ thủ ngoài
    // MEMBER_DB — mã hội viên, SĐT, CCCD sinh deterministic để thoả ràng buộc
    // required/unique của schema. Thay bằng dữ liệu thật khi có.
    const seq = known ? null : ++generated;
    const profile = known || {
      code: `VBSF-2026-${String(200 + seq).padStart(5, '0')}`,
      phone: `0987${String(seq).padStart(6, '0')}`,
      cccd: String(900000000000 + seq),
      club: '',
      province: m.province,
      status: 'active',
      expiry: d('31/12/2026'),
    };
    // Bộ môn chính = bộ môn có điểm cao nhất (hiển thị ở cột "Nội dung" của CMS).
    const primary = m.disciplines.reduce((a, b) => (b.points > a.points ? b : a));
    return {
      code: profile.code,
      name: m.name,
      cccd: profile.cccd,
      phone: profile.phone,
      password: '123456', // prototype: mật khẩu demo dùng chung
      category: primary.category,
      group: m.group,
      club: profile.club,
      province: profile.province,
      status: profile.status,
      expiry: profile.expiry,
      disciplines: m.disciplines,
      freeMatches: [],
    };
  });
}

const members = buildMembers();

/* ---------------------------------------------------------
   7. Giải đấu — trang Giải đấu (đang diễn ra / sắp diễn ra / đã kết thúc),
   bảng giải thưởng + thể lệ ở trang Chi tiết giải đấu, và bảng tỷ số ở
   trang Kết quả trực tiếp.
   --------------------------------------------------------- */

// Bảng giải thưởng & thể lệ dùng chung cho mọi giải trong prototype
// (trang chi tiết giải đấu là một template chung).
const PRIZES = [
  { rank: '1', cash: '20.000.000đ', item: 'Cúp + Huy chương' },
  { rank: '2', cash: '10.000.000đ', item: 'Bằng khen + Huy chương' },
  { rank: '3', cash: '5.000.000đ', item: 'Bằng khen + Huy chương' },
  { rank: '4–5', cash: '2.000.000đ', item: 'Bằng khen' },
  { rank: '6–10', cash: '1.000.000đ', item: 'Giấy khen' },
  { rank: '11–20', cash: '—', item: 'Áo đấu VBSF' },
];

const RULES = [
  'Luật cơ bản',
  '· Thi đấu theo thể thức đấu loại trực tiếp, tính điểm theo luật hiện hành của từng nội dung (Pool / Carom / Snooker).',
  '· Mỗi trận đấu theo thể thức best-of, số ván do Ban tổ chức công bố trước ngày thi đấu.',
  '· Cơ thủ có mặt trễ quá 15 phút so với giờ thi đấu được công bố sẽ bị xử thua trận đó.',
  '',
  'Luật bổ sung',
  '· Trường hợp hoà điểm ở vòng bảng, thứ hạng được xét theo hiệu số bàn thắng rồi đến kết quả đối đầu trực tiếp.',
  '· Khiếu nại kết quả trận đấu phải gửi cho trọng tài chính trong vòng 15 phút sau khi trận đấu kết thúc.',
  '',
  'Điều kiện tham dự',
  '· Cơ thủ cần có mã hội viên VBSF còn hiệu lực tại thời điểm đăng ký.',
].join('\n');

/* --- Bracket đấu loại trực tiếp (SE) cho giải đang diễn ra ---------------
   Port rút gọn của tbkGenSE/tbkDecide trong cms-js/tournament-engine.js —
   giữ đúng shape JSON mà CMS đọc/ghi (matches/rounds/type/size/k) để bracket
   seed vào mở được ngay trong tab "Thi đấu" của tournament-editor.
   ------------------------------------------------------------------------ */
function bracketSeedOrder(size) {
  let s = [1, 2];
  while (s.length < size) {
    const n = s.length * 2;
    const nx = [];
    for (const x of s) { nx.push(x); nx.push(n + 1 - x); }
    s = nx;
  }
  return s;
}

function genSE(seedIds) {
  const size = seedIds.length;
  const seeds = bracketSeedOrder(size);
  const k = Math.log2(size);
  const M = {};
  const rounds = [];
  let id = 0;
  const r0 = [];
  for (let i = 0; i < size / 2; i++) {
    M[id] = { id, br: 'W', round: 0, idx: i, p1: seedIds[seeds[2 * i] - 1], p2: seedIds[seeds[2 * i + 1] - 1], win: null, s1: null, s2: null, status: 'ready', winTo: null, loseTo: null };
    r0.push(id); id++;
  }
  rounds.push(r0);
  for (let r = 1; r < k; r++) {
    const cur = [];
    for (let i = 0; i < size / 2 ** (r + 1); i++) {
      M[id] = { id, br: 'W', round: r, idx: i, p1: null, p2: null, win: null, s1: null, s2: null, status: 'wait', winTo: null, loseTo: null };
      cur.push(id); id++;
    }
    rounds[r - 1].forEach((mid, i) => { M[mid].winTo = [cur[Math.floor(i / 2)], (i % 2) + 1]; });
    rounds.push(cur);
  }
  return { matches: M, rounds, type: 'SE', size, k };
}

/** Ghi kết quả 1 trận và đẩy người thắng sang trận kế (như tbkDecide). */
function decide(M, mid, s1, s2) {
  const m = M[mid];
  m.s1 = s1; m.s2 = s2;
  m.win = s1 > s2 ? m.p1 : m.p2;
  m.status = 'done';
  if (m.winTo) {
    const next = M[m.winTo[0]];
    if (m.winTo[1] === 1) next.p1 = m.win; else next.p2 = m.win;
    if (next.p1 != null && next.p2 != null) next.status = 'ready';
  }
}

// Cặp đấu vòng 1/8 và tỷ số, đúng thứ tự hiển thị ở trang "Kết quả trực tiếp".
const LIVE_R16 = [
  ['Nguyễn Phúc Long', 'Dương Anh Kiệt', 4, 0],
  ['Đặng Văn Hậu', 'Phan Đức Thịnh', 4, 3],
  ['Trần Quốc Bảo', 'Đoàn Minh Tuấn', 4, 1],
  ['Bùi Đức Anh', 'Vương Quốc Huy', 4, 2],
  ['Lê Minh Khôi', 'Lý Gia Bảo', 4, 0],
  ['Ngô Gia Huy', 'Trịnh Xuân Sơn', 4, 3],
  ['Phạm Anh Tú', 'Đỗ Anh Dũng', 4, 1],
  ['Hoàng Minh Quân', 'Vũ Trọng Nghĩa', 4, 2],
];

function buildLiveBracket() {
  // Trận đầu thứ i của sơ đồ SE ghép hạt giống seedOrder[2i] với
  // seedOrder[2i+1]; xếp ngược lại để từng cặp rơi đúng vào thứ tự trên.
  const size = LIVE_R16.length * 2;
  const seedOrder = bracketSeedOrder(size);
  const names = new Array(size);
  LIVE_R16.forEach(([a, b], i) => {
    names[seedOrder[2 * i] - 1] = a;
    names[seedOrder[2 * i + 1] - 1] = b;
  });

  const players = names.map((name, i) => ({
    localId: `p${i + 1}`,
    name,
    club: (KNOWN_MEMBER_PROFILES[name] && KNOWN_MEMBER_PROFILES[name].club) || '',
    registeredAt: '2026-06-01T00:00:00.000Z',
    feeStatus: 'paid',
    seed: i + 1,
  }));

  const bracket = genSE(players.map((p) => p.localId));
  bracket.rounds[0].forEach((mid, i) => decide(bracket.matches, mid, LIVE_R16[i][2], LIVE_R16[i][3]));

  // Tứ kết: 2 trận đã xong, 1 trận đang diễn ra (2–1), 1 trận chưa bắt đầu.
  const qf = bracket.rounds[1];
  decide(bracket.matches, qf[0], 4, 2); // Nguyễn Phúc Long 4–2 Đặng Văn Hậu
  decide(bracket.matches, qf[2], 4, 1); // Lê Minh Khôi 4–1 Ngô Gia Huy
  bracket.matches[qf[1]].s1 = 2;        // Trần Quốc Bảo 2–1 Bùi Đức Anh (LIVE)
  bracket.matches[qf[1]].s2 = 1;

  return { players, bracket };
}

const live = buildLiveBracket();

const tournaments = [
  {
    name: 'Giải Vô địch Quốc gia Pool 2026',
    category: 'Pool 9 bi',
    format: 'SE',
    status: 'ongoing',
    mode: 'op',
    date: d('12/06/2026'),
    participants: 128,
    location: 'Nhà thi đấu Phú Thọ, TP.HCM',
    liveRound: 'Vòng tứ kết',
    note: 'Vòng tứ kết · Kết quả các trận đấu loại. Bracket lưu ở đây là vòng chung kết 16 cơ thủ.',
    entryFee: '300.000đ / cơ thủ',
    players: live.players,
    bracket: live.bracket,
  },
  {
    name: 'Cúp Carom 3 băng Hà Nội Mở rộng',
    category: 'Carom 3 băng',
    format: 'SE',
    status: 'upcoming',
    mode: 'op',
    date: d('28/06/2026'),
    participants: 64,
    location: 'CLB Meow Billiards, Hà Nội',
    note: 'Mở đăng ký',
    entryFee: '200.000đ / cơ thủ',
  },
  {
    name: 'Giải Snooker Toàn quốc 2026',
    category: 'Snooker',
    format: 'SE',
    status: 'upcoming',
    mode: 'op',
    date: d('15/07/2026'),
    participants: 48,
    location: 'Cung Thể thao Đà Nẵng',
    note: 'Mở đăng ký',
    entryFee: '250.000đ / cơ thủ',
  },
  {
    name: 'Giải các CLB mạnh toàn quốc',
    category: 'Pool 10 bi',
    format: 'SE',
    status: 'upcoming',
    mode: 'op',
    date: d('02/08/2026'),
    location: 'TP. Thủ Dầu Một, Bình Dương',
    note: 'Sắp mở đăng ký',
    entryFee: '200.000đ / cơ thủ',
  },
  {
    name: 'Giải Carom 3 băng Cúp Mùa Xuân 2026',
    category: 'Carom 3 băng',
    format: 'SE',
    status: 'completed',
    mode: 'op',
    date: d('18/04/2026'),
    champion: 'Trần Quốc Bảo',
    note: 'Á quân: Nguyễn Phúc Long · Hạng 3: Lê Minh Khôi',
    entryFee: '200.000đ / cơ thủ',
  },
  {
    name: 'Giải Pool 9 bi các tỉnh phía Bắc 2026',
    category: 'Pool 9 bi',
    format: 'SE',
    status: 'completed',
    mode: 'op',
    date: d('30/03/2026'),
    champion: 'Nguyễn Phúc Long',
    note: 'Á quân: Trần Quốc Bảo · Hạng 3: Phạm Anh Tú',
    entryFee: '200.000đ / cơ thủ',
  },
  {
    name: 'Giải Snooker Cúp CLB toàn quốc 2025',
    category: 'Snooker',
    format: 'SE',
    status: 'completed',
    mode: 'op',
    date: d('12/12/2025'),
    champion: 'Lê Minh Khôi',
    note: 'Á quân: Đỗ Thành Nam · Hạng 3: Vũ Hoàng Sơn',
    entryFee: '200.000đ / cơ thủ',
  },
].map((t) => ({
  ...t,
  prizes: PRIZES,
  rules: RULES,
  metaTitle: t.name,
  metaDescription: [t.category, t.location].filter(Boolean).join(' · '),
}));

module.exports = {
  settings,
  contact,
  news,
  libraryDocs,
  mediaItems,
  partners,
  memberOrgs,
  members,
  tournaments,
};
