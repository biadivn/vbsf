/* =========================================================
   SONG NGỮ VIỆT – ANH CHO SITE PUBLIC

   Hai loại chữ trên trang, xử lý theo hai đường khác nhau:

   1. CHỮ GIAO DIỆN nằm cứng trong index.html / pages/*.html (nhãn nút, tiêu đề
      cột, dòng hướng dẫn...). Không gắn data-i18n vào từng thẻ — 17 file HTML,
      gắn tay là sai sót và mỗi lần sửa chữ lại phải nhớ sửa khoá. Thay vào đó
      tra TỪ ĐIỂN theo đúng chuỗi tiếng Việt đang hiển thị: có trong từ điển thì
      thay, không có thì GIỮ NGUYÊN. Nhờ vậy tên riêng, mã hội viên, tên tỉnh,
      số liệu... tự động đi qua mà không cần khai báo gì.

      Đổi chữ tiếng Việt trong HTML mà quên sửa từ điển thì hậu quả là chỗ đó
      không dịch nữa — chứ không vỡ trang.

   2. NỘI DUNG DO CMS NHẬP (tin tức, giải đấu, đối tác, cấu hình trang...).
      Mỗi bản ghi có cột `i18n` dạng { "en": { "<field>": "..." } }. Khi đang
      xem tiếng Anh thì PHỦ các field đó lên bản ghi trước khi render, nên toàn
      bộ phần render bên dưới không cần biết gì về ngôn ngữ. Field nào bỏ trống
      thì giữ bản tiếng Việt — trang luôn có chữ, không bao giờ hiện ô rỗng vì
      thiếu bản dịch.

   File này cố ý THUẦN LOGIC (không đụng DOM) để có unit test; phần gắn vào
   trang nằm ở site-js/strapi-content.js và index.html.
   ========================================================= */

var VBSF_LANGS = ['vi', 'en'];
var VBSF_DEFAULT_LANG = 'vi';

/** Chuẩn hoá giá trị ngôn ngữ từ URL / localStorage về đúng 'vi' hoặc 'en'. */
function normalizeLang(value) {
  var v = String(value == null ? '' : value).trim().toLowerCase();
  // Chấp nhận cả 'en-US', 'vi-VN' để dùng được với navigator.language.
  if (v.indexOf('-') > -1) v = v.split('-')[0];
  return VBSF_LANGS.indexOf(v) > -1 ? v : VBSF_DEFAULT_LANG;
}

/* ---------- 1. Từ điển chữ giao diện ----------

   Khoá là ĐÚNG chuỗi tiếng Việt trong HTML, đã cắt khoảng trắng hai đầu. Chỉ
   khai những chuỗi là CHỮ GIAO DIỆN; dữ liệu (tên người, tên tỉnh, mã số, ngày
   tháng, số tiền) cố tình không khai để đi thẳng qua. */
