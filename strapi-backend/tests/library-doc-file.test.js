'use strict';
/* Tệp đính kèm của "Văn bản & Luật".

   Đây là bề mặt tấn công: tên tệp và đuôi tệp do người tải lên đặt, rồi được
   ghép thẳng vào header Content-Disposition và Content-Type. Test khoá lại ba
   bất biến:
   - API công khai KHÔNG được rò đường dẫn /uploads (mất lớp chống crawl chính)
   - tên tệp không chèn được thêm header
   - đuôi lạ không được trả về kiểu nội dung mà trình duyệt tự diễn giải */
const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  CONTENT_TYPES, DEFAULT_CONTENT_TYPE, ALLOWED_EXTENSIONS,
  contentTypeFor, isAllowedExtension, safeFileName, downloadPath, publicDoc,
} = require('../src/utils/library-doc-file');

const media = (over) => Object.assign({
  url: '/uploads/quy_che_a1b2c3.pdf', name: 'quy-che.pdf', ext: '.pdf', size: 1234, hash: 'quy_che_a1b2c3',
}, over);
const doc = (over) => Object.assign({ documentId: 'abc123', title: 'Quy chế', file: media() }, over);

describe('contentTypeFor / isAllowedExtension', () => {
  test('các đuôi tài liệu hợp lệ trả đúng kiểu', () => {
    assert.strictEqual(contentTypeFor('.pdf'), 'application/pdf');
    assert.match(contentTypeFor('.docx'), /wordprocessingml/);
    assert.match(contentTypeFor('.xlsx'), /spreadsheetml/);
  });

  test('không phân biệt hoa thường', () => {
    assert.strictEqual(contentTypeFor('.PDF'), 'application/pdf');
    assert.ok(isAllowedExtension('.DOCX'));
  });

  test('đuôi có thể chạy được trong trình duyệt KHÔNG nằm trong danh sách', () => {
    ['.html', '.htm', '.svg', '.js', '.xhtml', '.php', '.exe', '.sh'].forEach((e) => {
      assert.ok(!isAllowedExtension(e), e + ' phải bị từ chối');
      assert.strictEqual(contentTypeFor(e), DEFAULT_CONTENT_TYPE, e);
    });
  });

  test('đuôi rỗng / không phải chuỗi rơi về octet-stream và bị từ chối', () => {
    [null, undefined, '', 0, {}].forEach((e) => {
      assert.strictEqual(contentTypeFor(e), DEFAULT_CONTENT_TYPE, String(e));
      assert.ok(!isAllowedExtension(e), String(e));
    });
  });

  test('danh sách cho phép khớp đúng bảng kiểu nội dung', () => {
    assert.deepStrictEqual(ALLOWED_EXTENSIONS.slice().sort(), Object.keys(CONTENT_TYPES).sort());
    assert.ok(ALLOWED_EXTENSIONS.every((e) => e.startsWith('.')));
  });
});

describe('safeFileName', () => {
  test('giữ nguyên tên tệp bình thường, kể cả tiếng Việt', () => {
    assert.strictEqual(safeFileName('quy-che-2026.pdf'), 'quy-che-2026.pdf');
    assert.strictEqual(safeFileName('Quy chế thi đấu.pdf'), 'Quy chế thi đấu.pdf');
  });

  test('bỏ mọi thành phần đường dẫn', () => {
    assert.strictEqual(safeFileName('../../etc/passwd'), 'passwd');
    assert.strictEqual(safeFileName('/var/www/secret.pdf'), 'secret.pdf');
    assert.strictEqual(safeFileName('a/b/c/d.pdf'), 'd.pdf');
  });

  test('bỏ ký tự chèn được header hoặc phá dấu nháy', () => {
    // Không có \r\n thì không tự thêm được header vào phản hồi.
    assert.ok(!/[\r\n"\\]/.test(safeFileName('x"\r\nX-Evil: 1.pdf')));
    assert.ok(!/[\r\n]/.test(safeFileName('a\nb.pdf')));
  });

  test('bỏ ký tự điều khiển', () => {
    assert.strictEqual(safeFileName('a\u0000b\u001fc.pdf'), 'abc.pdf');
  });

  test('tên rỗng hoặc chỉ có đường dẫn thì dùng tên dự phòng', () => {
    assert.strictEqual(safeFileName('', 'tai-lieu.pdf'), 'tai-lieu.pdf');
    assert.strictEqual(safeFileName(null, 'tai-lieu.pdf'), 'tai-lieu.pdf');
    assert.strictEqual(safeFileName('   '), 'tai-lieu');
    assert.strictEqual(safeFileName('/'), 'tai-lieu');
  });
});

describe('downloadPath', () => {
  test('trỏ vào endpoint riêng, không phải /uploads', () => {
    assert.strictEqual(downloadPath('abc123'), '/api/library-docs/abc123/download');
    assert.ok(downloadPath('abc123').indexOf('uploads') < 0);
  });

  test('documentId được mã hoá URL', () => {
    assert.strictEqual(downloadPath('a b/c'), '/api/library-docs/a%20b%2Fc/download');
  });

  test('thiếu id vẫn trả chuỗi, không ném lỗi', () => {
    assert.strictEqual(downloadPath(null), '/api/library-docs//download');
  });
});

describe('publicDoc: bản ghi trả cho người đọc ẩn danh', () => {
  test('KHÔNG còn đối tượng media và KHÔNG rò /uploads', () => {
    const out = publicDoc(doc());
    assert.strictEqual(out.file, undefined);
    assert.ok(JSON.stringify(out).indexOf('uploads') < 0, 'vẫn còn đường dẫn uploads');
    assert.ok(JSON.stringify(out).indexOf('a1b2c3') < 0, 'vẫn còn hash tệp');
  });

  test('có tệp: trả hasFile + downloadUrl + dung lượng', () => {
    const out = publicDoc(doc());
    assert.strictEqual(out.hasFile, true);
    assert.strictEqual(out.downloadUrl, '/api/library-docs/abc123/download');
    assert.strictEqual(out.fileSizeKb, 1234);
  });

  test('chưa đính tệp: hasFile false và KHÔNG có downloadUrl', () => {
    [doc({ file: null }), doc({ file: undefined }), doc({ file: {} })].forEach((d) => {
      const out = publicDoc(d);
      assert.strictEqual(out.hasFile, false);
      assert.strictEqual(out.downloadUrl, undefined);
    });
  });

  test('giữ nguyên các field hiển thị của tài liệu', () => {
    const out = publicDoc(doc({ title: 'Luật Pool', tag: 'Luật', fileType: 'PDF', size: '1,2 MB' }));
    assert.strictEqual(out.title, 'Luật Pool');
    assert.strictEqual(out.tag, 'Luật');
    assert.strictEqual(out.fileType, 'PDF');
    assert.strictEqual(out.size, '1,2 MB');
  });

  test('thiếu dung lượng thì không bịa ra fileSizeKb', () => {
    const out = publicDoc(doc({ file: media({ size: null }) }));
    assert.strictEqual(out.hasFile, true);
    assert.strictEqual(out.fileSizeKb, undefined);
  });

  test('bản ghi rỗng đi qua nguyên vẹn, không ném lỗi', () => {
    assert.strictEqual(publicDoc(null), null);
    assert.strictEqual(publicDoc(undefined), undefined);
  });

  test('gọi hai lần vẫn cho kết quả như một lần (danh sách bị map lặp không hỏng)', () => {
    const d = doc();
    const once = JSON.stringify(publicDoc(d));
    const twice = JSON.stringify(publicDoc(d));
    assert.strictEqual(once, twice);
  });
});
