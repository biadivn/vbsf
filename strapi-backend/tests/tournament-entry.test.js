'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { describe } = test;

const {
  parseFee, formatFee, sumEventFees, eventNames, registrationOpen,
  canSubmit, normalizeAthlete, normalizeAthletes, matchMember, officialEligibility,
} = require('../src/utils/tournament-entry');

const NATIONAL = {
  documentId: 't1', name: 'Giải VĐQG', nature: 'national',
  events: [{ name: 'Pool 9 bi', fee: '200.000đ' }, { name: 'Pool 10 bi', fee: '300.000đ' }],
};
const GRASSROOTS = { documentId: 't2', name: 'Giải phong trào', nature: 'grassroots', events: [] };

describe('parseFee / formatFee', () => {
  test('bóc số từ các cách viết tiền khác nhau', () => {
    assert.equal(parseFee('200.000đ'), 200000);
    assert.equal(parseFee('200,000 VND'), 200000);
    assert.equal(parseFee(150000), 150000);
    assert.equal(parseFee('1.000.000'), 1000000);
  });

  test('không đọc được thì trả null, không trả 0', () => {
    // 0 sẽ bị cộng vào tổng như một mức phí thật; null để bên gọi bỏ qua.
    assert.equal(parseFee('liên hệ'), null);
    assert.equal(parseFee(''), null);
    assert.equal(parseFee(null), null);
    assert.equal(parseFee(undefined), null);
    assert.equal(parseFee(NaN), null);
  });

  test('format theo cách viết đang dùng trên site', () => {
    assert.equal(formatFee(200000), '200.000đ');
    assert.equal(formatFee(1500000), '1.500.000đ');
    assert.equal(formatFee(500), '500đ');
    assert.equal(formatFee(NaN), '');
  });
});

describe('sumEventFees', () => {
  test('cộng lệ phí các nội dung đã chọn', () => {
    assert.equal(sumEventFees(NATIONAL.events, ['Pool 9 bi', 'Pool 10 bi']), '500.000đ');
    assert.equal(sumEventFees(NATIONAL.events, ['Pool 9 bi']), '200.000đ');
  });

  test('chọn nội dung không có trong giải thì bỏ qua', () => {
    assert.equal(sumEventFees(NATIONAL.events, ['Snooker']), '');
  });

  test('nội dung ghi phí không đọc được thì không chặn cả đơn', () => {
    const evs = [{ name: 'A', fee: '100.000đ' }, { name: 'B', fee: 'liên hệ' }];
    assert.equal(sumEventFees(evs, ['A', 'B']), '100.000đ');
    assert.equal(sumEventFees(evs, ['B']), '');
  });

  test('đầu vào rỗng/sai kiểu không ném lỗi', () => {
    assert.equal(sumEventFees(null, null), '');
    assert.equal(sumEventFees(undefined, ['A']), '');
  });
});

describe('eventNames', () => {
  test('lấy tên nội dung, bỏ dòng rỗng', () => {
    assert.deepEqual(eventNames(NATIONAL), ['Pool 9 bi', 'Pool 10 bi']);
    assert.deepEqual(eventNames({ events: [null, { name: '' }, { name: 'X' }] }), ['X']);
    assert.deepEqual(eventNames({}), []);
    assert.deepEqual(eventNames(null), []);
  });
});

describe('registrationOpen', () => {
  const t = { regOpenDate: '2026-01-10', regCloseDate: '2026-01-20' };

  test('trong cửa sổ thì mở', () => {
    assert.equal(registrationOpen(t, new Date('2026-01-15')).ok, true);
  });

  test('tính theo NGÀY — đúng ngày mở và ngày đóng vẫn nộp được', () => {
    assert.equal(registrationOpen(t, new Date('2026-01-10T23:00:00Z')).ok, true);
    assert.equal(registrationOpen(t, new Date('2026-01-20T23:59:00Z')).ok, true);
  });

  test('trước/sau cửa sổ thì báo đúng lý do', () => {
    assert.match(registrationOpen(t, new Date('2026-01-09')).error, /chưa mở/);
    assert.match(registrationOpen(t, new Date('2026-01-21')).error, /hết hạn/);
  });

  test('không khai ngày thì luôn mở (giải cũ tạo trước khi có field này)', () => {
    assert.equal(registrationOpen({}, new Date('2026-01-15')).ok, true);
  });

  test('vẫn đọc regDeadline cũ khi chưa có regCloseDate', () => {
    assert.match(registrationOpen({ regDeadline: '2026-01-05' }, new Date('2026-01-06')).error, /hết hạn/);
  });

  test('ngày rác coi như không khai', () => {
    assert.equal(registrationOpen({ regOpenDate: 'không-phải-ngày' }, new Date('2026-01-15')).ok, true);
  });
});

