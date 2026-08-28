'use strict';
/* 3 form công khai trên site ghi thẳng vào CSDL nên đây là bề mặt tấn công: test
   khoá lại việc chỉ nhận đúng field cho phép, ép trạng thái mặc định, và cắt
   chuỗi quá dài. */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const forms = require('../src/utils/public-forms');
const { createMockStrapi, createMockCtx } = require('./helpers/mock-strapi');

const CONTACT = 'api::contact-message.contact-message';
const REG = 'api::tournament-registration.tournament-registration';
const CLAIM = 'api::payment-claim.payment-claim';

function seed() {
  global.strapi = createMockStrapi({ [CONTACT]: [], [REG]: [], [CLAIM]: [] });
  return global.strapi;
}

/** Gọi handler, trả về { ctx, row } với row là bản ghi vừa tạo (nếu có). */
async function submit(handler, uid, body) {
  const ctx = createMockCtx({ body });
  await handler(ctx);
  const rows = global.strapi._tables[uid] || [];
  return { ctx, row: rows[rows.length - 1] };
}

describe('public-forms: tiện ích', () => {
  test('text() cắt chuỗi và bỏ khoảng trắng thừa', () => {
    assert.strictEqual(forms.text('  xin chào  ', 100), 'xin chào');
    assert.strictEqual(forms.text('x'.repeat(5000), 10).length, 10);
    assert.strictEqual(forms.text(null), '');
    assert.strictEqual(forms.text(undefined), '');
  });

  test('text() mặc định cắt ở 500 ký tự', () => {
    assert.strictEqual(forms.text('y'.repeat(900)).length, 500);
  });

  test('isEmail() nhận đúng và loại sai', () => {
    ['a@b.vn', 'ten.ho+1@vbsf.org.vn'].forEach((e) => assert.ok(forms.isEmail(e), e));
    ['', 'a@b', 'a b@c.vn', '@b.vn', 'a@.vn', 'khong-phai-email'].forEach((e) => assert.ok(!forms.isEmail(e), e));
  });

  test('normalizePhone() chỉ giữ chữ số', () => {
    assert.strictEqual(forms.normalizePhone('090 123 4567'), '0901234567');
    assert.strictEqual(forms.normalizePhone('+84-90.123'), '8490123');
    assert.strictEqual(forms.normalizePhone(null), '');
  });
});

describe('public-forms: Liên hệ', () => {
  beforeEach(seed);

  test('thiếu họ tên / email / nội dung đều bị từ chối', async () => {
    for (const body of [
      {}, { name: 'A' }, { name: 'A', email: 'a@b.vn' }, { email: 'a@b.vn', message: 'x' },
    ]) {
      const { ctx } = await submit(forms.contactMessage, CONTACT, body);
      assert.strictEqual(ctx._error.status, 400, JSON.stringify(body));
      assert.strictEqual(global.strapi._tables[CONTACT].length, 0);
    }
  });

  test('email sai định dạng bị từ chối', async () => {
    const { ctx } = await submit(forms.contactMessage, CONTACT, { name: 'A', email: 'sai', message: 'x' });
    assert.match(ctx._error.message, /Email không hợp lệ/);
  });

  test('hợp lệ: tạo bản ghi và trả thông báo', async () => {
    const { ctx, row } = await submit(forms.contactMessage, CONTACT, {
      name: '  Nguyễn Văn A  ', email: 'a@b.vn', phone: '090 123 4567',
      subject: 'Hợp tác', message: 'Nội dung',
    });
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(ctx.body.ok, true);
    assert.ok(ctx.body.id);
    assert.match(ctx.body.message, /Đã gửi liên hệ/);
    assert.strictEqual(row.name, 'Nguyễn Văn A');
    assert.strictEqual(row.phone, '0901234567');
  });

  test('KHÔNG cho client tự đặt handled = true', async () => {
    const { row } = await submit(forms.contactMessage, CONTACT, {
      name: 'A', email: 'a@b.vn', message: 'x', handled: true,
    });
    assert.strictEqual(row.handled, false);
  });

  test('field lạ bị bỏ qua, không ghi vào CSDL', async () => {
    const { row } = await submit(forms.contactMessage, CONTACT, {
      name: 'A', email: 'a@b.vn', message: 'x', createdBy: 999, id: 1, publishedAt: '2020-01-01',
    });
    assert.ok(!('createdBy' in row));
    assert.ok(!('publishedAt' in row));
  });

  test('nội dung dài bị cắt thay vì nhét nguyên vào CSDL', async () => {
    const { row } = await submit(forms.contactMessage, CONTACT, {
      name: 'A', email: 'a@b.vn', message: 'z'.repeat(9000),
    });
    assert.strictEqual(row.message.length, 4000);
  });

  test('trường tuỳ chọn để trống thì không lưu chuỗi rỗng', async () => {
    const { row } = await submit(forms.contactMessage, CONTACT, { name: 'A', email: 'a@b.vn', message: 'x' });
    assert.strictEqual(row.phone, undefined);
    assert.strictEqual(row.subject, undefined);
  });
});

