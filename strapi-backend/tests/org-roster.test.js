'use strict';
/* Nhập danh sách VĐV của một tổ chức + tạo hội viên cá nhân cho người chưa có
   hồ sơ. Hai thứ cần được giữ chặt ở đây:
   - không bao giờ tự đặt hiệu lực hội viên (mọi hồ sơ mới là 'pending'),
   - một dòng không tạo được hội viên thì vẫn phải vào danh sách của tổ chức,
     kèm lý do, chứ không làm đổ cả lượt nhập. */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const roster = require('../src/utils/org-roster');
const { createMockStrapi } = require('./helpers/mock-strapi');

const MEMBER_UID = 'api::member.member';
const TA_UID = 'api::team-athlete.team-athlete';

const ORG = { documentId: 'o1', name: 'Đội Hà Nội', province: 'Hà Nội' };
const NOW = new Date('2026-06-01T00:00:00Z');

function row(over) {
  return {
    fullName: 'Nguyễn Văn A', cccd: '079098001234', phone: '0909123456',
    dob: '1998-04-12', gender: 'Nam', address: 'Quận 1', ...over,
  };
}

describe('memberCodeSeries', () => {
  test('tiếp sau mã lớn nhất đang có, đủ số lượng yêu cầu', () => {
    const out = roster.memberCodeSeries(['VBSF-2026-00007', 'VBSF-2026-00002'], 'VBSF-2026-', 5, 3);
    assert.deepStrictEqual(out, ['VBSF-2026-00008', 'VBSF-2026-00009', 'VBSF-2026-00010']);
  });

  test('bỏ qua mã của năm khác và mã rỗng', () => {
    const out = roster.memberCodeSeries(['VBSF-2025-00099', null, '', 'VBSF-TC-2026-003'], 'VBSF-2026-', 5, 1);
    assert.deepStrictEqual(out, ['VBSF-2026-00001']);
  });

  test('không có mã nào / tham số không phải mảng thì bắt đầu từ 1', () => {
    assert.deepStrictEqual(roster.memberCodeSeries(null, 'VBSF-2026-', 5, 1), ['VBSF-2026-00001']);
    assert.deepStrictEqual(roster.memberCodeSeries([], 'VBSF-2026-', 5, 0), []);
  });
});

describe('planRosterImport: huỷ cả lượt', () => {
  test('tệp trống', () => {
    assert.match(roster.planRosterImport({ rows: [] }).error, /đang trống/);
    assert.match(roster.planRosterImport({}).error, /đang trống/);
  });

  test('quá số dòng cho phép', () => {
    const many = Array.from({ length: roster.MAX_ROWS + 1 }, () => row());
    assert.match(roster.planRosterImport({ rows: many }).error, /tối đa 300/);
  });

  test('dòng thiếu họ tên hoặc CCCD thì báo đúng số dòng', () => {
    assert.match(roster.planRosterImport({ rows: [row(), row({ fullName: '' })] }).error, /Dòng 2.*họ tên/);
    assert.match(roster.planRosterImport({ rows: [row({ cccd: '' })] }).error, /Dòng 1.*căn cước/);
  });
});