describe('canSubmit', () => {
  test('giải thành tích cao: chỉ tài khoản đội gửi được', () => {
    assert.equal(canSubmit(NATIONAL, { kind: 'org' }).ok, true);
    assert.match(canSubmit(NATIONAL, { kind: 'member' }).error, /đội tỉnh\/thành/);
    assert.match(canSubmit(NATIONAL, { kind: null }).error, /đội tỉnh\/thành/);
    assert.match(canSubmit(NATIONAL, null).error, /đội tỉnh\/thành/);
  });

  test('giải không khai nature thì coi là thành tích cao', () => {
    assert.match(canSubmit({ documentId: 'x' }, { kind: 'member' }).error, /đội tỉnh\/thành/);
  });

  test('giải phong trào: VĐV tự đăng ký, đội không đăng ký hộ', () => {
    assert.equal(canSubmit(GRASSROOTS, { kind: 'member' }).ok, true);
    assert.equal(canSubmit(GRASSROOTS, { kind: null }).ok, true);
    assert.match(canSubmit(GRASSROOTS, { kind: 'org' }).error, /không đăng ký theo đoàn/);
  });

  test('giải phong trào memberOnly: khách ẩn danh bị chặn', () => {
    const t = { ...GRASSROOTS, memberOnly: true };
    assert.equal(canSubmit(t, { kind: 'member' }).ok, true);
    assert.match(canSubmit(t, { kind: null }).error, /chỉ dành cho hội viên/);
  });

  test('hết hạn đăng ký thì chặn kể cả đúng loại tài khoản', () => {
    const t = { ...NATIONAL, regCloseDate: '2020-01-01' };
    assert.match(canSubmit(t, { kind: 'org' }).error, /hết hạn/);
  });

  test('không có giải thì báo rõ', () => {
    assert.match(canSubmit(null, { kind: 'org' }).error, /Không tìm thấy giải/);
  });
});

describe('normalizeAthlete', () => {
  test('giữ đúng field cho phép, chuẩn hoá CCCD và điện thoại', () => {
    const { data } = normalizeAthlete({
      fullName: '  Nguyễn Văn A  ', cccd: '079-095 001234', phone: '09xx 123 456',
      gender: 'Nam', events: ['Pool 9 bi'], status: 'official',
    }, NATIONAL);
    assert.equal(data.fullName, 'Nguyễn Văn A');
    assert.equal(data.cccd, '079095001234');
    assert.equal(data.phone, '09123456');
    assert.equal(data.gender, 'Nam');
    assert.equal(data.feeTotal, '200.000đ');
    // Không cho đơn tự đặt trạng thái duyệt.
    assert.equal(data.status, undefined);
  });

  test('thiếu họ tên thì báo lỗi', () => {
    assert.match(normalizeAthlete({ cccd: '123' }, NATIONAL).error, /họ tên/);
    assert.match(normalizeAthlete({}, NATIONAL).error, /họ tên/);
  });

  test('nhận cả khoá name (biểu mẫu upload dùng tên cột khác)', () => {
    assert.equal(normalizeAthlete({ name: 'B' }, NATIONAL).data.fullName, 'B');
  });

  test('bỏ nội dung không thuộc giải', () => {
    const { data } = normalizeAthlete({ fullName: 'A', events: ['Pool 9 bi', 'Bịa'] }, NATIONAL);
    assert.deepEqual(data.events, ['Pool 9 bi']);
  });

  test('giải chưa khai nội dung nào thì nhận nguyên text người dùng nhập', () => {
    const { data } = normalizeAthlete({ fullName: 'A', events: ['Tự do'] }, GRASSROOTS);
    assert.deepEqual(data.events, ['Tự do']);
  });

  test('giới tính lạ thì bỏ trống thay vì ghi bừa', () => {
    assert.equal(normalizeAthlete({ fullName: 'A', gender: 'Khác' }, NATIONAL).data.gender, undefined);
  });
});

