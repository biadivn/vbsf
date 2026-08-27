'use strict';
/* =========================================================
   UNIT TEST + NGƯỠNG COVERAGE — chạy trước khi build.

   Dùng test runner có sẵn của Node (`node:test`), không thêm phụ thuộc nào.
   Build fail nếu line/branch/function coverage của các module dưới đây tụt
   xuống dưới 80%.

   PHẠM VI ĐO COVERAGE (cố ý liệt kê tường minh, không đo cả repo):
   các module logic thuần chạy được ngoài trình duyệt — xác thực, giới hạn tần
   suất, đặt lại mật khẩu, lọc dữ liệu riêng tư, dữ liệu migration, và module
   auth phía site. KHÔNG nằm trong phạm vi: mã cần DOM thật
   (site-js/strapi-content.js, cms-js/, JS nội tuyến trong index.html) và phần
   khung do Strapi sinh — chúng được kiểm bằng test end-to-end trên trình duyệt,
   không phải unit test. Xem README để biết chi tiết.
   ========================================================= */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const THRESHOLD = 80;

/* Các cờ --test-coverage-* chỉ có từ Node 22.9. Runtime của Strapi vẫn chạy
   được trên Node 20 nên không siết `engines`; chỉ chặn đúng lúc chạy gate. */
const MIN_NODE = [22, 9];
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
  console.error(
    `Cần Node >= ${MIN_NODE.join('.')} để chạy gate coverage (đang dùng ${process.versions.node}).`
  );
  process.exit(1);
}

const COVERAGE_INCLUDE = [
  'src/utils/*.js',
  'src/api/member/controllers/*.js',
  'src/api/member-org/controllers/*.js',
  'src/api/member/routes/member-auth.js',
  'src/api/member-org/routes/member-org-auth.js',
  'scripts/website-content.js',
  // Nằm ngoài build context của Docker — khi thiếu thì bỏ qua (xem bên dưới).
  '../site-js/member-auth.js',
];

function existsRelative(pattern) {
  if (!pattern.startsWith('../')) return true;
  return fs.existsSync(path.join(ROOT, pattern));
}

const testFiles = fs
  .readdirSync(path.join(ROOT, 'tests'))
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f))
  .sort();

if (!testFiles.length) {
  console.error('Không tìm thấy file test nào trong tests/ — coverage sẽ không có ý nghĩa.');
  process.exit(1);
}

const includes = COVERAGE_INCLUDE.filter(existsRelative);
const skipped = COVERAGE_INCLUDE.filter((p) => !existsRelative(p));
if (skipped.length) {
  console.log('Bỏ khỏi phạm vi coverage (không có trong context này): ' + skipped.join(', ') + '\n');
}

const args = [
  '--test',
  '--experimental-test-coverage',
  // Tính cả file chưa hề được nạp — xoá test đi thì coverage tụt, không thể
  // "đạt ngưỡng" bằng cách lặng lẽ bỏ bớt test.
  '--test-coverage-include-all',
  `--test-coverage-lines=${THRESHOLD}`,
  `--test-coverage-branches=${THRESHOLD}`,
  `--test-coverage-functions=${THRESHOLD}`,
].concat(includes.map((p) => `--test-coverage-include=${p}`), testFiles);

const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });

if (result.status !== 0) {
  console.error(`\nUNIT TEST FAILED — test hỏng hoặc coverage dưới ${THRESHOLD}%.`);
  process.exit(result.status || 1);
}
console.log(`\nUNIT TEST PASSED — coverage đạt ngưỡng ${THRESHOLD}%.`);
