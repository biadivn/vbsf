'use strict';
/* =========================================================
   IMPORT — đưa bài viết từ trang Facebook của Liên đoàn vào mục Tin tức.

   Khác với scripts/seed.js và scripts/migrate-website-content.js (chạy
   trong tiến trình Strapi, ghi thẳng vào DB), script này nói chuyện với
   Strapi qua REST bằng API token, nên chạy được từ xa — kể cả khi Strapi
   nằm trên domain khác (cms.vbsf.vn).

   Facebook không cho đọc bài của trang khi chưa đăng nhập, nên script
   KHÔNG tự lấy bài. Nguồn vào là một file JSON do người chạy chuẩn bị
   (xuất từ Graph API, hoặc chép tay từ trang).

   Chuẩn bị:
     export STRAPI_URL=https://cms.vbsf.vn
     export STRAPI_TOKEN=<API token có quyền create/update news-article>

   Run:
     node scripts/import-facebook-news.js posts.json              # tạo bài còn thiếu
     node scripts/import-facebook-news.js posts.json --update     # ghi đè bài đã có
     node scripts/import-facebook-news.js posts.json --dry-run    # chỉ in kế hoạch
     node scripts/import-facebook-news.js posts.json --limit=5    # chỉ lấy 5 bài đầu
     node scripts/import-facebook-news.js posts.json --draft      # để nháp, không publish

   Định dạng posts.json — một mảng, mỗi phần tử là một bài:
     [
       {
         "title":    "Tiêu đề bài viết",          // bắt buộc
         "date":     "2026-10-28",                 // YYYY-MM-DD
         "category": "Hoạt động VBSF",             // xem CATEGORIES bên dưới
         "author":   "VBSF",
         "excerpt":  "Tóm tắt ngắn hiện ở thẻ tin",
         "content":  "Nội dung đầy đủ, xuống dòng bằng \n",
         "featured": false,
         "imageUrl": "https://.../anh.jpg",        // tuỳ chọn, script tự tải & upload
         "sourceUrl":"https://facebook.com/..."    // tuỳ chọn, gắn vào cuối nội dung
       }
     ]

   Bài được upsert theo *tiêu đề* nên chạy lại nhiều lần không tạo bản trùng.
   ========================================================= */
const fs = require('fs');
const path = require('path');

/* Phải KHỚP với enum của field category trong
   src/api/news-article/content-types/news-article/schema.json */
const CATEGORIES = ['Hoạt động VBSF', 'Giải đấu', 'Đào tạo', 'Trong nước', 'Quốc tế'];
const DEFAULT_CATEGORY = 'Hoạt động VBSF';
const DEFAULT_AUTHOR = 'VBSF';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const UPDATE = argv.includes('--update');
const DRAFT = argv.includes('--draft');
const limitArg = argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.slice('--limit='.length)) : null;
const FILE = argv.find((a) => !a.startsWith('--'));

const STRAPI_URL = (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/+$/, '');
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '';

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function authHeaders(extra) {
  const h = Object.assign({}, extra || {});
  if (STRAPI_TOKEN) h.Authorization = `Bearer ${STRAPI_TOKEN}`;
  return h;
}

