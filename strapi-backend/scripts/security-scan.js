'use strict';
/* =========================================================
   SECURITY SCAN — chạy trước khi build (npm run build gọi qua `prebuild`).

   Fail (exit 1) khi:
   - có lỗ hổng phụ thuộc mức high/critical chưa nằm trong allowlist đã rà soát,
   - allowlist có mục quá hạn rà soát,
   - phát hiện secret bị commit vào git,
   - có route công khai (auth:false) không gắn giới hạn tần suất.

   Cố tình KHÔNG có cờ bỏ qua: gate mà bỏ qua được thì không còn là gate.
   Run: node scripts/security-scan.js
   ========================================================= */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(ROOT, '..');
const BLOCKING = ['high', 'critical'];

const findings = [];
const notes = [];

function fail(check, message) {
  findings.push({ check, message });
}

/* ---------------- 1. Lỗ hổng trong phụ thuộc ---------------- */

function loadAllowlist() {
  const file = path.join(__dirname, 'security-allowlist.json');
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return parsed.advisories || [];
}

function auditDependencies() {
  let raw;
  try {
    // npm audit trả exit code khác 0 khi có lỗ hổng — vẫn phải đọc stdout.
    raw = execFileSync('npm', ['audit', '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (err) {
    raw = err.stdout;
    if (!raw) {
      fail('dependencies', 'không chạy được `npm audit` (mất mạng hoặc registry lỗi): ' + err.message);
      return;
    }
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch (err) {
    fail('dependencies', 'không đọc được kết quả npm audit: ' + err.message);
    return;
  }

  const allowlist = loadAllowlist();
  const allowedIds = new Set();
  const today = new Date().toISOString().slice(0, 10);

  allowlist.forEach((entry) => {
    if (!entry.id || !entry.reason || !entry.reviewBy) {
      fail('allowlist', 'mục ngoại lệ thiếu id/reason/reviewBy: ' + JSON.stringify(entry));
      return;
    }
    if (entry.reviewBy < today) {
      fail('allowlist', `ngoại lệ ${entry.id} (${entry.package}) đã quá hạn rà soát ${entry.reviewBy} — rà soát lại hoặc gỡ bỏ`);
      return;
    }
    allowedIds.add(entry.id);
    notes.push(`ngoại lệ đã rà soát: ${entry.id} (${entry.package}) — hạn rà soát lại ${entry.reviewBy}`);
  });

  const counts = (report.metadata && report.metadata.vulnerabilities) || {};
  notes.push(
    'npm audit: ' + BLOCKING.concat(['moderate', 'low']).map((s) => `${s}=${counts[s] || 0}`).join(' · ')
  );

  Object.entries(report.vulnerabilities || {}).forEach(([name, info]) => {
    if (!BLOCKING.includes(info.severity)) return;

    // `via` liệt kê từng advisory cụ thể; chỉ chặn advisory chưa được rà soát.
    const advisories = (info.via || []).filter((v) => typeof v === 'object' && BLOCKING.includes(v.severity));
    const unreviewed = advisories.filter((v) => !allowedIds.has(ghsaOf(v.url)));

    if (!advisories.length) {
      // Gói bị đánh dấu high do phụ thuộc bắc cầu; chặn trừ khi cả chuỗi đã được rà soát.
      const parents = (info.via || []).filter((v) => typeof v === 'string');
      const allParentsAllowed = parents.length > 0 && parents.every((p) => isPackageAllowed(allowlist, p));
      if (!allParentsAllowed) {
        fail('dependencies', `${name}: mức ${info.severity} (bắc cầu qua ${parents.join(', ') || 'không rõ'})`);
      }
      return;
    }

    unreviewed.forEach((v) => {
      fail('dependencies', `${name}: ${v.severity} — ${v.title} (${v.url})`);
    });
  });
}

function ghsaOf(url) {
  const match = String(url || '').match(/(GHSA-[a-z0-9-]+)/i);
  return match ? match[1] : null;
}

function isPackageAllowed(allowlist, pkg) {
  return allowlist.some((entry) => entry.package === pkg);
}

/* ---------------- 2. Secret bị commit ---------------- */

const SECRET_PATTERNS = [
  { name: 'khoá riêng tư (PEM)', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitHub fine-grained token', re: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'chuỗi kết nối có mật khẩu', re: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s:@/]+@/ },
];

/* File có secret giả/mẫu — quét nội dung nhưng bỏ qua giá trị placeholder. */
const PLACEHOLDER = /^(changeme[\w-]*|placeholder\w*|example\w*|x{3,}|your[-_]?\w*|<[^>]+>|test-secret[\w-]*|local[A-Za-z]*)$/i;

const WALK_SKIP = new Set(['node_modules', '.git', '.tmp', 'dist', 'build', '.cache', 'uploads', '.strapi']);

/** Duyệt cây thư mục khi không có git (vd. bên trong build context của Docker). */
function walk(dir, base, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (WALK_SKIP.has(entry.name)) return;
    const abs = path.join(dir, entry.name);
    const rel = base ? base + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walk(abs, rel, out);
    else if (entry.isFile()) out.push(rel);
  });
  return out;
}

/* Ưu tiên danh sách file do git quản lý (đúng trọng tâm: cái gì đã commit).
   Trong image Docker không có .git nên lùi về duyệt thư mục. */
function trackedFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], {
      cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { files: out.split('\0').filter(Boolean), fromGit: true };
  } catch (err) {
    return { files: walk(ROOT, path.basename(ROOT), []), fromGit: false };
  }
}