describe('planRosterImport: quyết định từng dòng', () => {
  test('khớp CCCD với hội viên còn hiệu lực thì chỉ gắn mã, không tạo mới', () => {
    const members = [{ code: 'VBSF-2024-00001', cccd: '079098001234', status: 'active', expiry: '2026-12-31' }];
    const { data } = roster.planRosterImport({ rows: [row()], members, now: NOW });
    assert.strictEqual(data.items[0].action, 'link');
    assert.strictEqual(data.items[0].memberCode, 'VBSF-2024-00001');
    assert.strictEqual(data.items[0].memberValid, true);
    assert.deepStrictEqual(
      { linked: data.summary.linked, created: data.summary.created, added: data.summary.added },
      { linked: 1, created: 0, added: 1 }
    );
  });

  test('hội viên hết hạn vẫn là "link" nhưng memberValid = false', () => {
    const members = [{ code: 'VBSF-2019-00001', cccd: '079098001234', status: 'active', expiry: '2020-12-31' }];
    const { data } = roster.planRosterImport({ rows: [row()], members, now: NOW });
    assert.strictEqual(data.items[0].action, 'link');
    assert.strictEqual(data.items[0].memberValid, false);
  });

  test('chưa có hội viên và dòng đủ dữ liệu thì tạo mới', () => {
    const { data } = roster.planRosterImport({ rows: [row()], members: [], now: NOW });
    assert.strictEqual(data.items[0].action, 'create');
    assert.strictEqual(data.summary.created, 1);
  });

  test('CCCD trùng nhau trong cùng tệp: chỉ nhận dòng đầu', () => {
    const { data } = roster.planRosterImport({
      rows: [row(), row({ fullName: 'Trùng người', phone: '0909000111' })], members: [], now: NOW,
    });
    assert.deepStrictEqual(data.items.map((i) => i.action), ['create', 'skip']);
    assert.match(data.items[1].reason, /trùng với một dòng phía trên/);
  });

  test('đã có trong danh sách của tổ chức thì bỏ qua, kể cả CCCD ghi khác dấu cách', () => {
    const squad = [{ cccd: '079 098 001234' }];
    const { data } = roster.planRosterImport({ rows: [row()], squad, members: [], now: NOW });
    assert.strictEqual(data.items[0].action, 'skip');
    assert.match(data.items[0].reason, /đã có trong danh sách/);
    assert.strictEqual(data.summary.added, 0);
  });

  const squadOnly = [
    ['thiếu số điện thoại', row({ phone: '' }), /thiếu số điện thoại/],
    ['SĐT sai định dạng', row({ phone: '12345' }), /không đúng định dạng/],
    ['CCCD sai định dạng', row({ cccd: 'ABC123' }), /căn cước không đúng định dạng/],
  ];
  squadOnly.forEach(([name, input, re]) => {
    test(`${name}: vào danh sách đội nhưng không tạo hội viên`, () => {
      const { data } = roster.planRosterImport({ rows: [input], members: [], now: NOW });
      assert.strictEqual(data.items[0].action, 'squad-only');
      assert.match(data.items[0].reason, re);
      assert.strictEqual(data.summary.added, 1);
      assert.strictEqual(data.summary.created, 0);
      assert.strictEqual(data.summary.squadOnly, 1);
    });
  });

  test('SĐT đã thuộc hội viên khác thì không tạo trùng (field phone là unique)', () => {
    const members = [{ code: 'VBSF-2024-00009', cccd: '001199000111', phone: '0909123456', status: 'active' }];
    const { data } = roster.planRosterImport({ rows: [row()], members, now: NOW });
    assert.strictEqual(data.items[0].action, 'squad-only');
    assert.match(data.items[0].reason, /đã thuộc một hội viên khác/);
  });

  test('hai dòng khác CCCD nhưng cùng SĐT: chỉ dòng đầu tạo được hội viên', () => {
    const { data } = roster.planRosterImport({
      rows: [row(), row({ cccd: '079098009999', fullName: 'Người thứ hai' })], members: [], now: NOW,
    });
    assert.deepStrictEqual(data.items.map((i) => i.action), ['create', 'squad-only']);
    assert.match(data.items[1].reason, /đã thuộc một hội viên khác/);
  });
});

describe('buildMemberDraft', () => {
  const PROVINCES = ['Hà Nội', 'TP.HCM'];

  test('gắn club = tên tổ chức, tỉnh theo tổ chức, trạng thái chờ hội phí', () => {
    const draft = roster.buildMemberDraft(row(), ORG, 'VBSF-2026-00001', PROVINCES);
    assert.deepStrictEqual(draft, {
      code: 'VBSF-2026-00001', name: 'Nguyễn Văn A', cccd: '079098001234', phone: '0909123456',
      dob: '1998-04-12', address: 'Quận 1', club: 'Đội Hà Nội', province: 'Hà Nội', status: 'pending',
    });
  });

  test('không ghi mật khẩu — hồ sơ nhập hộ không đăng nhập được cho tới khi Liên đoàn đặt', () => {
    assert.ok(!('password' in roster.buildMemberDraft(row(), ORG, 'VBSF-2026-00001', PROVINCES)));
  });

  test('tỉnh của tổ chức không nằm trong enum thì bỏ trống thay vì ghi giá trị Strapi sẽ chối', () => {
    const draft = roster.buildMemberDraft(row(), { name: 'CLB X', province: 'Tỉnh Lạ' }, 'c', PROVINCES);
    assert.strictEqual(draft.province, undefined);
    assert.strictEqual(draft.club, 'CLB X');
  });

  test('tổ chức rỗng / thiếu danh sách tỉnh thì không ném lỗi', () => {
    const draft = roster.buildMemberDraft(row({ dob: '', address: '' }), null, 'c');
    assert.strictEqual(draft.province, undefined);
    assert.strictEqual(draft.club, undefined);
    assert.strictEqual(draft.dob, undefined);
  });
});

describe('summaryMessage', () => {
  test('kể đủ các nhóm khi có thêm người', () => {
    const msg = roster.summaryMessage({ added: 4, created: 2, linked: 1, squadOnly: 1, skipped: 3 });
    assert.match(msg, /Đã thêm 4 vận động viên/);
    assert.match(msg, /tạo mới 2 hồ sơ hội viên/);
    assert.match(msg, /1 người đã là hội viên/);
    assert.match(msg, /1 người chưa tạo được hồ sơ/);
    assert.match(msg, /bỏ qua 3 dòng/);
  });

  test('không thêm được ai', () => {
    assert.match(roster.summaryMessage({ added: 0, skipped: 2 }), /Không thêm được ai.*2 dòng/);
    assert.match(roster.summaryMessage({ added: 0, skipped: 0 }), /Không thêm được vận động viên nào/);
    assert.match(roster.summaryMessage(null), /Không thêm được vận động viên nào/);
  });
});

