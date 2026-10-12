-- =============================================================================
-- THÊM TÀI KHOẢN CMS MỚI  —  bản viết cho MariaDB / MySQL
--   Tài khoản : superadmin@biadi.vn
--   Mật khẩu  : do người chạy tự đặt (xem bước tạo hash bên dưới)
--
-- Cuối tệp có biến thể cho PostgreSQL và SQLite — cú pháp KHÁC nhau, đừng chạy
-- nhầm bản.
--
-- -----------------------------------------------------------------------------
-- BƯỚC 1 — TẠO HASH. SQL không tự băm được mật khẩu; cột password lưu bcrypt
-- cost 10 (đúng mức Strapi dùng). Chạy trong thư mục strapi-backend:
--
--   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'MatKhauMuonDat'
--
-- Dán kết quả ($2a$10$....) vào chỗ THAY_BANG_HASH_VUA_TAO bên dưới.
-- Cố ý không để mật khẩu thật trong tệp này vì tệp nằm trong repo.
--
-- BƯỚC 2 — chạy cả hai lệnh INSERT. Chỉ thêm dòng vào up_users thì đăng nhập
-- được nhưng mọi mục trong CMS trả 403: quyền nằm ở role "Authenticated", nối
-- vào tài khoản qua bảng up_users_role_lnk.
-- =============================================================================

START TRANSACTION;

-- 1) Thêm tài khoản.
--
--    Vì sao có FROM DUAL: trong MariaDB/MySQL, SELECT không có FROM thì không
--    được kèm WHERE — thiếu nó là lỗi 1064 ngay tại dòng WHERE.
--
--    Vì sao bọc subquery trong (SELECT ...) AS x: MariaDB không cho đọc trực
--    tiếp bảng đích trong subquery của INSERT ... SELECT (lỗi 1093). Bọc thành
--    bảng dẫn xuất là cách chuẩn để lách.
--
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
       1,                   -- confirmed
       0,                   -- blocked
       'Super Admin',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM (
        SELECT id FROM up_users WHERE email = 'superadmin@biadi.vn'
    ) AS x
);

-- 2) Gán role "Authenticated" — BẮT BUỘC.
INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
SELECT u.id,
       r.id,
       -- user_ord đánh số thứ tự các user TRONG CÙNG một role, nên lấy MAX theo
       -- đúng role đó, không phải MAX toàn bảng.
       COALESCE((SELECT MAX(m.user_ord) FROM (
            SELECT l3.user_ord FROM up_users_role_lnk l3
            JOIN up_roles r3 ON r3.id = l3.role_id
            WHERE r3.type = 'authenticated'
       ) AS m), 0) + 1
FROM   up_users u
CROSS  JOIN up_roles r
WHERE  u.email = 'superadmin@biadi.vn'
  AND  r.type  = 'authenticated'
  AND  NOT EXISTS (
        SELECT 1 FROM (
            SELECT l.user_id FROM up_users_role_lnk l
            JOIN up_users u2 ON u2.id = l.user_id
            WHERE u2.email = 'superadmin@biadi.vn'
        ) AS y
  );

COMMIT;


-- =============================================================================
-- KIỂM TRA SAU KHI CHẠY
-- Phải ra ĐÚNG 1 DÒNG: role = Authenticated, confirmed = 1, blocked = 0.
-- Ra từ 2 dòng trở lên nghĩa là đang có tài khoản trùng email — phải xử lý,
-- vì up_users KHÔNG có unique index trên email (Strapi chỉ kiểm ở tầng ứng
-- dụng), và đăng nhập sẽ không xác định được vào tài khoản nào.
-- =============================================================================
SELECT u.id,
       u.email,
       u.display_name,
       u.confirmed,
       u.blocked,
       SUBSTRING(u.password, 1, 7) AS hash_prefix,
       r.name                      AS role
FROM   up_users u
LEFT   JOIN up_users_role_lnk l ON l.user_id = u.id
LEFT   JOIN up_roles          r ON r.id      = l.role_id
WHERE  u.email = 'superadmin@biadi.vn';


-- =============================================================================
-- CÁCH ĐƠN GIẢN HƠN (nếu không thích subquery)
-- Chạy tay hai bước, tự nhìn kết quả bước 1 rồi mới chạy bước 2:
--
--   SELECT id, email FROM up_users WHERE email = 'superadmin@biadi.vn';
--   -- ra 0 dòng thì chạy tiếp INSERT dạng VALUES thường:
--   INSERT INTO up_users
--     (document_id, username, email, provider, password, confirmed, blocked,
--      display_name, created_at, updated_at, published_at)
--   VALUES ('thay-bang-24-ky-tu-ngau-nhien', 'superadmin@biadi.vn',
--           'superadmin@biadi.vn', 'local', '$2a$10$THAY_BANG_HASH_VUA_TAO',
--           1, 0, 'Super Admin',
--           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
--   INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
--   VALUES (LAST_INSERT_ID(), (SELECT id FROM up_roles WHERE type='authenticated'), 1);


-- =============================================================================
-- BIẾN THỂ CHO POSTGRESQL  — bỏ FROM DUAL, không cần bọc bảng dẫn xuất
-- =============================================================================
-- INSERT INTO up_users (document_id, username, email, provider, password,
--                       confirmed, blocked, display_name,
--                       created_at, updated_at, published_at)
-- SELECT 'thay-bang-24-ky-tu-ngau-nhien', 'superadmin@biadi.vn',
--        'superadmin@biadi.vn', 'local', '$2a$10$THAY_BANG_HASH_VUA_TAO',
--        TRUE, FALSE, 'Super Admin',
--        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
-- WHERE NOT EXISTS (SELECT 1 FROM up_users WHERE email = 'superadmin@biadi.vn');

-- =============================================================================
-- BIẾN THỂ CHO SQLITE (dev, .tmp/data.db) — giống Postgres, dùng 1/0
-- =============================================================================
-- INSERT INTO up_users (document_id, username, email, provider, password,
--                       confirmed, blocked, display_name,
--                       created_at, updated_at, published_at)
-- SELECT 'thay-bang-24-ky-tu-ngau-nhien', 'superadmin@biadi.vn',
--        'superadmin@biadi.vn', 'local', '$2a$10$THAY_BANG_HASH_VUA_TAO',
--        1, 0, 'Super Admin',
--        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
-- WHERE NOT EXISTS (SELECT 1 FROM up_users WHERE email = 'superadmin@biadi.vn');


-- =============================================================================
-- GHI CHÚ
--
-- * Mọi tài khoản CMS hiện đều TOÀN QUYỀN với mọi mục, kể cả tạo/xoá tài khoản
--   khác — chưa có phân quyền theo vai trò. "superadmin" chỉ là nhãn hiển thị.
--
-- * Cách không cần SQL (ưu tiên dùng): đăng nhập CMS → Tài khoản CMS →
--   "Thêm tài khoản". Dùng SQL khi không còn tài khoản nào vào được CMS.
--
-- * Muốn xoá tài khoản này: xoá dòng liên kết trước, rồi mới xoá tài khoản.
--     DELETE FROM up_users_role_lnk
--      WHERE user_id = (SELECT id FROM (SELECT id FROM up_users
--                                        WHERE email='superadmin@biadi.vn') AS z);
--     DELETE FROM up_users WHERE email = 'superadmin@biadi.vn';
-- =============================================================================