var VBSF_DICT_EN = {
  // Thẻ <title> và mô tả trang (đặt lại khi xem tiếng Anh)
  'Liên đoàn Billiards & Snooker Việt Nam (VBSF) — thông tin giải đấu, hội viên, xếp hạng vận động viên, văn bản và hoạt động của Liên đoàn.':
    'Vietnam Billiards & Snooker Federation (VBSF) — tournaments, membership, player rankings, documents and federation news.',
  'Thông tin giải đấu, hội viên, xếp hạng vận động viên và hoạt động của Liên đoàn Billiards & Snooker Việt Nam.':
    'Tournaments, membership, player rankings and news from the Vietnam Billiards & Snooker Federation.',

  // Điều hướng & bộ khung
  'Trang chủ': 'Home',
  'Giới thiệu': 'About',
  'Tin tức': 'News',
  'Giải đấu': 'Tournaments',
  'Ranking': 'Rankings',
  'Thư viện': 'Library',
  'Hội viên': 'Members',
  'Liên hệ': 'Contact',
  'Mở menu': 'Open menu',
  'Liên kết nhanh': 'Quick links',
  'Bảng xếp hạng': 'Rankings',
  'Liên đoàn Billiards & Snooker Việt Nam': 'Vietnam Billiards & Snooker Federation',
  'Liên đoàn Billiards & Snooker Việt Nam — cơ quan quản lý và phát triển phong trào bi-a toàn quốc.':
    'Vietnam Billiards & Snooker Federation — the governing body for billiards & snooker nationwide.',
  'Tiếng Việt': 'Vietnamese',
  'English': 'English',

  // Trang chủ
  'TIN NỔI BẬT': 'FEATURED',
  'Tin nổi bật': 'Featured news',
  'Xem thêm bài viết →': 'More articles →',
  'Tin tức mới nhất': 'Latest news',
  'Xem tất cả →': 'View all →',
  'SỰ KIỆN': 'EVENT',
  'Xem chi tiết': 'View details',
  'Lịch giải đấu sắp diễn ra': 'Upcoming tournaments',
  'Tất cả giải đấu →': 'All tournaments →',
  'Top players': 'Top players',
  'Xem bảng xếp hạng đầy đủ →': 'View full rankings →',
  'Nam': 'Men',
  'Nữ': 'Women',
  'Nữ & Trẻ': 'Women & Juniors',
  'VĐV trẻ': 'Juniors',
  'Nguồn dữ liệu: hệ thống xếp hạng VBSF': 'Source: VBSF ranking system',
  'Trở thành hội viên chính thức của VBSF': 'Become an official VBSF member',
  'Đăng ký trực tuyến, theo dõi xếp hạng cá nhân và tham gia hệ thống giải đấu quốc gia.':
    'Register online, follow your own ranking and join the national tournament system.',
  'Đăng ký hội viên': 'Become a member',
  'Đối tác & nhà tài trợ': 'Partners & sponsors',
  'ĐỐI TÁC & NHÀ TÀI TRỢ': 'PARTNERS & SPONSORS',

  // Tin tức
  'Hoạt động Liên đoàn · tin billiards trong nước & quốc tế':
    'Federation activities · billiards news at home and abroad',
  'Tất cả': 'All',
  'Hoạt động VBSF': 'VBSF activities',
  'HOẠT ĐỘNG VBSF': 'VBSF ACTIVITIES',
  'Trong nước': 'Domestic',
  'Quốc tế': 'International',
  'Đào tạo': 'Training',
  'Đọc tiếp →': 'Read more →',
  'Tin xem nhiều': 'Most read',
  'Tìm bài viết...': 'Search articles...',
  'Tin liên quan': 'Related articles',

  // Giải đấu
  'Hệ thống thi đấu quốc gia · lịch & kết quả': 'National tournament system · schedule & results',
  'Sắp diễn ra': 'Upcoming',
  'SẮP DIỄN RA': 'UPCOMING',
  'Đang diễn ra': 'Ongoing',
  'Đã kết thúc': 'Finished',
  'Tất cả nội dung': 'All disciplines',
  'Tất cả năm': 'All years',
  'Kết quả gần đây': 'Recent results',
  'Xem kết quả →': 'View results →',
  'Xem kết quả trực tiếp →': 'Live results →',
  'Mở đăng ký': 'Registration open',
  'Sắp mở': 'Opening soon',
  'Đăng ký': 'Register',
  'Chi tiết giải đấu': 'Tournament details',
  'Đơn vị tổ chức': 'Organiser',
  'Trạng thái': 'Status',
  'Tên giải đấu': 'Tournament name',
  'Nội dung': 'Discipline',
  'Ngày': 'Date',
  'Địa điểm': 'Venue',
  'Thông tin chung': 'Overview',
  'Thi đấu': 'Competition',
  'Ngày thi đấu:': 'Competition date:',
  'Địa điểm:': 'Venue:',
  'Đăng ký thi đấu': 'Enter tournament',
  'Chưa mở đăng ký': 'Registration not open',
  'Xem kết quả trực tiếp': 'View live results',
  'Xem kết quả chung cuộc': 'View final results',
  'Giải thưởng': 'Prizes',
  'Thứ hạng': 'Place',
  'Giải thưởng tiền mặt': 'Cash prize',
  'Hiện vật': 'In kind',
  'Thể lệ thi đấu': 'Rules',
  'Lệ phí tham gia:': 'Entry fee:',
  'Điều kiện tham dự': 'Eligibility',
  'Lịch thi đấu chi tiết sẽ được công bố sau khi giải đóng đăng ký. Đăng ký ngay để nhận thông báo sớm nhất.':
    'The detailed schedule is published once registration closes. Register now to be notified first.',
  'Giải chưa mở đăng ký nên lịch thi đấu chưa được công bố.':
    'Registration has not opened yet, so the schedule is not published.',
  'Giải đang diễn ra ở vòng': 'The tournament is in round',
  '. Bấm để xem bảng đấu và tỷ số cập nhật trực tiếp.': '. Tap to see the draw and live scores.',
  'Giải đã kết thúc. Vô địch:': 'The tournament has finished. Champion:',
  '. Bấm để xem bục nhận giải và bảng xếp hạng chung cuộc.': '. Tap to see the podium and final standings.',
  '← Quay lại Giải đấu': '← Back to Tournaments',
  'Chưa công bố cơ cấu giải thưởng.': 'The prize breakdown has not been announced.',
  'Chưa công bố thể lệ giải.': 'The rules have not been announced.',

  // Kết quả trực tiếp & chung cuộc
  'Kết quả trực tiếp': 'Live results',
  'TRỰC TIẾP': 'LIVE',
  'Vòng đấu': 'Round',
  'Chung kết': 'Final',
  'Bán kết': 'Semi-final',
  'Vòng tứ kết': 'Quarter-final',
  'Đã hoàn thành': 'Completed',
  'KT': 'FT',
  'LIVE': 'LIVE',
  'SẮP': 'SOON',
  'Kết quả chung cuộc': 'Final results',
  'Bục nhận giải': 'Podium',
  'VÔ ĐỊCH': 'CHAMPION',
  'HẠNG 1': '1ST',
  'HẠNG 2': '2ND',
  'HẠNG 3': '3RD',
  'Bảng xếp hạng chung cuộc': 'Final standings',
  'Hạng': 'Rank',
  'Vận động viên': 'Player',
  'Đơn vị': 'Team',
  'Giải đấu đã kết thúc. Kết quả chi tiết từng vòng đấu và thống kê đầy đủ được lưu trữ trong hệ thống xếp hạng VBSF.':
    'The tournament has finished. Round-by-round results and full statistics are kept in the VBSF ranking system.',
  'Bảng xếp hạng chung cuộc chi tiết chưa được công bố cho nội dung này.':
    'Detailed final standings have not been published for this discipline.',

  // Đăng ký thi đấu
  'Giải thành tích cao — đăng ký qua đội tỉnh/thành': 'Elite tournament — entries submitted by provincial teams',
  'Trưởng đoàn': 'Team manager',
  'Họ và tên': 'Full name',
  'Họ tên': 'Full name',
  'Chức vụ': 'Position',
  'Số điện thoại trưởng đoàn': 'Team manager phone',
  'Chọn vận động viên dự giải': 'Select players to enter',
  'Chỉ hiện những người Liên đoàn đã xác nhận thuộc đội':
    'Only players the Federation has confirmed as team members are listed',
  'Ghi chú': 'Notes',
  'Gửi danh sách đăng ký': 'Submit entry list',
  'thay thế': 'replace',
  'tài khoản đội': 'team account',
  'nhập thông tin thủ công': 'enter the details manually',
  'Giải chỉ dành cho hội viên Liên đoàn.': 'This tournament is open to Federation members only.',
  'Vui lòng đăng nhập bằng tài khoản hội viên còn hiệu lực để đăng ký.':
    'Please sign in with a valid member account to register.',
  'Họ và tên cơ thủ': 'Player full name',
  'Ngày sinh': 'Date of birth',
  'Số căn cước': 'ID number',
  'Số điện thoại': 'Phone number',
  'CLB / Đơn vị': 'Club / Team',
  'Nội dung đăng ký': 'Discipline entered',
  'Gửi đăng ký': 'Submit entry',
  'Bắt buộc': 'Required',
  'Bắt buộc ·': 'Required ·',
  'Ban tổ chức sẽ liên hệ xác nhận qua điện thoại': 'The organisers will call to confirm',
  'Lệ phí thi đấu': 'Entry fee',
  'Phí tham dự': 'Entry fee',
  'Quét VietQR bằng app ngân hàng': 'Scan the VietQR code in your banking app',
  'Ngân hàng': 'Bank',
  'Số TK': 'Account no.',
  'Chủ TK': 'Account name',
  'Tài liệu của giải': 'Tournament documents',
  'Lệ phí nộp qua đội hoặc cá nhân tự nộp. Liên đoàn chỉ đưa vào danh sách thi đấu chính thức khi đã ghi nhận nộp lệ phí.':
    'The fee may be paid by the team or by the player. Players enter the official list only once the fee is recorded.',

  // Giới thiệu
  'Về Liên đoàn Billiards & Snooker Việt Nam': 'About the Vietnam Billiards & Snooker Federation',
  'Về Liên đoàn': 'About the Federation',
  'Năm thành lập': 'Founded',
  'Câu lạc bộ': 'Clubs',
  'Tỉnh / thành': 'Provinces',
  'Tầm nhìn': 'Vision',
  'Sứ mệnh': 'Mission',
  'Cơ cấu tổ chức': 'Organisation',
  'Ban lãnh đạo': 'Leadership',
  'Chủ tịch': 'President',
  'Phó Chủ tịch': 'Vice President',
  'Tổng Thư ký': 'Secretary General',
  'Sơ đồ tổ chức': 'Organisation chart',
  'Đại hội toàn quốc': 'National congress',
  'Ban Chấp hành': 'Executive board',
  'Ban Thường vụ': 'Standing committee',
  'Các ban chuyên môn': 'Specialist committees',
  'Bộ môn': 'Disciplines',
  'Billiards & Snooker': 'Billiards & Snooker',
  'Chưa cập nhật bộ môn thi đấu.': 'Disciplines have not been added yet.',
  'Chưa cập nhật ban lãnh đạo.': 'Leadership has not been added yet.',

  // Bảng xếp hạng
  'Bảng xếp hạng quốc gia': 'National rankings',
  'Xếp hạng cơ thủ theo từng nội dung thi đấu': 'Player rankings by discipline',
  'Toàn quốc': 'Nationwide',
  'Trận': 'Matches',
  'Điểm': 'Points',
  'Xem thêm': 'Show more',
  'Tìm cơ thủ...': 'Search players...',
  'Nguồn: hệ thống xếp hạng VBSF · cập nhật liên tục theo kết quả thi đấu':
    'Source: VBSF ranking system · updated continuously from match results',
  'Chưa có dữ liệu xếp hạng.': 'No ranking data yet.',
  'Chưa có hội viên nào trong bảng xếp hạng.': 'No members in the rankings yet.',

  // Thư viện
  'Văn bản · luật thi đấu · hình ảnh & video': 'Documents · rules · photos & video',
  'Văn bản': 'Documents',
  'Luật thi đấu': 'Rules',
  'Media': 'Media',
  'Văn bản & Luật thi đấu': 'Documents & rules',
  'VĂN BẢN & LUẬT THI ĐẤU': 'DOCUMENTS & RULES',
  'Thư viện media': 'Media library',
  'THƯ VIỆN MEDIA': 'MEDIA LIBRARY',
  'Tìm tài liệu...': 'Search documents...',
  'Chưa có văn bản nào.': 'No documents yet.',
  'Chưa có album ảnh/video nào.': 'No photo or video albums yet.',

  // Đối tác
  'Đối tác & Nhà tài trợ': 'Partners & Sponsors',
  'Đồng hành cùng sự phát triển của billiards Việt Nam': 'Supporting the growth of billiards in Vietnam',
  'Đối tác chiến lược': 'Strategic partners',
  'Nhà tài trợ Kim cương': 'Diamond sponsors',
  'Nhà tài trợ Vàng': 'Gold sponsors',
  'Đối tác đồng hành': 'Supporting partners',
  'Trở thành đối tác của VBSF': 'Become a VBSF partner',
  'Cùng đồng hành phát triển phong trào billiards & snooker và kết nối với cộng đồng cơ thủ toàn quốc.':
    'Help grow billiards & snooker and reach the national player community.',
  'Liên hệ hợp tác': 'Contact us about partnership',
  'Chưa có đơn vị nào ở hạng này.': 'No organisations at this tier yet.',
  'Chưa có đối tác nào.': 'No partners yet.',

  // Hội viên
  'Đăng ký trực tuyến · theo dõi xếp hạng cá nhân': 'Register online · follow your own ranking',
  'Đã là hội viên? Đăng nhập để xem hạng của bạn': 'Already a member? Sign in to see your ranking',
  'Mật khẩu': 'Password',
  'Đăng nhập': 'Sign in',
  'Đăng xuất': 'Sign out',
  'Quên mật khẩu?': 'Forgot your password?',
  'Đặt lại mật khẩu': 'Reset password',
  'Nhập số điện thoại đã đăng ký — chúng tôi sẽ gửi mã đặt lại tới email của bạn.':
    'Enter your registered phone number — we will email you a reset code.',
  'Gửi mã đặt lại': 'Send reset code',
  'Nhập mã trong email và mật khẩu mới. Mã có hiệu lực 30 phút.':
    'Enter the code from the email and a new password. The code is valid for 30 minutes.',
  'Mã đặt lại': 'Reset code',
  'Mật khẩu mới': 'New password',
  'Đổi mật khẩu': 'Change password',
  'Chưa có tài khoản? Điền form bên dưới để đăng ký.': 'No account yet? Fill in the form below to register.',
  'Thông tin': 'Details',
  'Thanh toán': 'Payment',
  'Hoàn tất': 'Done',
  'Thông tin đăng ký': 'Registration details',
  'Số CCCD': 'ID number',
  'Email': 'Email',
  'Tỉnh / Thành': 'Province / City',
  'Địa chỉ nơi ở': 'Home address',
  'Câu lạc bộ / Đơn vị': 'Club / Team',
  'Ảnh đại diện (tùy chọn)': 'Profile photo (optional)',
  'Tải ảnh lên (tối đa 3 MB)': 'Upload a photo (max 3 MB)',
  'Tạo tài khoản hội viên': 'Create member account',
  'Bước 2 — Thanh toán hội phí': 'Step 2 — Membership fee',
  'Hội phí (nhập CCCD để tính)': 'Membership fee (enter ID number to calculate)',
  'Danh sách hội viên': 'Member directory',
  'Hội viên cá nhân': 'Individual members',
  'Hội viên tổ chức': 'Organisation members',
  'Mã hội viên': 'Member no.',
  'Tình trạng': 'Status',
  'Tên tổ chức': 'Organisation',
  'Tên tổ chức / CLB': 'Organisation / Club name',
  'Năm gia nhập': 'Joined',
  'Địa chỉ': 'Address',
  'Tìm hội viên...': 'Search members...',
  'Tìm tổ chức...': 'Search organisations...',
  'Tổ chức đã là hội viên? Đăng nhập để xem thông tin': 'Already an organisation member? Sign in to see your profile',
  'Đăng ký hội viên tổ chức': 'Organisation membership',
  'Loại hình': 'Type',
  'Doanh nghiệp': 'Company',
  'Trường học': 'School',
  'Tổ chức khác': 'Other organisation',
  'Mã số thuế': 'Tax code',
  'Người đại diện': 'Representative',
  'Email liên hệ': 'Contact email',
  'Xét duyệt hồ sơ': 'Application review',
  'Hồ sơ đăng ký hội viên tổ chức sẽ được Ban Tổ chức VBSF xem xét và liên hệ hướng dẫn hoàn tất hội phí trong vòng 3–5 ngày làm việc.':
    'VBSF reviews organisation applications and will be in touch about the fee within 3–5 working days.',
  'Gửi hồ sơ đăng ký': 'Submit application',
  'Dán mã từ email': 'Paste the code from the email',
  'Ít nhất 6 ký tự': 'At least 6 characters',
  'Nhập số CCCD': 'Enter ID number',
  'Hội viên / Danh sách': 'Members / Directory',
  'Tên hội viên': 'Member name',
  'Mã HV:': 'Member no.:',
  'Thời hạn hội viên': 'Membership period',
  'Đang hiệu lực': 'Active',
  'Có hiệu lực đến': 'Valid until',
  'Chờ thanh toán': 'Awaiting payment',
  'Hội viên đã đăng ký nhưng chưa hoàn tất thanh toán hội phí.':
    'Registered, but the membership fee has not been paid.',
  'Hết hạn': 'Expired',
  'Đã hết hiệu lực từ': 'Expired on',
  'Gia hạn hội viên': 'Renew membership',
  'Thanh toán gia hạn hội phí': 'Pay the renewal fee',
  'Nội dung chuyển khoản': 'Transfer reference',
  'Hệ thống tự động xác nhận khi nhận được chuyển khoản đúng nội dung (đối soát VietQR).':
    'Payment is confirmed automatically once a transfer arrives with the correct reference (VietQR reconciliation).',
  'Tôi đã chuyển khoản': 'I have made the transfer',

  // Liên hệ
  'Liên hệ với Liên đoàn Billiards & Snooker Việt Nam': 'Contact the Vietnam Billiards & Snooker Federation',
  'Thông tin liên hệ': 'Contact details',
  'Điện thoại': 'Phone',
  'Giờ làm việc': 'Opening hours',
  'Theo dõi Liên đoàn': 'Follow the Federation',
  'Gửi liên hệ': 'Send message',
  'Chủ đề': 'Subject',
  'Hợp tác': 'Partnership',
  'Khác': 'Other',
  'Nhập nội dung liên hệ...': 'Write your message...',

  // Nhãn chung dùng ở nhiều trang
  '— Chọn tỉnh / thành —': '— Select province / city —',
  'Tên đối tác': 'Partner name',
  'Chọn': 'Select',
  'Hủy': 'Cancel',
  'Lưu': 'Save',
  'Đang tải...': 'Loading...',
  'Không tìm thấy': 'Not found',
  'Xem trước': 'Preview',
  'Tải xuống': 'Download',
  'Chi tiết': 'Details',
  'Quay lại': 'Back',
  'Gửi': 'Send',
  'Đóng': 'Close',
  'Xác nhận': 'Confirm',
  'Tiếp tục': 'Continue',

  // Trạng thái rỗng dùng chung (dựng trong strapi-content.js)
  'Chưa có nội dung.': 'Nothing here yet.',
  'Chưa có bài viết nào.': 'No articles yet.',
  'Chưa có bài viết nổi bật.': 'No featured article yet.',
  'Không tìm thấy bài viết phù hợp.': 'No matching articles.',
  'Chưa có giải đấu nào sắp diễn ra.': 'No upcoming tournaments.',
  'Chưa có giải đấu nào đã kết thúc.': 'No finished tournaments.',
  'Không tìm thấy bài viết này. Bài có thể đã được gỡ.':
    'This article could not be found. It may have been removed.',
  'Không tìm thấy giải đấu này. Giải có thể đã được gỡ.':
    'This tournament could not be found. It may have been removed.',
  'Giải chưa bốc thăm xếp cặp. Kết quả sẽ hiển thị khi giải bắt đầu.':
    'The draw has not been made. Results appear once play starts.',
  'Chưa có trận nào bắt đầu. Kết quả sẽ hiển thị ngay khi có.':
    'No matches have started yet. Results appear as soon as they do.',
  '← Về trang chủ': '← Back to home',
  'Tỷ số theo thể thức đấu loại trực tiếp · Cập nhật tự động khi có kết quả mới':
    'Knockout format scores · updated automatically as results come in',
};