describe('applyRosterImport: ghi thật vào CSDL giả', () => {
  let strapi;
  beforeEach(() => {
    strapi = createMockStrapi({
      [MEMBER_UID]: [
        { documentId: 'm1', code: 'VBSF-2026-00004', name: 'Đã là hội viên', cccd: '001199000111', phone: '0911000111', status: 'active', expiry: '2026-12-31' },
      ],
      [TA_UID]: [
        { documentId: 'a1', teamDocId: 'o1', fullName: 'Có sẵn', cccd: '079098007777', status: 'confirmed' },
      ],
    });
    global.strapi = strapi;
  });

  test('tạo hội viên mới + thêm vào danh sách tổ chức, mã chạy tiếp từ mã lớn nhất', async () => {
    const out = await roster.applyRosterImport(strapi, { org: ORG, rows: [row()], now: NOW });
    assert.ok(!out.error);

    const members = strapi._tables[MEMBER_UID];
    assert.strictEqual(members.length, 2);
    assert.strictEqual(members[1].code, 'VBSF-2026-00005');
    assert.strictEqual(members[1].status, 'pending');
    assert.strictEqual(members[1].club, 'Đội Hà Nội');

    const squad = strapi._tables[TA_UID];
    assert.strictEqual(squad.length, 2);
    assert.strictEqual(squad[1].teamDocId, 'o1');
    assert.strictEqual(squad[1].teamName, 'Đội Hà Nội');
    assert.strictEqual(squad[1].status, 'pending');
    assert.strictEqual(squad[1].memberCode, 'VBSF-2026-00005');
    // Hồ sơ vừa tạo chưa đóng hội phí -> chưa được coi là còn hiệu lực.
    assert.strictEqual(squad[1].memberValid, false);
    assert.strictEqual(out.data.summary.created, 1);
  });

  test('dòng khớp hội viên sẵn có: không tạo thêm hồ sơ, gắn đúng mã và hiệu lực', async () => {
    const out = await roster.applyRosterImport(strapi, {
      org: ORG, rows: [row({ cccd: '001199000111', phone: '0911000111' })], now: NOW,
    });
    assert.strictEqual(strapi._tables[MEMBER_UID].length, 1);
    const added = strapi._tables[TA_UID][1];
    assert.strictEqual(added.memberCode, 'VBSF-2026-00004');
    assert.strictEqual(added.memberValid, true);
    assert.strictEqual(out.data.summary.linked, 1);
  });

  test('người đã có trong danh sách tổ chức thì không ghi gì thêm', async () => {
    const out = await roster.applyRosterImport(strapi, {
      org: ORG, rows: [row({ cccd: '079098007777' })], now: NOW,
    });
    assert.strictEqual(strapi._tables[TA_UID].length, 1);
    assert.strictEqual(out.data.summary.skipped, 1);
    assert.match(out.data.message, /Không thêm được ai/);
  });

  test('dòng chỉ vào danh sách đội thì ghi rõ lý do vào ghi chú', async () => {
    await roster.applyRosterImport(strapi, { org: ORG, rows: [row({ phone: '' })], now: NOW });
    const added = strapi._tables[TA_UID][1];
    assert.strictEqual(added.memberCode, '');
    assert.match(added.note, /Nhập từ tệp.*thiếu số điện thoại/);
    assert.strictEqual(strapi._tables[MEMBER_UID].length, 1);
  });

  test('hồ sơ hội viên ghi trượt: vẫn giữ người đó trong danh sách và không tính là đã tạo', async () => {
    const realDocuments = strapi.documents;
    strapi.documents = (uid) => {
      const api = realDocuments(uid);
      if (uid !== MEMBER_UID) return api;
      return { ...api, create: async () => { throw new Error('unique constraint'); } };
    };

    const out = await roster.applyRosterImport(strapi, { org: ORG, rows: [row()], now: NOW });
    assert.strictEqual(strapi._tables[MEMBER_UID].length, 1);
    const added = strapi._tables[TA_UID][1];
    assert.strictEqual(added.memberCode, '');
    assert.match(added.note, /không tạo được hồ sơ hội viên/);
    assert.strictEqual(out.data.summary.created, 0);
    assert.strictEqual(out.data.summary.squadOnly, 1);
    assert.strictEqual(out.data.summary.added, 1);
    // Báo đúng thực tế cho giao diện, không để lại 'create' không có mã hội viên.
    assert.strictEqual(out.data.rows[0].action, 'squad-only');
  });

  test('thiếu tổ chức / tệp hỏng thì trả lỗi, không ghi gì', async () => {
    assert.match((await roster.applyRosterImport(strapi, { org: null, rows: [row()] })).error, /Không tìm thấy tổ chức/);
    assert.match((await roster.applyRosterImport(strapi, { org: ORG, rows: [] })).error, /đang trống/);
    assert.match((await roster.applyRosterImport(strapi, {})).error, /Không tìm thấy tổ chức/);
    assert.strictEqual(strapi._tables[TA_UID].length, 1);
  });
});