const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.woff', '.woff2', '.zip']);

function scanSecrets(files) {
  let scanned = 0;
  files.forEach((rel) => {
    if (SKIP_EXT.has(path.extname(rel).toLowerCase())) return;
    if (rel.endsWith('package-lock.json')) return;
    const abs = path.join(REPO_ROOT, rel);
    let text;
    try {
      const stat = fs.statSync(abs);
      if (stat.size > 2 * 1024 * 1024) return;
      text = fs.readFileSync(abs, 'utf8');
    } catch (err) {
      return;
    }
    scanned++;
    SECRET_PATTERNS.forEach((p) => {
      const hit = text.match(p.re);
      if (hit) fail('secrets', `${rel}: nghi có ${p.name} (${hit[0].slice(0, 24)}…)`);
    });

    // Biến môi trường nhạy cảm gán giá trị thật ngay trong file được commit.
    if (/\.env($|\.)/.test(path.basename(rel))) {
      text.split('\n').forEach((line, i) => {
        const m = line.match(/^\s*([A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|KEY|SALT)[A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
        if (!m) return;
        const value = m[2].replace(/^['"]|['"]$/g, '');
        // APP_KEYS là danh sách ngăn bởi dấu phẩy — placeholder khi MỌI phần đều là placeholder.
        const parts = value.split(',').map((v) => v.trim()).filter(Boolean);
        if (!parts.length || parts.every((v) => PLACEHOLDER.test(v))) return;
        fail('secrets', `${rel}:${i + 1}: ${m[1]} có vẻ là giá trị thật, không phải placeholder`);
      });
    }
  });
  notes.push(`đã quét ${scanned} file trong git để tìm secret`);
}

/* File môi trường thật không được lọt vào repo (git) lẫn vào image (Docker
   context) — cả hai đều làm secret đi xa khỏi máy người vận hành. */
function checkEnvNotTracked(files, fromGit) {
  const where = fromGit ? 'bị commit vào git' : 'có mặt trong build context';
  files
    .filter((f) => /(^|\/)\.env$/.test(f) || /(^|\/)\.env\.(local|production)$/.test(f))
    .forEach((f) => fail('secrets', `${f} ${where} — file môi trường phải nằm ngoài repo và ngoài image`));
}

/* ---------------- 3. Bất biến của route công khai ---------------- */

function checkPublicRoutes() {
  const routeFiles = [
    'src/api/member/routes/member-auth.js',
    'src/api/member-org/routes/member-org-auth.js',
  ];
  let checked = 0;
  routeFiles.forEach((rel) => {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return fail('routes', rel + ': không tìm thấy file route');
    delete require.cache[require.resolve(abs)];
    const mod = require(abs);
    (mod.routes || []).forEach((r) => {
      checked++;
      if (r.config && r.config.auth === false) {
        const mws = (r.config && r.config.middlewares) || [];
        if (!mws.length) fail('routes', `${r.method} ${r.path}: route công khai nhưng KHÔNG có giới hạn tần suất`);
      }
    });
  });
  notes.push(`đã kiểm tra ${checked} route công khai đều có giới hạn tần suất`);
}

/* ---------------- chạy ---------------- */

(function main() {
  console.log('SECURITY SCAN — chặn build nếu có lỗ hổng high/critical\n');

  auditDependencies();
  const listing = trackedFiles();
  if (!listing.fromGit) notes.push('không có git ở context này — quét theo thư mục thay vì danh sách file đã commit');
  scanSecrets(listing.files);
  checkEnvNotTracked(listing.files, listing.fromGit);
  checkPublicRoutes();

  notes.forEach((n) => console.log('  · ' + n));

  if (!findings.length) {
    console.log('\nSECURITY SCAN PASSED — không có vấn đề high/critical.');
    return;
  }

  console.error('\nSECURITY SCAN FAILED — ' + findings.length + ' vấn đề:');
  findings.forEach((f) => console.error(`  [${f.check}] ${f.message}`));
  console.error('\nSửa lỗ hổng, hoặc nếu thực sự không vá được thì thêm mục đã rà soát');
  console.error('vào scripts/security-allowlist.json (bắt buộc có lý do và hạn rà soát lại).');
  process.exit(1);
})();
