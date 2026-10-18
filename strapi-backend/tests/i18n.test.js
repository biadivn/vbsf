'use strict';
/* Song ngữ Việt – Anh của site public.

   Hai thứ phải khoá lại ở đây:

   1. Tra từ điển KHÔNG được nuốt chữ. Chuỗi không có bản dịch phải đi qua
      nguyên văn — đó là đường của tên người, tên tỉnh, mã hội viên và mọi nội
      dung do CMS nhập. Hỏng chỗ này là trang tiếng Anh mất chữ chứ không báo gì.

   2. Phủ bản dịch lên dữ liệu CMS phải BỎ QUA ô trống. Biên tập viên hay lưu
      bản dịch nửa chừng; nếu ô rỗng cũng ghi đè thì trang tiếng Anh hiện ô
      trắng thay vì giữ bản tiếng Việt. */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const available = fs.existsSync(path.join(__dirname, '..', '..', 'site-js', 'i18n.js'));
const skip = available ? false : 'không có thư mục site-js trong context này';
const {
  VBSF_LANGS, VBSF_DEFAULT_LANG, VBSF_DICT_EN,
  normalizeLang, translateUi, enFields,
  overlayRecord, overlayList, overlaySection, overlayData,
} = available ? require('../../site-js/i18n') : {};

describe('normalizeLang', { skip }, () => {
  test('nhận đúng hai ngôn ngữ site có', () => {
    assert.strictEqual(normalizeLang('vi'), 'vi');
    assert.strictEqual(normalizeLang('en'), 'en');
    assert.deepStrictEqual(VBSF_LANGS, ['vi', 'en']);
    assert.strictEqual(VBSF_DEFAULT_LANG, 'vi');
  });

  test('bỏ hoa thường và khoảng trắng', () => {
    assert.strictEqual(normalizeLang(' EN '), 'en');
    assert.strictEqual(normalizeLang('Vi'), 'vi');
  });

  test('cắt đuôi vùng để dùng được với navigator.language', () => {
    assert.strictEqual(normalizeLang('en-US'), 'en');
    assert.strictEqual(normalizeLang('vi-VN'), 'vi');
  });

  test('giá trị lạ hoặc rỗng rơi về tiếng Việt', () => {
    ['', null, undefined, 'fr', 'xx-YY', 0, {}].forEach((v) => {
      assert.strictEqual(normalizeLang(v), 'vi');
    });
  });
});

describe('translateUi', { skip }, () => {
  test('tiếng Việt thì trả nguyên văn, không tra từ điển', () => {
    assert.strictEqual(translateUi('Trang chủ', 'vi'), 'Trang chủ');
  });

  test('có trong từ điển thì dịch', () => {
    assert.strictEqual(translateUi('Trang chủ', 'en'), 'Home');
    assert.strictEqual(translateUi('Giải đấu', 'en'), 'Tournaments');
  });

  test('KHÔNG có trong từ điển thì giữ nguyên — tên riêng, mã số, dữ liệu CMS', () => {
    ['Nguyễn Phúc Long', 'VBSF-2026-00098', 'CLB Meow Billiards', '12/06/2026']
      .forEach((s) => assert.strictEqual(translateUi(s, 'en'), s));
  });

  test('giữ khoảng trắng hai đầu của chuỗi gốc', () => {
    assert.strictEqual(translateUi('  Trang chủ ', 'en'), '  Home ');
  });

  test('chuỗi rỗng / null đi qua không đổi', () => {
    assert.strictEqual(translateUi('', 'en'), '');
    assert.strictEqual(translateUi('   ', 'en'), '   ');
    assert.strictEqual(translateUi(null, 'en'), null);
    assert.strictEqual(translateUi(undefined, 'en'), undefined);
  });

  test('từ điển không có khoá nào rỗng hoặc trùng chính nó một cách vô nghĩa', () => {
    Object.keys(VBSF_DICT_EN).forEach((k) => {
      assert.ok(k.trim().length > 0, 'khoá rỗng trong từ điển');
      assert.strictEqual(k, k.trim(), `khoá còn khoảng trắng thừa: ${JSON.stringify(k)}`);
      assert.ok(String(VBSF_DICT_EN[k]).trim().length > 0, `bản dịch rỗng cho: ${k}`);
    });
  });
});

