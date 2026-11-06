'use strict';
/* Tệp PDF "Xác nhận của địa phương" đính kèm đơn đăng ký giải của đội.

   Site public không có quyền gọi upload của Strapi, nên tệp đi kèm trong JSON
   dưới dạng data URI rồi máy chủ tự kiểm tra và lưu vào thư viện media. Kiểm
   tra theo NỘI DUNG (đầu tệp phải là %PDF), không tin đuôi tên hay kiểu MIME do
   trình duyệt khai — nếu không thì ai cũng gắn được tệp bất kỳ vào đơn. */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAX_BYTES = 5 * 1024 * 1024;

/** Trả { buffer, name } hoặc { error }. */
function parsePdfUpload(input) {
  if (!input || typeof input !== 'object' || typeof input.data !== 'string') {
    return { error: 'Vui lòng đính kèm file PDF xác nhận của địa phương.' };
  }
  const m = /^data:application\/pdf;base64,([A-Za-z0-9+/=\s]+)$/.exec(input.data);
  if (!m) return { error: 'File xác nhận của địa phương phải là PDF.' };
  const buffer = Buffer.from(m[1], 'base64');
  if (buffer.length > MAX_BYTES) return { error: 'File PDF quá lớn (tối đa 5MB).' };
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return { error: 'File xác nhận của địa phương phải là PDF.' };
  }
  let name = path.basename(String(input.name || '')).replace(/[\r\n"\\\u0000-\u001f\u007f]/g, '').trim();
  if (!/\.pdf$/i.test(name)) name = (name || 'xac-nhan-dia-phuong') + '.pdf';
  return { buffer, name: name.slice(0, 120) };
}

/** Lưu vào thư viện media, trả id tệp. */
async function uploadPdf(strapi, parsed) {
  const tmp = path.join(os.tmpdir(), `xn-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(tmp, parsed.buffer);
  try {
    const [file] = await strapi.plugin('upload').service('upload').upload({
      data: { fileInfo: { name: parsed.name } },
      files: { filepath: tmp, originalFilename: parsed.name, mimetype: 'application/pdf', size: parsed.buffer.length },
    });
    return file.id;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

module.exports = { MAX_BYTES, parsePdfUpload, uploadPdf };