/**
 * Chữ giao diện sang ngôn ngữ đang xem.
 * Không có trong từ điển thì trả lại nguyên văn — đó là đường đi của tên riêng,
 * mã số và mọi dữ liệu do CMS nhập.
 */
function translateUi(text, lang) {
  if (normalizeLang(lang) === 'vi') return text;
  if (text == null) return text;
  var key = String(text).trim();
  if (!key) return text;
  var hit = VBSF_DICT_EN[key];
  if (hit == null) return text;
  // Giữ lại khoảng trắng hai đầu của chuỗi gốc (quan trọng với text node nằm
  // giữa các thẻ inline, vd. "... bấm " + <a>đây</a>).
  var lead = String(text).match(/^\s*/)[0];
  var tail = String(text).match(/\s*$/)[0];
  return lead + hit + tail;
}

/* ---------- 2. Phủ bản dịch lên nội dung CMS ---------- */

/** Các field tiếng Anh có thật của một bản ghi (bỏ ô trống). */
function enFields(record) {
  var en = record && record.i18n && record.i18n.en;
  if (!en || typeof en !== 'object') return null;
  var out = null;
  Object.keys(en).forEach(function (k) {
    var v = en[k];
    if (v == null) return;
    if (typeof v === 'string' && v.trim() === '') return;
    if (Array.isArray(v) && !v.length) return;
    if (!out) out = {};
    out[k] = v;
  });
  return out;
}