describe('public-forms: Đăng ký thi đấu', () => {
  beforeEach(seed);

  test('thiếu tên giải / cơ thủ / điện thoại đều bị từ chối', async () => {
    for (const body of [
      {}, { tournamentName: 'G' }, { tournamentName: 'G', playerName: 'P' }, { playerName: 'P', phone: '0901234567' },
    ]) {
      const { ctx } = await submit(forms.tournamentRegistration, REG, body);
      assert.strictEqual(ctx._error.status, 400, JSON.stringify(body));
    }
    assert.strictEqual(global.strapi._tables[REG].length, 0);
  });

  test('số điện thoại sai định dạng bị từ chối', async () => {
    const { ctx } = await submit(forms.tournamentRegistration, REG, {
      tournamentName: 'G', playerName: 'P', phone: '12345',
    });
    assert.match(ctx._error.message, /điện thoại không hợp lệ/);
  });

  test('hợp lệ: trạng thái luôn là pending', async () => {
    const { ctx, row } = await submit(forms.tournamentRegistration, REG, {
      tournamentName: 'Cúp X', playerName: 'Cơ thủ Y', phone: '091 234 5678',
      memberCode: 'VBSF-2026-00098', club: 'CLB Z', note: 'ghi chú',
    });
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.phone, '0912345678');
    assert.strictEqual(row.memberCode, 'VBSF-2026-00098');
  });

  test('KHÔNG cho client tự đặt status = confirmed', async () => {
    const { row } = await submit(forms.tournamentRegistration, REG, {
      tournamentName: 'G', playerName: 'P', phone: '0901234567', status: 'confirmed',
    });
    assert.strictEqual(row.status, 'pending');
  });

  test('mã hội viên để trống thì không lưu chuỗi rỗng', async () => {
    const { row } = await submit(forms.tournamentRegistration, REG, {
      tournamentName: 'G', playerName: 'P', phone: '0901234567',
    });
    assert.strictEqual(row.memberCode, undefined);
    assert.strictEqual(row.club, undefined);
  });
});

describe('public-forms: Báo đã chuyển khoản', () => {
  beforeEach(seed);

  test('thiếu nội dung chuyển khoản bị từ chối', async () => {
    const { ctx } = await submit(forms.paymentClaim, CLAIM, { kind: 'gia-han' });
    assert.strictEqual(ctx._error.status, 400);
    assert.match(ctx._error.message, /nội dung chuyển khoản/i);
  });

  test('hợp lệ: trạng thái luôn là pending', async () => {
    const { ctx, row } = await submit(forms.paymentClaim, CLAIM, {
      kind: 'gia-han', memberCode: 'VBSF-2026-00098', transferNote: 'GIAHAN-VBSF-2026-00098',
      amount: '500.000đ', phone: '0901234567', payerName: 'Nguyễn A',
    });
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.kind, 'gia-han');
  });

  test('kind lạ bị ép về "dang-ky" thay vì làm hỏng enum', async () => {
    const { row } = await submit(forms.paymentClaim, CLAIM, { kind: 'kieu-la', transferNote: 'X' });
    assert.strictEqual(row.kind, 'dang-ky');
  });

  test('KHÔNG cho client tự đặt status = matched', async () => {
    const { row } = await submit(forms.paymentClaim, CLAIM, { transferNote: 'X', status: 'matched' });
    assert.strictEqual(row.status, 'pending');
  });
});
