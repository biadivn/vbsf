-- =============================================================================
-- THÊM TÀI KHOẢN CMS MỚI  —  MariaDB / MySQL
--   Tài khoản: superadmin@biadi.vn
--
-- Chạy TỪNG LỆNH MỘT, theo thứ tự, TRONG CÙNG MỘT CỬA SỔ KẾT NỐI.
-- Bản này cố ý không dùng FROM DUAL, không dùng subquery trên bảng đang ghi —
-- là hai thứ gây lỗi 1064 và 1093 trên MariaDB.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BƯỚC 0 — CHẨN ĐOÁN. Chạy trước, đọc kỹ kết quả.
-- -----------------------------------------------------------------------------

-- 0a. Tài khoản đã tồn tại chưa?
--     Ra >= 1 dòng  => KHÔNG phải insert hỏng, mà là tài khoản ĐÃ CÓ từ lần chạy
--     trước. Bỏ qua bước 1, nhảy xuống phần "TÀI KHOẢN ĐÃ TỒN TẠI" ở cuối tệp.
SELECT id, username, email, confirmed, blocked, display_name
FROM   up_users
WHERE  email = 'superadmin@biadi.vn' OR username = 'superadmin@biadi.vn';

-- 0b. Role "authenticated" có id bằng mấy? Ghi lại con số này.
SELECT id, name, type FROM up_roles;

-- 0c. Đang đứng ở đúng database chưa? Có đúng hai bảng này không?
SELECT DATABASE() AS db_dang_dung;
SHOW TABLES LIKE 'up_users%';


-- -----------------------------------------------------------------------------
-- BƯỚC 1 — TẠO HASH MẬT KHẨU (chạy ở terminal, không phải trong SQL client)
--
--   cd strapi-backend
--   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'MatKhauMuonDat'
--
-- Kết quả có dạng $2a$10$.... Thay vào chỗ THAY_BANG_HASH_VUA_TAO bên dưới.
-- Mật khẩu thật cố ý không để trong tệp này vì tệp nằm trong repo.
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- BƯỚC 2 — THÊM TÀI KHOẢN. INSERT thuần, không subquery.
--     document_id: chuỗi bất kỳ, miễn không trùng — đổi vài ký tự cuối là được.
-- -----------------------------------------------------------------------------
INSERT INTO up_users
    (document_id, username, email, provider, password,
     confirmed, blocked, display_name,
     created_at, updated_at, published_at)
VALUES
    ('spadmin000000000000biadi',
     'superadmin@biadi.vn',
     'superadmin@biadi.vn',
     'local',
     '$2a$10$THAY_BANG_HASH_VUA_TAO',
     1,
     0,
     'Super Admin',
     NOW(), NOW(), NOW());


-- -----------------------------------------------------------------------------
-- BƯỚC 3 — GÁN ROLE. BẮT BUỘC, thiếu là CMS trả 403 ở mọi mục.
--
-- LAST_INSERT_ID() lấy id vừa tạo ở bước 2 — phải chạy NGAY SAU bước 2, trong
-- CÙNG cửa sổ kết nối. Nếu đã đóng/mở lại kết nối thì dùng bản thay thế bên dưới.
-- -----------------------------------------------------------------------------
INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
VALUES (LAST_INSERT_ID(),
        (SELECT id FROM up_roles WHERE type = 'authenticated' LIMIT 1),
        1);

-- Bản thay thế nếu LAST_INSERT_ID() không còn đúng: điền tay hai con số lấy từ
-- bước 0a (id tài khoản) và 0b (id role authenticated).
-- INSERT INTO up_users_role_lnk (user_id, role_id, user_ord) VALUES (2, 1, 1);


-- -----------------------------------------------------------------------------
-- BƯỚC 4 — KIỂM TRA. Phải ra ĐÚNG 1 dòng, role = Authenticated.
-- -----------------------------------------------------------------------------
SELECT u.id, u.email, u.display_name, u.confirmed, u.blocked,
       SUBSTRING(u.password, 1, 7) AS hash_prefix,
       r.name                      AS role
FROM   up_users u
LEFT   JOIN up_users_role_lnk l ON l.user_id = u.id
LEFT   JOIN up_roles          r ON r.id      = l.role_id
WHERE  u.email = 'superadmin@biadi.vn';


-- =============================================================================
-- TÀI KHOẢN ĐÃ TỒN TẠI (bước 0a ra dòng)
-- Không cần INSERT nữa — chỉ đặt lại mật khẩu và bảo đảm có role.
-- =============================================================================
-- UPDATE up_users
-- SET    password = '$2a$10$THAY_BANG_HASH_VUA_TAO',
--        confirmed = 1, blocked = 0, reset_password_token = NULL,
--        updated_at = NOW()
-- WHERE  email = 'superadmin@biadi.vn';
--
-- -- thiếu role thì thêm (điền id lấy từ bước 0a / 0b):
-- SELECT * FROM up_users_role_lnk WHERE user_id = <id_tai_khoan>;
-- INSERT INTO up_users_role_lnk (user_id, role_id, user_ord)
-- VALUES (<id_tai_khoan>, <id_role_authenticated>, 1);


-- =============================================================================
-- NẾU VẪN KHÔNG VÀO ĐƯỢC — các nguyên nhân theo thứ tự hay gặp
--
-- 1. "0 rows affected" mà không báo lỗi  => tài khoản đã tồn tại (xem bước 0a),
--    hoặc client đang ở chế độ chỉ-đọc / chưa COMMIT. Kiểm tra autocommit:
--       SELECT @@autocommit;        -- 0 nghĩa là phải tự chạy COMMIT;
--       COMMIT;
--
-- 2. Insert được nhưng đăng nhập CMS vẫn sai mật khẩu
--    => hash dán vào bị thiếu ký tự hoặc bị client cắt. Kiểm tra độ dài phải
--       đúng 60:  SELECT LENGTH(password) FROM up_users WHERE email='superadmin@biadi.vn';
--
-- 3. Đăng nhập được nhưng CMS trả 403 ở mọi mục  => thiếu bước 3 (gán role).
--
-- 4. Sai database: Strapi production có thể dùng DB khác với DB đang mở trong
--    client. Đối chiếu bước 0c với DATABASE_NAME trong .env của Strapi.
--
-- 5. Bảng có tiền tố khác (một số bản cài đặt đổi tên bảng). Kiểm tra bằng
--    SHOW TABLES LIKE '%users%';
--
-- =============================================================================
-- GHI CHÚ
-- * Mọi tài khoản CMS đều TOÀN QUYỀN — chưa có phân quyền theo vai trò.
--   "superadmin" chỉ là nhãn hiển thị.
-- * Cách không cần SQL: đăng nhập CMS → Tài khoản CMS → "Thêm tài khoản".
-- * Xoá tài khoản: xoá dòng ở up_users_role_lnk trước, rồi mới xoá up_users.
-- =============================================================================