/** Bản sao của bản ghi với field tiếng Anh đã phủ lên. */
function overlayRecord(record, lang) {
  if (normalizeLang(lang) === 'vi' || !record) return record;
  var en = enFields(record);
  if (!en) return record;
  var out = {};
  Object.keys(record).forEach(function (k) { out[k] = record[k]; });
  Object.keys(en).forEach(function (k) { out[k] = en[k]; });
  return out;
}

function overlayList(list, lang) {
  if (normalizeLang(lang) === 'vi' || !Array.isArray(list)) return list;
  return list.map(function (r) { return overlayRecord(r, lang); });
}

/**
 * Một khối (section) của module "Trang website". Khác bản ghi thường ở chỗ nội
 * dung nằm lồng trong `content` và `items`, nên phải phủ từng tầng: dịch tiêu đề
 * khối mà bỏ qua các ô bên trong thì nửa Việt nửa Anh.
 */
function overlaySection(entry, lang) {
  if (normalizeLang(lang) === 'vi' || !entry) return entry;
  var en = enFields(entry);
  if (!en) return entry;
  var out = {};
  Object.keys(entry).forEach(function (k) { out[k] = entry[k]; });
  if (en.title) out.title = en.title;
  if (en.backgroundImage) out.backgroundImage = en.backgroundImage;
  if (en.content && typeof en.content === 'object') {
    out.content = {};
    Object.keys(entry.content || {}).forEach(function (k) { out.content[k] = entry.content[k]; });
    Object.keys(en.content).forEach(function (k) {
      var v = en.content[k];
      if (v != null && String(v).trim() !== '') out.content[k] = v;
    });
  }
  if (Array.isArray(en.items) && Array.isArray(entry.items)) {
    out.items = entry.items.map(function (item, i) {
      var tr = en.items[i];
      if (!tr || typeof tr !== 'object') return item;
      var merged = {};
      Object.keys(item || {}).forEach(function (k) { merged[k] = item[k]; });
      Object.keys(tr).forEach(function (k) {
        var v = tr[k];
        if (v != null && String(v).trim() !== '') merged[k] = v;
      });
      return merged;
    });
  }
  return out;
}

