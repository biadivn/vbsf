-- =============================================================================
-- ĐẶT LẠI MẬT KHẨU CHO MỘT TÀI KHOẢN
--
-- Hệ thống có BA loại tài khoản nằm ở ba bảng khác nhau, đăng nhập bằng thứ
-- khác nhau — chọn đúng mục bên dưới:
--
--   up_users     Tài khoản CMS        đăng nhập bằng email (hoặc username)
--   members      Hội viên cá nhân     đăng nhập bằng số điện thoại, trên website
--   member_orgs  Đội / tổ chức        đăng nhập bằng số điện thoại, trên website
--
-- QUAN TRỌNG — SQL KHÔNG TỰ BĂM ĐƯỢC MẬT KHẨU.
-- Cả ba bảng đều lưu mật khẩu đã băm bằng bcrypt ($2a$10$...). Không có hàm
-- bcrypt trong SQLite/Postgres mặc định, nên phải tạo chuỗi hash trước rồi dán
-- vào câu lệnh. Ghi mật khẩu thô vào cột password sẽ làm tài khoản KHÔNG đăng
-- nhập được (so khớp bcrypt sẽ luôn trượt).
--
-- Bước 1 — tạo hash (chạy trong thư mục strapi-backend):
--
--   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'MatKhauMoi123'
--
-- Dán kết quả (dạng $2a$10$....) vào chỗ :hash bên dưới.
-- Cost 10 là mức Strapi đang dùng; giữ nguyên để khớp với các hash đã có.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) TÀI KHOẢN CMS  (vbsf-cms.biadi.vn)
-- -----------------------------------------------------------------------------
-- Xem trước ai sẽ bị đổi — LUÔN chạy SELECT này trước:
SELECT id, username, email, confirmed, blocked
FROM   up_users
WHERE  email = 'cms-admin@vbsf.local';

UPDATE up_users
SET    password             = '$2a$10$THAY_BANG_HASH_VUA_TAO',
       reset_password_token = NULL,   -- vô hiệu hoá link đặt lại mật khẩu đang treo
       confirmed            = TRUE,   -- SQLite: dùng 1
       blocked              = FALSE,  -- SQLite: dùng 0
       updated_at           = CURRENT_TIMESTAMP
WHERE  email = 'cms-admin@vbsf.local';


-- -----------------------------------------------------------------------------
-- 2) HỘI VIÊN CÁ NHÂN  (đăng nhập trang thành viên trên website)
-- -----------------------------------------------------------------------------
SELECT id, code, name, phone, status, expiry
FROM   members
WHERE  phone = '0901234567';

UPDATE members
SET    password           = '$2a$10$THAY_BANG_HASH_VUA_TAO',
       reset_token_hash   = NULL,     -- huỷ link đặt lại mật khẩu đã gửi trước đó
       reset_token_expiry = NULL,
       updated_at         = CURRENT_TIMESTAMP
WHERE  phone = '0901234567';


-- -----------------------------------------------------------------------------
-- 3) TÀI KHOẢN ĐỘI / TỔ CHỨC  (đăng nhập trang thành viên trên website)
-- -----------------------------------------------------------------------------
SELECT id, code, name, org_type, phone, status
FROM   member_orgs
WHERE  phone = '0909000111';

UPDATE member_orgs
SET    password           = '$2a$10$THAY_BANG_HASH_VUA_TAO',
       reset_token_hash   = NULL,
       reset_token_expiry = NULL,
       updated_at         = CURRENT_TIMESTAMP
WHERE  phone = '0909000111';


-- -----------------------------------------------------------------------------
-- KIỂM TRA LẠI SAU KHI CHẠY
-- Hash mới phải bắt đầu bằng $2a$10$ và khác hash cũ. Đừng in cả cột password
-- ra màn hình chung — chỉ cần xem phần đầu là đủ.
-- -----------------------------------------------------------------------------
SELECT id, email, substr(password, 1, 7) AS hash_prefix, updated_at
FROM   up_users
WHERE  email = 'cms-admin@vbsf.local';


-- =============================================================================
-- LƯU Ý
--
-- * Chạy trong transaction nếu DBMS hỗ trợ (Postgres production):
--       BEGIN;  ... UPDATE ...  -- kiểm tra số dòng bị ảnh hưởng = 1
--       COMMIT;                 -- sai thì ROLLBACK;
--
-- * LUÔN có mệnh đề WHERE. Thiếu WHERE là đặt lại mật khẩu của TOÀN BỘ tài
--   khoản trong bảng, và không khôi phục lại được vì hash cũ đã bị ghi đè.
--
-- * Không dùng lại một chuỗi hash cho nhiều người: ai biết mật khẩu đó sẽ vào
--   được tất cả các tài khoản dùng chung hash.
--
-- * Cách không cần SQL (ưu tiên dùng khi được):
--     - Tài khoản CMS: vào CMS → Tài khoản CMS → biểu tượng 🔑 Đặt lại mật khẩu.
--     - Hội viên / đội: dùng chức năng "Quên mật khẩu" trên website.
--   SQL chỉ nên dùng khi hai đường trên không khả dụng (vd. mất tài khoản CMS
--   cuối cùng).
--
-- * Sau khi đặt lại, báo mật khẩu cho người dùng qua kênh riêng và yêu cầu đổi
--   lại ngay; mật khẩu do quản trị viên đặt thì quản trị viên cũng biết.
-- =============================================================================
