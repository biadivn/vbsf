'use strict';
/* Thêm VĐV vào đội từ CMS (modal "VĐV thuộc đội") + nhập cả danh sách từ tệp.

   Điều phải giữ: mã hội viên và hiệu lực hội viên do MÁY CHỦ soi lại theo CCCD,
   không bao giờ lấy theo request — nếu lấy theo request thì một bản ghi gõ tay
   có thể tự nhận `memberValid: true` và điều kiện "hội viên còn hiệu lực" của
   mục 2.1 thành vô nghĩa. */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const { createMockStrapi, createMockCtx, stubCoreControllerFactory } = require('./helpers/mock-strapi');

const UID = 'api::team-athlete.team-athlete';
const ORG_UID = 'api::member-org.member-org';
const MEMBER_UID = 'api::member.member';
const MODULE = '../src/api/team-athlete/controllers/team-athlete';

let created;

function load() {
  created = [];
  stubCoreControllerFactory({
    async create(ctx) {
      created.push(JSON.parse(JSON.stringify(ctx.request.body.data)));
      return { data: { documentId: 'new1', ...ctx.request.body.data } };
    },
  });
  delete require.cache[require.resolve(MODULE)];
  return require(MODULE);
}

function seed() {
  global.strapi = createMockStrapi({
    [ORG_UID]: [{ documentId: 'o1', name: 'Đội Hà Nội', code: 'VBSF-TC-2026-001', province: 'Hà Nội' }],
    [MEMBER_UID]: [
      { documentId: 'm1', code: 'VBSF-2026-00001', name: 'Hội viên còn hạn', cccd: '079098001234', phone: '0909123456', status: 'active', expiry: '2099-12-31' },
      { documentId: 'm2', code: 'VBSF-2020-00002', name: 'Hội viên hết hạn', cccd: '079098005555', phone: '0909555555', status: 'active', expiry: '2020-12-31' },
    ],
    [UID]: [{ documentId: 'a1', teamDocId: 'o1', fullName: 'Có sẵn', cccd: '079098007777', status: 'confirmed' }],
  });
}

function body(over) {
  return { data: { teamDocId: 'o1', fullName: 'Nguyễn Văn A', cccd: '079098001234', phone: '0909123456', ...over } };
}

describe('team-athlete.create: kiểm tra đầu vào', () => {
  let controller;
  beforeEach(() => { seed(); controller = load(); });

  const cases = [
    ['chưa chọn tổ chức', body({ teamDocId: '' }), /Chưa chọn hội viên tổ chức/],
    ['đội không tồn tại', body({ teamDocId: 'khong-co' }), /Không tìm thấy hội viên tổ chức/],
    ['thiếu họ tên', body({ fullName: '  ' }), /Thiếu họ tên hoặc số căn cước/],
    ['thiếu căn cước', body({ cccd: '' }), /Thiếu họ tên hoặc số căn cước/],
    ['đã có trong đội', body({ cccd: '079098007777' }), /đã có trong danh sách đội/],
  ];

  cases.forEach(([name, reqBody, re]) => {
    test(name, async () => {
      const ctx = createMockCtx({ body: reqBody });
      await controller.create(ctx);
      assert.strictEqual(ctx._error.status, 400, name);
      assert.match(ctx._error.message, re);
      assert.strictEqual(created.length, 0, 'không được ghi gì khi đầu vào sai');
    });
  });

  test('bản ghi đã bỏ khỏi đội không tính là trùng — thêm lại được', async () => {
    global.strapi._tables[UID][0].status = 'removed';
    const ctx = createMockCtx({ body: body({ cccd: '079098007777' }) });
    await controller.create(ctx);
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(created.length, 1);
  });
});