describe('enFields', { skip }, () => {
  test('không có i18n thì null', () => {
    assert.strictEqual(enFields({ title: 'A' }), null);
    assert.strictEqual(enFields({ title: 'A', i18n: {} }), null);
    assert.strictEqual(enFields({ title: 'A', i18n: { en: 'không phải object' } }), null);
    assert.strictEqual(enFields(null), null);
  });

  test('bỏ ô trống, giữ ô có chữ', () => {
    const out = enFields({ i18n: { en: { a: 'A', b: '', c: '   ', d: null, e: [], f: ['x'], g: 0 } } });
    assert.deepStrictEqual(out, { a: 'A', f: ['x'], g: 0 });
  });

  test('toàn ô trống thì coi như chưa dịch', () => {
    assert.strictEqual(enFields({ i18n: { en: { a: '', b: null } } }), null);
  });
});

describe('overlayRecord', { skip }, () => {
  const rec = { title: 'Tin tiếng Việt', excerpt: 'Tóm tắt', date: '2026-06-02', i18n: { en: { title: 'English news' } } };

  test('tiếng Việt: trả về chính bản ghi, không sao chép', () => {
    assert.strictEqual(overlayRecord(rec, 'vi'), rec);
  });

  test('tiếng Anh: field có bản dịch bị thay, field khác giữ nguyên', () => {
    const out = overlayRecord(rec, 'en');
    assert.strictEqual(out.title, 'English news');
    assert.strictEqual(out.excerpt, 'Tóm tắt');
    assert.strictEqual(out.date, '2026-06-02');
  });

  test('không sửa bản ghi gốc', () => {
    overlayRecord(rec, 'en');
    assert.strictEqual(rec.title, 'Tin tiếng Việt');
  });

  test('chưa dịch gì thì trả về chính bản ghi', () => {
    const plain = { title: 'A' };
    assert.strictEqual(overlayRecord(plain, 'en'), plain);
  });

  test('bản ghi rỗng không làm vỡ', () => {
    assert.strictEqual(overlayRecord(null, 'en'), null);
  });
});

describe('overlayList', { skip }, () => {
  test('phủ từng phần tử', () => {
    const list = [
      { title: 'Một', i18n: { en: { title: 'One' } } },
      { title: 'Hai' },
    ];
    const out = overlayList(list, 'en');
    assert.deepStrictEqual(out.map((r) => r.title), ['One', 'Hai']);
  });

  test('tiếng Việt hoặc không phải mảng thì trả nguyên', () => {
    const list = [{ title: 'Một' }];
    assert.strictEqual(overlayList(list, 'vi'), list);
    assert.strictEqual(overlayList(null, 'en'), null);
  });
});

describe('overlaySection', { skip }, () => {
  const entry = {
    key: 'bo-mon',
    title: 'Billiards & Snooker',
    backgroundImage: '/uploads/vi.png',
    content: { paragraph: 'Đoạn tiếng Việt', visionText: 'Tầm nhìn' },
    items: [
      { name: 'Pool', desc: 'Mô tả Pool', image: '/uploads/pool-vi.png' },
      { name: 'Carom', desc: 'Mô tả Carom' },
    ],
    i18n: {
      en: {
        title: 'Cue sports',
        backgroundImage: '/uploads/en.png',
        content: { paragraph: 'English paragraph', visionText: '' },
        items: [{ desc: 'Pool description', image: '/uploads/pool-en.png' }, null],
      },
    },
  };

  test('phủ tiêu đề, ảnh nền và từng ô trong content', () => {
    const out = overlaySection(entry, 'en');
    assert.strictEqual(out.title, 'Cue sports');
    assert.strictEqual(out.backgroundImage, '/uploads/en.png');
    assert.strictEqual(out.content.paragraph, 'English paragraph');
  });

  test('ô dịch bỏ trống thì giữ bản tiếng Việt', () => {
    const out = overlaySection(entry, 'en');
    assert.strictEqual(out.content.visionText, 'Tầm nhìn');
  });

  test('phủ theo đúng vị trí từng mục, mục chưa dịch giữ nguyên', () => {
    const out = overlaySection(entry, 'en');
    assert.strictEqual(out.items[0].name, 'Pool');               // chưa dịch tên
    assert.strictEqual(out.items[0].desc, 'Pool description');   // đã dịch mô tả
    assert.strictEqual(out.items[0].image, '/uploads/pool-en.png');
    assert.strictEqual(out.items[1].desc, 'Mô tả Carom');
  });

  test('không sửa khối gốc', () => {
    overlaySection(entry, 'en');
    assert.strictEqual(entry.title, 'Billiards & Snooker');
    assert.strictEqual(entry.items[0].desc, 'Mô tả Pool');
  });

  test('tiếng Việt, khối rỗng, hoặc chưa dịch thì trả nguyên', () => {
    assert.strictEqual(overlaySection(entry, 'vi'), entry);
    assert.strictEqual(overlaySection(null, 'en'), null);
    const plain = { key: 'x', title: 'Y' };
    assert.strictEqual(overlaySection(plain, 'en'), plain);
  });

  test('items dịch mà khối gốc không có items thì bỏ qua, không dựng mảng lạ', () => {
    const out = overlaySection({ key: 'x', i18n: { en: { items: [{ name: 'A' }] } } }, 'en');
    assert.strictEqual(out.items, undefined);
  });
});

