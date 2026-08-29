'use strict';
/* Đọc cấu hình khối mà CMS lưu trong `page-content`.

   Lỗi cũ: CMS ghi entry.content còn site đọc entry.values — không khớp, nên mọi
   thứ admin sửa trong module "Trang website" đều không tới trang thật mà cũng
   không báo lỗi gì. Test ở đây khoá lại đúng hình dạng CMS ghi ra; hai bên lệch
   nhau lần nữa thì test đỏ chứ không im lặng. */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const available = fs.existsSync(path.join(__dirname, '..', '..', 'site-js', 'page-config.js'));
const skip = available ? false : 'không có thư mục site-js trong context này';
const {
  sectionEntry, sectionHidden, pickItems, pickOne, contentValue,
} = available ? require('../../site-js/page-config') : {};

/** page-content đúng hình dạng Strapi trả về. */
function bundle(pageId, entries) {
  return { data: { pageSections: { [pageId]: entries } } };
}
const news = (n) => Array.from({ length: n }, (_, i) => ({ documentId: 'n' + (i + 1), title: 'Bài ' + (i + 1) }));
const titles = (list) => list.map((x) => x.title).join(',');

describe('sectionEntry', { skip }, () => {
  test('tìm đúng khối theo trang và khoá', () => {
    const pc = bundle('trang-chu', [{ key: 'a' }, { key: 'hero-banner', title: 'X' }]);
    assert.strictEqual(sectionEntry(pc, 'trang-chu', 'hero-banner').title, 'X');
  });

  test('thiếu dữ liệu ở bất kỳ tầng nào cũng trả null, không ném lỗi', () => {
    [null, undefined, {}, { data: null }, { data: {} }, { data: { pageSections: {} } }].forEach((pc) => {
      assert.strictEqual(sectionEntry(pc, 'trang-chu', 'hero-banner'), null, JSON.stringify(pc));
    });
    assert.strictEqual(sectionEntry(bundle('trang-chu', [{ key: 'a' }]), 'trang-chu', 'khong-co'), null);
    assert.strictEqual(sectionEntry(bundle('trang-chu', [{ key: 'a' }]), 'trang-khac', 'a'), null);
  });

  test('bỏ qua phần tử rỗng trong mảng', () => {
    const pc = bundle('trang-chu', [null, { key: 'hero-banner' }]);
    assert.ok(sectionEntry(pc, 'trang-chu', 'hero-banner'));
  });
});

describe('sectionHidden', { skip }, () => {
  test('chỉ enabled === false mới là tắt', () => {
    assert.strictEqual(sectionHidden({ enabled: false }), true);
    assert.strictEqual(sectionHidden({ enabled: true }), false);
    assert.strictEqual(sectionHidden({}), false, 'chưa cấu hình thì phải hiện');
    assert.strictEqual(sectionHidden(null), false);
  });
});