/**
 * Phủ bản dịch lên CẢ GÓI dữ liệu site tải về, một lần ngay sau khi tải. Nhờ
 * vậy toàn bộ hàm render bên dưới đọc bản ghi như bình thường, không chỗ nào
 * phải hỏi "đang xem tiếng gì".
 */
function overlayData(data, lang) {
  if (normalizeLang(lang) === 'vi' || !data) return data;
  var LISTS = ['news', 'tournaments', 'partners', 'libraryDocs', 'mediaItems', 'leaders'];
  var out = {};
  Object.keys(data).forEach(function (k) { out[k] = data[k]; });
  LISTS.forEach(function (k) { out[k] = overlayList(data[k], lang); });
  out.settings = overlayRecord(data.settings, lang);
  out.contact = overlayRecord(data.contact, lang);

  var sections = data.pageContent && data.pageContent.data && data.pageContent.data.pageSections;
  if (sections) {
    var translated = {};
    Object.keys(sections).forEach(function (pageId) {
      var list = sections[pageId];
      translated[pageId] = Array.isArray(list)
        ? list.map(function (e) { return overlaySection(e, lang); })
        : list;
    });
    var inner = {};
    Object.keys(data.pageContent.data).forEach(function (k) { inner[k] = data.pageContent.data[k]; });
    inner.pageSections = translated;
    out.pageContent = { data: inner };
  }
  return out;
}

if (typeof module === 'object' && module.exports) {
  module.exports = {
    VBSF_LANGS, VBSF_DEFAULT_LANG, VBSF_DICT_EN,
    normalizeLang, translateUi, enFields,
    overlayRecord, overlayList, overlaySection, overlayData,
  };
}