describe('overlayData', { skip }, () => {
  function bundle() {
    return {
      news: [{ title: 'Tin', i18n: { en: { title: 'News' } } }],
      tournaments: [{ name: 'Giải', i18n: { en: { name: 'Cup' } } }],
      partners: [{ name: 'Đối tác' }],
      libraryDocs: [{ title: 'Văn bản', i18n: { en: { title: 'Document' } } }],
      mediaItems: [{ title: 'Album' }],
      leaders: [{ role: 'Chủ tịch', i18n: { en: { role: 'President' } } }],
      members: [{ name: 'Nguyễn Phúc Long' }],
      settings: { orgName: 'Liên đoàn', i18n: { en: { orgName: 'Federation' } } },
      contact: { hours: 'Thứ 2 – Thứ 6', i18n: { en: { hours: 'Mon – Fri' } } },
      pageContent: {
        data: {
          pageMeta: { 'gioi-thieu': { name: 'Giới thiệu' } },
          pageSections: {
            'gioi-thieu': [{ key: 'a', title: 'Về Liên đoàn', i18n: { en: { title: 'About us' } } }],
          },
        },
      },
    };
  }

  test('phủ hết các danh sách, singleton và khối của trang', () => {
    const out = overlayData(bundle(), 'en');
    assert.strictEqual(out.news[0].title, 'News');
    assert.strictEqual(out.tournaments[0].name, 'Cup');
    assert.strictEqual(out.libraryDocs[0].title, 'Document');
    assert.strictEqual(out.leaders[0].role, 'President');
    assert.strictEqual(out.settings.orgName, 'Federation');
    assert.strictEqual(out.contact.hours, 'Mon – Fri');
    assert.strictEqual(out.pageContent.data.pageSections['gioi-thieu'][0].title, 'About us');
  });

  test('phần chưa dịch và phần không thuộc diện dịch giữ nguyên', () => {
    const out = overlayData(bundle(), 'en');
    assert.strictEqual(out.partners[0].name, 'Đối tác');
    assert.strictEqual(out.members[0].name, 'Nguyễn Phúc Long');
    assert.deepStrictEqual(out.pageContent.data.pageMeta, { 'gioi-thieu': { name: 'Giới thiệu' } });
  });

  test('không sửa gói dữ liệu gốc', () => {
    const data = bundle();
    overlayData(data, 'en');
    assert.strictEqual(data.news[0].title, 'Tin');
    assert.strictEqual(data.pageContent.data.pageSections['gioi-thieu'][0].title, 'Về Liên đoàn');
  });

  test('tiếng Việt hoặc dữ liệu rỗng thì trả nguyên', () => {
    const data = bundle();
    assert.strictEqual(overlayData(data, 'vi'), data);
    assert.strictEqual(overlayData(null, 'en'), null);
  });

  test('gói thiếu pageContent vẫn chạy', () => {
    const out = overlayData({ news: [] }, 'en');
    assert.deepStrictEqual(out.news, []);
    assert.strictEqual(out.pageContent, undefined);
  });

  test('pageSections có giá trị lạ thì để nguyên, không vỡ', () => {
    const out = overlayData({ pageContent: { data: { pageSections: { x: 'không phải mảng' } } } }, 'en');
    assert.strictEqual(out.pageContent.data.pageSections.x, 'không phải mảng');
  });
});