describe('pickItems', { skip }, () => {
  const all = news(6);

  test('chưa cấu hình gì thì lấy đủ số mặc định', () => {
    assert.strictEqual(titles(pickItems(null, all, 'newsIds', 3)), 'Bài 1,Bài 2,Bài 3');
  });

  test('chọn tay: đúng bản ghi và ĐÚNG THỨ TỰ admin sắp', () => {
    const e = { pickerMode: 'manual', newsIds: ['n4', 'n1', 'n5'] };
    assert.strictEqual(titles(pickItems(e, all, 'newsIds', 3)), 'Bài 4,Bài 1,Bài 5');
  });

  test('chọn tay nhiều/ít hơn mặc định đều giữ nguyên số đã chọn', () => {
    assert.strictEqual(pickItems({ pickerMode: 'manual', newsIds: ['n1'] }, all, 'newsIds', 3).length, 1);
    assert.strictEqual(pickItems({ pickerMode: 'manual', newsIds: ['n1', 'n2', 'n3', 'n4', 'n5'] }, all, 'newsIds', 3).length, 5);
  });

  test('id trỏ tới bản ghi đã xoá thì bỏ qua, không để lại ô trống', () => {
    const e = { pickerMode: 'manual', newsIds: ['n2', 'da-xoa', 'n3'] };
    const out = pickItems(e, all, 'newsIds', 3);
    assert.strictEqual(titles(out), 'Bài 2,Bài 3');
    assert.ok(out.every(Boolean));
  });

  test('chọn tay nhưng chưa chọn gì thì vẫn hiện bản mới nhất, không để khối trống', () => {
    assert.strictEqual(pickItems({ pickerMode: 'manual', newsIds: [] }, all, 'newsIds', 3).length, 3);
  });

  test('mọi id đã chọn đều không còn thì rơi về danh sách tự động', () => {
    assert.strictEqual(pickItems({ pickerMode: 'manual', newsIds: ['x', 'y'] }, all, 'newsIds', 2).length, 2);
  });

  test('chế độ tự động dùng autoCount thay cho số mặc định', () => {
    assert.strictEqual(pickItems({ pickerMode: 'auto', autoCount: 5 }, all, 'newsIds', 3).length, 5);
    assert.strictEqual(pickItems({ pickerMode: 'auto', autoCount: 1 }, all, 'newsIds', 3).length, 1);
  });

  test('chế độ tự động BỎ QUA danh sách đã chọn', () => {
    const e = { pickerMode: 'auto', autoCount: 2, newsIds: ['n6', 'n5'] };
    assert.strictEqual(titles(pickItems(e, all, 'newsIds', 3)), 'Bài 1,Bài 2');
  });

  test('autoCount vô lý thì rơi về số mặc định', () => {
    [0, -3, null, 'ba', undefined, NaN].forEach((c) => {
      assert.strictEqual(pickItems({ pickerMode: 'auto', autoCount: c }, all, 'newsIds', 3).length, 3, 'autoCount=' + String(c));
    });
  });

  test('chưa có dữ liệu thì trả mảng rỗng, không ném lỗi', () => {
    assert.deepStrictEqual(pickItems({ pickerMode: 'manual', newsIds: ['n1'] }, [], 'newsIds', 3), []);
    assert.deepStrictEqual(pickItems(null, null, 'newsIds', 3), []);
  });

  test('dùng chung được cho đối tác và giải đấu, không chỉ tin tức', () => {
    const partners = [{ documentId: 'p1', title: 'A' }, { documentId: 'p2', title: 'B' }];
    const e = { pickerMode: 'manual', partnerIds: ['p2'] };
    assert.strictEqual(titles(pickItems(e, partners, 'partnerIds', 5)), 'B');
  });
});

describe('pickOne', { skip }, () => {
  const tours = [{ documentId: 't1', name: 'Giải A' }, { documentId: 't2', name: 'Giải B' }];

  test('trả về bản ghi đã chọn', () => {
    assert.strictEqual(pickOne({ tournamentIds: ['t2'] }, tours, 'tournamentIds').name, 'Giải B');
  });

  test('chưa chọn / chọn bản ghi đã xoá / thiếu dữ liệu đều trả null', () => {
    assert.strictEqual(pickOne({ tournamentIds: [] }, tours, 'tournamentIds'), null);
    assert.strictEqual(pickOne({ tournamentIds: ['da-xoa'] }, tours, 'tournamentIds'), null);
    assert.strictEqual(pickOne(null, tours, 'tournamentIds'), null);
    assert.strictEqual(pickOne({ tournamentIds: ['t1'] }, null, 'tournamentIds'), null);
  });

  test('nhiều id thì lấy cái đầu tiên còn tồn tại', () => {
    assert.strictEqual(pickOne({ tournamentIds: ['da-xoa', 't1'] }, tours, 'tournamentIds').name, 'Giải A');
  });
});

describe('contentValue', { skip }, () => {
  test('ưu tiên chữ admin nhập', () => {
    assert.strictEqual(contentValue({ content: { title: 'Admin' } }, 'title', 'Suy ra'), 'Admin');
  });

  test('ô để trống thì dùng giá trị suy từ dữ liệu thật', () => {
    ['', '   ', null, undefined].forEach((v) => {
      assert.strictEqual(contentValue({ content: { title: v } }, 'title', 'Suy ra'), 'Suy ra', JSON.stringify(v));
    });
  });

  test('không có gì thì trả chuỗi rỗng để bên gọi giữ nguyên chữ tĩnh', () => {
    assert.strictEqual(contentValue(null, 'title'), '');
    assert.strictEqual(contentValue({}, 'title'), '');
    assert.strictEqual(contentValue({ content: {} }, 'title', null), '');
  });
});
