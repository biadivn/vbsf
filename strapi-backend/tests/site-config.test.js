'use strict';
/* site-js/config.js quyết định site public gọi Strapi ở đâu. Sai chỗ này thì
   TOÀN BỘ trang không có dữ liệu và không đăng nhập được — đúng sự cố đã xảy ra
   trên production: site tĩnh ở vbsf.biadi.vn nhưng Strapi lại nằm sau
   vbsf-cms.biadi.vn, trong khi mã cũ mặc định "cùng domain".

   File nằm ngoài build context của Docker nên thiếu thì bỏ qua. */
const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.join(__dirname, '..', '..', 'site-js', 'config.js');
const available = fs.existsSync(SOURCE);

/** Nạp lại module với location/window giả, trả về API để test. */
function load(locationStub, preset) {
  global.location = locationStub;
  global.window = preset === undefined ? {} : { VBSF_STRAPI_URL: preset };
  delete require.cache[require.resolve(SOURCE)];
  const mod = require(SOURCE);
  return { mod, resolved: global.window.VBSF_STRAPI_URL };
}

const https = (hostname) => ({ protocol: 'https:', hostname });

describe('site-js/config', { skip: available ? false : 'không có site-js/ trong build context' }, () => {
  afterEach(() => { delete global.location; delete global.window; });

  describe('production — hai domain tách biệt', () => {
    test('site public trỏ sang domain của Strapi, KHÔNG dùng đường dẫn tương đối', () => {
      const { resolved } = load(https('vbsf.biadi.vn'));
      assert.strictEqual(resolved, 'https://vbsf-cms.biadi.vn');
      assert.notStrictEqual(resolved, '', 'trỏ same-origin là lỗi đã gây sự cố production');
    });

    test('trang CMS dùng đường dẫn tương đối vì ở cùng domain với Strapi', () => {
      assert.strictEqual(load(https('vbsf-cms.biadi.vn')).resolved, '');
    });

    test('bảng ánh xạ khai báo đủ cả hai domain production', () => {
      const { mod } = load(https('vbsf.biadi.vn'));
      assert.deepStrictEqual(Object.keys(mod.STRAPI_BY_HOST).sort(), ['vbsf-cms.biadi.vn', 'vbsf.biadi.vn']);
    });
  });

  describe('môi trường phát triển', () => {
    test('localhost → Strapi ở cổng 1337', () => {
      assert.strictEqual(load({ protocol: 'http:', hostname: 'localhost' }).resolved, 'http://localhost:1337');
    });

    test('127.0.0.1 → cổng 1337', () => {
      assert.strictEqual(load({ protocol: 'http:', hostname: '127.0.0.1' }).resolved, 'http://localhost:1337');
    });

    test('mở thẳng file:// → cổng 1337', () => {
      assert.strictEqual(load({ protocol: 'file:', hostname: '' }).resolved, 'http://localhost:1337');
    });
  });

  describe('ghi đè và domain lạ', () => {
    test('window.VBSF_STRAPI_URL đặt sẵn thì được tôn trọng', () => {
      assert.strictEqual(load(https('vbsf.biadi.vn'), 'https://staging.example.vn').resolved, 'https://staging.example.vn');
    });

    test('ghi đè bằng chuỗi rỗng (same-origin) cũng được tôn trọng', () => {
      assert.strictEqual(load(https('vbsf.biadi.vn'), '').resolved, '');
    });

    test('domain chưa khai báo → đoán theo quy ước vbsf-cms.<domain gốc>', () => {
      assert.strictEqual(load(https('preview.biadi.vn')).resolved, 'https://vbsf-cms.biadi.vn');
      assert.strictEqual(load(https('vbsf.example.com')).resolved, 'https://vbsf-cms.example.com');
    });

    test('giữ nguyên giao thức của trang khi đoán', () => {
      assert.strictEqual(load({ protocol: 'http:', hostname: 'vbsf.test.vn' }).resolved, 'http://vbsf-cms.test.vn');
    });

    test('hostname một nhãn (không có dấu chấm) → same-origin', () => {
      assert.strictEqual(load(https('intranet')).resolved, '');
    });
  });

  describe('hợp đồng với hai module dùng nó', () => {
    test('luôn trả về chuỗi để module con nối trực tiếp vào URL', () => {
      ['vbsf.biadi.vn', 'vbsf-cms.biadi.vn', 'localhost', 'intranet', 'la.example.com'].forEach((h) => {
        const { resolved } = load(https(h));
        assert.strictEqual(typeof resolved, 'string', h + ' trả về không phải chuỗi');
        assert.ok(!resolved.endsWith('/'), h + ': không được có dấu / ở cuối, module con tự nối "/api/..."');
      });
    });
  });
});
