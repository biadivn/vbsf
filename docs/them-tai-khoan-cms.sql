-- =============================================================================
-- THÊM TÀI KHOẢN CMS MỚI
--   Tài khoản : superadmin@biadi.vn
--   Mật khẩu  : do người chạy tự đặt — xem bước tạo hash bên dưới
--
-- PHẢI CHẠY CẢ HAI LỆNH INSERT. Chỉ thêm dòng vào up_users thì đăng nhập được
-- nhưng mọi thao tác trong CMS đều trả 403 — quyền nằm ở role "Authenticated"
-- và được nối vào tài khoản qua bảng up_users_role_lnk.
--
-- CSDL KHÔNG CHẶN TRÙNG EMAIL. up_users không có unique index trên email hay
-- username (Strapi chỉ kiểm ở tầng ứng dụng), nên chạy lệnh thường hai lần sẽ
-- tạo RA HAI TÀI KHOẢN CÙNG EMAIL và việc đăng nhập trở nên không xác định.
-- Vì vậy cả hai lệnh dưới đây đều viết dạng INSERT ... WHERE NOT EXISTS:
-- chạy bao nhiêu lần cũng chỉ tạo đúng một tài khoản.
--
-- TẠO HASH TRƯỚC KHI CHẠY. SQL không tự băm được mật khẩu; cột password lưu
-- bcrypt cost 10 (đúng mức Strapi dùng). Chạy trong thư mục strapi-backend:
--   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'MatKhauMuonDat'
-- rồi thay chuỗi $2a$10$THAY_BANG_HASH_VUA_TAO bên dưới bằng kết quả.
--
-- CỐ Ý KHÔNG để mật khẩu thật trong tệp này vì tệp nằm trong repo. Đặt mật khẩu
-- lúc chạy, báo cho người dùng qua kênh riêng, và yêu cầu đổi sau lần đăng nhập
-- đầu tiên.
-- =============================================================================

BEGIN;

-- 1) Thêm tài khoản — chỉ chèn nếu email chưa tồn tại.
--    document_id: chuỗi 24 ký tự bất kỳ, miễn không trùng dòng nào đang có.
INSERT INTO up_users (
    document_id, username, email, provider, password,
    confirmed, blocked, display_name,
    created_at, updated_at, published_at
)
SELECT 'thay-bang-24-ky-tu-ngau-nhien',
       'superadmin@biadi.vn',
       'superadmin@biadi.vn',
       'local',
       '$2a$10$THAY_BANG_HASH_VUA_TAO',
       TRUE,                -- SQLite: 1
       FALSE,               -- SQLite: 0
       'Super Admin',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM up_users WHERE email = 'superadmin@biadi.vn'
);

-- 2) Gán role "Authenticated" — BẮT BUỘC, thiếu là CMS báo 403 ở mọi mục.
INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
SELECT u.id,
       r.id,
       COALESCE((SELECT MAX(l.user_ord) FROM up_users_role_lnk l), 0) + 1
FROM   up_users u
CROSS  JOIN up_roles r
WHERE  u.email = 'superadmin@biadi.vn'
  AND  r.type  = 'authenticated'
  AND  NOT EXISTS (
        SELECT 1 FROM up_users_role_lnk l2 WHERE l2.user_id = u.id
  );

COMMIT;


-- =============================================================================
-- KIỂM TRA SAU KHI CHẠY
-- Phải ra ĐÚNG 1 DÒNG, cột role = Authenticated, blocked = 0, confirmed = 1.
-- Ra 2 dòng trở lên nghĩa là đã có tài khoản trùng email từ trước — xử lý trước
-- khi dùng, vì đăng nhập sẽ không xác định được vào tài khoản nào.
-- =============================================================================
SELECT u.id,
       u.email,
       u.display_name,
       u.confirmed,
       u.blocked,
       substr(u.password, 1, 7) AS hash_prefix,
       r.name                   AS role
FROM   up_users u
LEFT   JOIN up_users_role_lnk l ON l.user_id = u.id
LEFT   JOIN up_roles          r ON r.id      = l.role_id
WHERE  u.email = 'superadmin@biadi.vn';


-- =============================================================================
-- GHI CHÚ
--
-- * SQLite (dev, .tmp/data.db): thay TRUE/FALSE bằng 1/0.
--   Postgres (production): giữ nguyên TRUE/FALSE.
--
-- * Mọi tài khoản CMS hiện đều TOÀN QUYỀN với mọi mục, kể cả tạo/xoá tài khoản
--   khác — chưa có phân quyền theo vai trò. Tên "superadmin" chỉ là nhãn hiển
--   thị, không phải một mức quyền riêng.
--
-- * Cách không cần SQL (ưu tiên dùng): đăng nhập CMS → Tài khoản CMS →
--   "Thêm tài khoản". Dùng SQL khi không còn tài khoản nào vào được CMS.
--
-- * Muốn xoá tài khoản này: xoá dòng ở up_users_role_lnk trước, rồi mới xoá ở
--   up_users (tránh để lại dòng liên kết mồ côi).
--     DELETE FROM up_users_role_lnk
--      WHERE user_id = (SELECT id FROM up_users WHERE email = 'superadmin@biadi.vn');
--     DELETE FROM up_users WHERE email = 'superadmin@biadi.vn';
-- =============================================================================
