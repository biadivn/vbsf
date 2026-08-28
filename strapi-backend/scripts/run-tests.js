'use strict';
/* =========================================================
   UNIT TEST + NGƯỠNG COVERAGE — chạy trước khi build.

   Dùng test runner có sẵn của Node (`node:test`), không thêm phụ thuộc nào.
   Build fail nếu line/branch/function coverage tụt xuống dưới 80%.

   Ngưỡng được ép theo TỪNG FILE (không phải trung bình toàn bộ): một module tệ
   không thể nấp sau các module tốt. Số liệu đọc từ báo cáo lcov của chính test
   runner. Mọi file trong phạm vi cũng bắt buộc phải xuất hiện trong báo cáo —
   xoá test đi thì file tụt về 0% chứ không lặng lẽ biến mất khỏi phép đo.
   (Cờ --test-coverage-include-all làm được việc này nhưng chỉ có từ Node 26,
   trong khi CI và image Docker chạy Node 24.)

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
const os = require('node:os');
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

/* Mỗi mục là đường dẫn file, hoặc thư mục kèm '/*.js'. Đường dẫn bắt đầu bằng
   '../' nằm ngoài build context của Docker — thiếu thì bỏ qua. */
const COVERAGE_SCOPE = [
  'src/utils/*.js',
  'src/api/member/controllers/*.js',
  'src/api/member-org/controllers/*.js',
  'src/api/member/routes/member-auth.js',
  'src/api/member-org/routes/member-org-auth.js',
  'scripts/website-content.js',
  '../site-js/config.js',
  '../site-js/member-auth.js',
  '../cms-js/tournament-seeding.js',
];

function expand(pattern) {
  if (!pattern.endsWith('/*.js')) {
    return fs.existsSync(path.join(ROOT, pattern)) ? [pattern] : [];
  }
  const dir = pattern.slice(0, -'/*.js'.length);
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith('.js')).sort().map((f) => dir + '/' + f);
}

/* lcov ghi SF: theo đường dẫn tương đối so với cwd; chuẩn hoá để so khớp. */
function normalize(p) {
  return p.split(path.sep).join('/').replace(/^\.\//, '');
}

function parseLcov(text) {
  const files = {};
  let current = null;
  text.split('\n').forEach((line) => {
    const [key, value] = line.split(':');
    if (key === 'SF') {
      current = { path: normalize(value), lf: 0, lh: 0, brf: 0, brh: 0, fnf: 0, fnh: 0 };
      files[current.path] = current;
    } else if (current && ['LF', 'LH', 'BRF', 'BRH', 'FNF', 'FNH'].includes(key)) {
      current[key.toLowerCase()] = Number(value) || 0;
    }
  });
  return files;
}

/** Không có nhánh/hàm nào thì coi như phủ 100% — không có gì để phủ. */
function percent(hit, found) {
  return found === 0 ? 100 : (hit / found) * 100;
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

const expected = COVERAGE_SCOPE.flatMap(expand);
const skipped = COVERAGE_SCOPE.filter((p) => expand(p).length === 0);
if (skipped.length) {
  console.log('Bỏ khỏi phạm vi coverage (không có trong context này): ' + skipped.join(', ') + '\n');
}
if (!expected.length) {
  console.error('Phạm vi coverage rỗng — kiểm tra lại COVERAGE_SCOPE.');
  process.exit(1);
}

const lcovFile = path.join(os.tmpdir(), `vbsf-coverage-${process.pid}.info`);
const args = [
  '--test',
  '--experimental-test-coverage',
  // Ngưỡng tổng của chính runner — lớp chặn đầu tiên; kiểm tra theo từng file ở dưới.
  `--test-coverage-lines=${THRESHOLD}`,
  `--test-coverage-branches=${THRESHOLD}`,
  `--test-coverage-functions=${THRESHOLD}`,
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=lcov', `--test-reporter-destination=${lcovFile}`,
].concat(
  expected.map((p) => `--test-coverage-include=${p}`),
  testFiles
);

const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });

if (result.status !== 0) {
  fs.rmSync(lcovFile, { force: true });
  console.error(`\nUNIT TEST FAILED — test hỏng hoặc coverage tổng dưới ${THRESHOLD}%.`);
  process.exit(result.status || 1);
}

if (!fs.existsSync(lcovFile)) {
  console.error('\nUNIT TEST FAILED — không sinh được báo cáo lcov để kiểm tra ngưỡng theo file.');
  process.exit(1);
}

const report = parseLcov(fs.readFileSync(lcovFile, 'utf8'));
fs.rmSync(lcovFile, { force: true });

const rows = [];
const problems = [];

expected.forEach((rel) => {
  const key = normalize(rel);
  const file = report[key];
  if (!file) {
    problems.push(`${rel}: không có trong báo cáo coverage (test nào nạp module này đã bị xoá?)`);
    rows.push({ rel, lines: 0, branches: 0, functions: 0 });
    return;
  }
  const lines = percent(file.lh, file.lf);
  const branches = percent(file.brh, file.brf);
  const functions = percent(file.fnh, file.fnf);
  rows.push({ rel, lines, branches, functions });

  [['line', lines], ['branch', branches], ['function', functions]].forEach(([label, value]) => {
    if (value < THRESHOLD) problems.push(`${rel}: ${label} coverage ${value.toFixed(2)}% < ${THRESHOLD}%`);
  });
});

const width = Math.max(...rows.map((r) => r.rel.length));
console.log(`\nCoverage theo từng file (ngưỡng ${THRESHOLD}%):`);
console.log(`  ${'file'.padEnd(width)} |  line  | branch |  func`);
rows.forEach((r) => {
  const flag = [r.lines, r.branches, r.functions].some((v) => v < THRESHOLD) ? ' <-- dưới ngưỡng' : '';
  console.log(
    `  ${r.rel.padEnd(width)} | ${r.lines.toFixed(2).padStart(6)} | ${r.branches.toFixed(2).padStart(6)} | ${r.functions.toFixed(2).padStart(6)}${flag}`
  );
});

if (problems.length) {
  console.error('\nUNIT TEST FAILED — coverage không đạt:');
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}

console.log(`\nUNIT TEST PASSED — mọi file trong phạm vi đều đạt ngưỡng ${THRESHOLD}%.`);
