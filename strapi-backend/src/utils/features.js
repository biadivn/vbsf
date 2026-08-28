'use strict';
/* Cờ bật/tắt tính năng của site public.

   ĐẶT LẠI MẬT KHẨU đang TẮT vì hệ thống chưa có máy chủ email — bật lên mà
   không gửi được mail thì người dùng bấm "Gửi mã đặt lại", nhận thông báo thành
   công, rồi chờ mãi một email không bao giờ tới.

   Mặc định là TẮT (fail-closed): thiếu biến môi trường thì coi như chưa sẵn sàng.

   ĐỂ BẬT LẠI KHI ĐÃ CÓ EMAIL SERVER — cần đủ 3 việc:
     1. Cấu hình provider email cho Strapi (config/plugins.js) và kiểm thử gửi thật.
     2. Đặt PASSWORD_RESET_ENABLED=true trong .env của server.
     3. Đặt passwordReset: true trong site-js/config.js (phần giao diện).
   Thiếu bước 3 thì link "Quên mật khẩu?" vẫn ẩn; thiếu bước 2 thì bấm vào sẽ 404. */

/** Route quên/đặt lại mật khẩu chỉ được đăng ký khi cờ này bật. */
function passwordResetEnabled() {
  return String(process.env.PASSWORD_RESET_ENABLED || '').toLowerCase() === 'true';
}

/* Giá trị mặc định phía site (site-js/config.js) phải khớp với mặc định ở đây —
   có unit test canh việc này để hai bên không lệch nhau. */
const DEFAULTS = { passwordReset: false };

module.exports = { passwordResetEnabled, DEFAULTS };