describe('normalizeAthletes', () => {
  test('danh sách hợp lệ', () => {
    const { data } = normalizeAthletes([{ fullName: 'A' }, { fullName: 'B' }], NATIONAL);
    assert.equal(data.length, 2);
  });

  test('báo đúng số thứ tự dòng hỏng', () => {
    assert.match(normalizeAthletes([{ fullName: 'A' }, { cccd: '1' }], NATIONAL).error, /Dòng 2/);
  });

  test('danh sách trống hoặc sai kiểu', () => {
    assert.match(normalizeAthletes([], NATIONAL).error, /đang trống/);
    assert.match(normalizeAthletes(null, NATIONAL).error, /đang trống/);
  });

  test('chặn danh sách quá dài', () => {
    const rows = Array.from({ length: 301 }, (_, i) => ({ fullName: 'VĐV ' + i }));
    assert.match(normalizeAthletes(rows, NATIONAL).error, /tối đa 300/);
  });
});

describe('matchMember', () => {
  const members = [
    { code: 'VBSF-1', cccd: '079095001234', status: 'active', expiry: '2026-12-31' },
    { code: 'VBSF-2', cccd: '079095009999', status: 'expired', expiry: '2025-12-31' },
    { code: 'VBSF-3', cccd: '079095005555', status: 'active', expiry: null },
  ];

  test('khớp CCCD bất kể cách gõ dấu cách/gạch', () => {
    const r = matchMember(members, '079-095 001234', new Date('2026-06-01'));
    assert.equal(r.memberCode, 'VBSF-1');
    assert.equal(r.memberValid, true);
  });

  test('hội viên hết hiệu lực thì memberValid = false nhưng vẫn ra mã', () => {
    const r = matchMember(members, '079095009999', new Date('2026-06-01'));
    assert.equal(r.memberCode, 'VBSF-2');
    assert.equal(r.memberValid, false);
  });

  test('còn active nhưng quá hạn theo ngày thì hết hiệu lực', () => {
    assert.equal(matchMember(members, '079095001234', new Date('2027-01-01')).memberValid, false);
    // Hết ngày 31/12 vẫn còn hiệu lực.
    assert.equal(matchMember(members, '079095001234', new Date('2026-12-31')).memberValid, true);
  });

  test('không có hạn thì coi như còn hiệu lực', () => {
    assert.equal(matchMember(members, '079095005555', new Date('2030-01-01')).memberValid, true);
  });

  test('không khớp ai / CCCD rỗng', () => {
    assert.deepEqual(matchMember(members, '000', new Date()), { memberCode: '', memberValid: false });
    assert.deepEqual(matchMember(members, '', new Date()), { memberCode: '', memberValid: false });
    assert.deepEqual(matchMember(null, '079095001234', new Date()), { memberCode: '', memberValid: false });
  });
});

describe('officialEligibility', () => {
  test('đủ hai điều kiện mới vào được danh sách chính thức', () => {
    assert.equal(officialEligibility({ memberValid: true, paid: true }).ok, true);
  });

  test('thiếu điều kiện nào thì nêu đúng điều kiện đó', () => {
    assert.deepEqual(officialEligibility({ memberValid: false, paid: true }).reasons,
      ['chưa phải hội viên còn hiệu lực']);
    assert.deepEqual(officialEligibility({ memberValid: true, paid: false }).reasons,
      ['chưa ghi nhận nộp lệ phí']);
    assert.equal(officialEligibility({}).reasons.length, 2);
    assert.equal(officialEligibility(null).reasons.length, 2);
  });
});