async function api(method, pathname, body) {
  const res = await fetch(`${STRAPI_URL}${pathname}`, {
    method,
    headers: authHeaders(body ? { 'Content-Type': 'application/json' } : undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status} ${res.statusText}\n${text.slice(0, 600)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Tải ảnh theo URL rồi đẩy vào media library, trả về id của file. */
async function uploadImage(imageUrl, title) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`tải ảnh thất bại: ${res.status} ${imageUrl}`);

  const type = res.headers.get('content-type') || 'image/jpeg';
  if (!type.startsWith('image/')) throw new Error(`URL không phải ảnh (${type}): ${imageUrl}`);

  const ext = (type.split('/')[1] || 'jpg').split(';')[0].replace('jpeg', 'jpg');
  const name = `${slugify(title) || 'tin-tuc'}.${ext}`;
  const blob = new Blob([await res.arrayBuffer()], { type });

  const form = new FormData();
  form.append('files', blob, name);

  const up = await fetch(`${STRAPI_URL}/api/upload`, { method: 'POST', headers: authHeaders(), body: form });
  const text = await up.text();
  if (!up.ok) throw new Error(`upload ảnh → ${up.status} ${up.statusText}\n${text.slice(0, 600)}`);

  const files = JSON.parse(text);
  return Array.isArray(files) && files[0] ? files[0].id : null;
}

function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Lấy ~40 từ đầu làm excerpt khi bài không tự khai. */
function autoExcerpt(content) {
  const flat = String(content || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= 200) return flat;
  return `${flat.slice(0, 200).replace(/\s+\S*$/, '')}…`;
}

/** Bài Facebook thường không có tiêu đề riêng — lấy dòng đầu làm tiêu đề. */
function firstLine(content) {
  const line = String(content || '').split('\n').map((s) => s.trim()).find(Boolean) || '';
  return line.length > 160 ? `${line.slice(0, 160).replace(/\s+\S*$/, '')}…` : line;
}

function normalise(post, index) {
  const title = (post.title || firstLine(post.content) || '').trim();
  if (!title) throw new Error(`bài #${index + 1}: thiếu cả title lẫn content, không suy ra được tiêu đề`);

  const category = post.category || DEFAULT_CATEGORY;
  if (!CATEGORIES.includes(category)) {
    throw new Error(`bài #${index + 1} ("${title}"): category "${category}" không hợp lệ.\n  Hợp lệ: ${CATEGORIES.join(' | ')}`);
  }

  if (post.date && !/^\d{4}-\d{2}-\d{2}$/.test(post.date)) {
    throw new Error(`bài #${index + 1} ("${title}"): date "${post.date}" phải theo dạng YYYY-MM-DD`);
  }

  let content = String(post.content || '').trim();
  if (post.sourceUrl) content += `\n\nNguồn: ${post.sourceUrl}`;

  return {
    title,
    category,
    date: post.date || null,
    author: post.author || DEFAULT_AUTHOR,
    featured: post.featured === true,
    excerpt: (post.excerpt || autoExcerpt(post.content)).trim() || null,
    content: content || null,
    metaTitle: post.metaTitle || title,
    metaDescription: post.metaDescription || (post.excerpt || autoExcerpt(post.content)).trim() || null,
    _imageUrl: post.imageUrl || null,
  };
}

async function findByTitle(title) {
  const q = new URLSearchParams();
  q.set('filters[title][$eq]', title);
  q.set('pagination[pageSize]', '1');
  /* Strapi 5: mọi document đều có bản draft, nên hỏi status=draft là tìm được
     cả bài đang nháp lẫn bài đã publish (status=published sẽ bỏ sót bài nháp). */
  q.set('status', 'draft');
  const out = await api('GET', `/api/news-articles?${q.toString()}`);
  return out && out.data && out.data[0] ? out.data[0] : null;
}

(async () => {
  if (!FILE) die('Thiếu file JSON.\n  node scripts/import-facebook-news.js posts.json [--update] [--dry-run] [--limit=N] [--draft]');

  const abs = path.resolve(FILE);
  if (!fs.existsSync(abs)) die(`Không tìm thấy file: ${abs}`);

  let posts;
  try {
    posts = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    die(`File JSON không đọc được: ${err.message}`);
  }
  if (!Array.isArray(posts)) die('File JSON phải là một mảng các bài viết.');
  if (LIMIT != null) {
    if (!Number.isInteger(LIMIT) || LIMIT < 1) die('--limit phải là số nguyên ≥ 1');
    posts = posts.slice(0, LIMIT);
  }
  if (!posts.length) die('Không có bài nào để import.');

  if (!DRY_RUN && !STRAPI_TOKEN) {
    die('Thiếu STRAPI_TOKEN.\n  export STRAPI_TOKEN=<API token có quyền create/update news-article>');
  }

  /* Dừng ngay nếu có bài sai định dạng — không import nửa vời. */
  let items;
  try {
    items = posts.map(normalise);
  } catch (err) {
    die(`Dữ liệu vào không hợp lệ:\n  ${err.message}`);
  }

  console.log('IMPORT Tin tức từ Facebook');
  console.log(`  nguồn:   ${abs}`);
  console.log(`  strapi:  ${STRAPI_URL}`);
  console.log(`  chế độ:  ${DRY_RUN ? 'DRY RUN — không ghi dữ liệu' : UPDATE ? 'CREATE + UPDATE' : 'CREATE (bỏ qua bài đã có)'}${DRAFT ? ' · để nháp' : ''}`);
  console.log(`  số bài:  ${items.length}`);
  console.log('');

  let created = 0, updated = 0, skipped = 0, failed = 0;

  for (const item of items) {
    const { _imageUrl, ...data } = item;
    try {
      const existing = await findByTitle(data.title);

      if (existing && !UPDATE) {
        console.log(`  bỏ qua   ${data.title}  (đã có — thêm --update để ghi đè)`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  ${existing ? 'sẽ ghi đè' : 'sẽ tạo  '} ${data.title}${_imageUrl ? '  + ảnh' : ''}`);
        existing ? updated++ : created++;
        continue;
      }

      if (_imageUrl) {
        const id = await uploadImage(_imageUrl, data.title);
        if (id) data.image = id;
      }

      const query = DRAFT ? '' : '?status=published';
      if (existing) {
        await api('PUT', `/api/news-articles/${existing.documentId}${query}`, { data });
        console.log(`  ghi đè   ${data.title}`);
        updated++;
      } else {
        await api('POST', `/api/news-articles${query}`, { data });
        console.log(`  tạo      ${data.title}`);
        created++;
      }
    } catch (err) {
      console.error(`  LỖI      ${data.title}\n           ${err.message.split('\n').join('\n           ')}`);
      failed++;
    }
  }

  console.log('');
  console.log(`Xong: tạo ${created} · ghi đè ${updated} · bỏ qua ${skipped} · lỗi ${failed}`);
  if (failed) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
