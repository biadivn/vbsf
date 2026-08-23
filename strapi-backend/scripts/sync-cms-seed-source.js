'use strict';
/* Đồng bộ lại bản sao vendored của cms-js/seed-data.js + database-queries.js
   (scripts/cms-seed-source/) từ nguồn gốc ../../cms-js — chạy khi seed data
   phía CMS thay đổi. Cần chạy TRƯỚC khi build Docker image nếu có cập nhật.
   Run: node scripts/sync-cms-seed-source.js */
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', '..', 'cms-js');
const targetDir = path.join(__dirname, 'cms-seed-source');
const files = ['seed-data.js', 'database-queries.js'];

fs.mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
  console.log(`synced ${file}`);
}
