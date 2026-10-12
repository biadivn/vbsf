'use strict';
/* Tạo hash bcrypt cho một mật khẩu — dùng khi phải đặt mật khẩu thẳng trong DB
   (SQL không tự băm được). Cost 10, đúng mức Strapi dùng khi tự hash.

   Dùng:  node scripts/hash-password.js 'MatKhauMuonDat'
   Rồi dán chuỗi kết quả vào câu UPDATE/INSERT cột `password`. */

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error("Dùng: node scripts/hash-password.js 'MatKhauMuonDat'");
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 10));