describe('team-athlete.create: máy chủ tự gắn đội và hội viên', () => {
  let controller;
  beforeEach(() => { seed(); controller = load(); });

  test('gắn tên đội theo teamDocId, mã hội viên theo CCCD, trạng thái chờ xác nhận', async () => {
    await controller.create(createMockCtx({ body: body() }));
    assert.deepStrictEqual(created[0], {
      teamDocId: 'o1', teamName: 'Đội Hà Nội', fullName: 'Nguyễn Văn A',
      cccd: '079098001234', phone: '0909123456',
      memberCode: 'VBSF-2026-00001', memberValid: true, status: 'pending',
    });
  });

  test('hội viên hết hạn: vẫn gắn mã nhưng memberValid = false', async () => {
    await controller.create(createMockCtx({ body: body({ cccd: '079098005555' }) }));
    assert.strictEqual(created[0].memberCode, 'VBSF-2020-00002');
    assert.strictEqual(created[0].memberValid, false);
  });

  test('chưa là hội viên: mã rỗng, không chặn việc thêm vào đội', async () => {
    await controller.create(createMockCtx({ body: body({ cccd: '079098009999' }) }));
    assert.strictEqual(created[0].memberCode, '');
    assert.strictEqual(created[0].memberValid, false);
  });

  test('request tự khai mã hội viên / hiệu lực / tên đội đều bị ghi đè', async () => {
    await controller.create(createMockCtx({
      body: body({ memberCode: 'VBSF-BIA-00001', memberValid: true, teamName: 'Đội tự khai', cccd: '079098009999' }),
    }));
    assert.strictEqual(created[0].memberCode, '');
    assert.strictEqual(created[0].memberValid, false);
    assert.strictEqual(created[0].teamName, 'Đội Hà Nội');
  });

  test('CCCD gõ có dấu cách vẫn khớp đúng hội viên và được lưu dạng chuẩn hoá', async () => {
    await controller.create(createMockCtx({ body: body({ cccd: '079 098 001234' }) }));
    assert.strictEqual(created[0].cccd, '079098001234');
    assert.strictEqual(created[0].memberCode, 'VBSF-2026-00001');
  });

  test('vận hành chủ động chọn "đã xác nhận" thì giữ nguyên lựa chọn đó', async () => {
    await controller.create(createMockCtx({ body: body({ status: 'confirmed', cccd: '079098009999' }) }));
    assert.strictEqual(created[0].status, 'confirmed');
  });
});

describe('team-athlete.importRoster', () => {
  let controller;
  beforeEach(() => { seed(); controller = load(); });

  test('chưa chọn tổ chức / tổ chức không tồn tại', async () => {
    const empty = createMockCtx({ body: { athletes: [] } });
    await controller.importRoster(empty);
    assert.match(empty._error.message, /Chưa chọn hội viên tổ chức/);

    const missing = createMockCtx({ body: { teamDocId: 'khong-co', athletes: [] } });
    await controller.importRoster(missing);
    assert.match(missing._error.message, /Không tìm thấy hội viên tổ chức/);
  });

  test('tệp trống thì báo lỗi, không ghi gì', async () => {
    const ctx = createMockCtx({ body: { teamDocId: 'o1' } });
    await controller.importRoster(ctx);
    assert.match(ctx._error.message, /đang trống/);
    assert.strictEqual(global.strapi._tables[UID].length, 1);
  });

  test('nhập 2 dòng: một người đã là hội viên, một người được tạo hồ sơ mới', async () => {
    const ctx = createMockCtx({
      body: {
        teamDocId: 'o1',
        athletes: [
          { fullName: 'Hội viên còn hạn', cccd: '079098001234', phone: '0909123456' },
          { fullName: 'Người mới', cccd: '079098008888', phone: '0938111222', dob: '2001-02-03' },
        ],
      },
    });
    await controller.importRoster(ctx);
    assert.strictEqual(ctx._error, null);
    assert.strictEqual(ctx.body.ok, true);
    assert.strictEqual(ctx.body.summary.linked, 1);
    assert.strictEqual(ctx.body.summary.created, 1);
    assert.strictEqual(global.strapi._tables[UID].length, 3);

    const members = global.strapi._tables[MEMBER_UID];
    assert.strictEqual(members.length, 3);
    assert.strictEqual(members[2].name, 'Người mới');
    assert.strictEqual(members[2].club, 'Đội Hà Nội');
    assert.strictEqual(members[2].status, 'pending');
  });
});
