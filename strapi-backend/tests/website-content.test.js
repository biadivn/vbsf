'use strict';
/* Dữ liệu migration được trích tay từ prototype tĩnh `VBSF Web.html`. Test ở đây
   khoá lại những chỗ dễ sai khi sửa: sơ đồ nhánh đấu, ánh xạ bảng xếp hạng, và
   các ràng buộc bắt buộc của schema Strapi. */
const { test, describe } = require('node:test');
const assert = require('node:assert');

const content = require('../scripts/website-content');

describe('website-content: single type', () => {
  test('Thông tin tổ chức có đủ trường hiển thị trên site', () => {
    ['orgName', 'orgShort', 'heroTitle', 'heroSubtitle', 'about',
      'feeFirstTime', 'feeAnnualFull', 'feeAnnualHalf', 'feeRenewal',
      'bankName', 'bankAccount', 'bankHolder'].forEach((f) => {
      assert.ok(content.settings[f], 'thiếu ' + f);
    });
  });

  test('Liên hệ có địa chỉ, email, điện thoại, giờ làm việc', () => {
    ['address', 'email', 'phone', 'hours'].forEach((f) => assert.ok(content.contact[f], 'thiếu ' + f));
  });
});

describe('website-content: tin tức', () => {
  test('mọi bài đều có tiêu đề, chuyên mục và ngày ISO', () => {
    content.news.forEach((n) => {
      assert.ok(n.title, 'bài thiếu tiêu đề');
      assert.ok(n.category, n.title + ': thiếu chuyên mục');
      assert.match(n.date, /^\d{4}-\d{2}-\d{2}$/, n.title + ': ngày sai định dạng');
    });
  });

  test('có đúng một bài nổi bật', () => {
    assert.strictEqual(content.news.filter((n) => n.featured).length, 1);
  });

  test('tiêu đề không trùng nhau — migration upsert theo title', () => {
    const titles = content.news.map((n) => n.title);
    assert.strictEqual(new Set(titles).size, titles.length);
  });

  test('metaTitle/metaDescription được sinh từ tiêu đề và tóm tắt', () => {
    content.news.forEach((n) => {
      assert.strictEqual(n.metaTitle, n.title);
      assert.strictEqual(n.metaDescription, n.excerpt);
    });
  });
});

describe('website-content: hội viên & xếp hạng', () => {
  test('mã, số điện thoại và CCCD không trùng nhau (schema yêu cầu unique)', () => {
    ['code', 'phone', 'cccd'].forEach((field) => {
      const values = content.members.map((m) => m[field]);
      assert.strictEqual(new Set(values).size, values.length, 'trùng ' + field);
    });
  });

  test('mọi hội viên đều đủ trường bắt buộc của schema', () => {
    content.members.forEach((m) => {
      ['name', 'cccd', 'phone'].forEach((f) => assert.ok(m[f], m.name + ': thiếu ' + f));
      assert.ok(['Nam', 'Nữ', 'VĐV trẻ'].includes(m.group), m.name + ': nhóm sai');
    });
  });

  test('bộ môn chính là bộ môn có điểm cao nhất', () => {
    content.members.forEach((m) => {
      const top = m.disciplines.reduce((a, b) => (b.points > a.points ? b : a));
      assert.strictEqual(m.category, top.category, m.name + ': bộ môn chính không khớp');
    });
  });

  test('hạng trong mỗi (nhóm, bộ môn) không trùng nhau', () => {
    const seen = new Map();
    content.members.forEach((m) => {
      m.disciplines.forEach((d) => {
        const key = m.group + '|' + d.category + '|' + d.rank;
        assert.ok(!seen.has(key), 'trùng hạng: ' + key + ' (' + m.name + ' và ' + seen.get(key) + ')');
        seen.set(key, m.name);
      });
    });
  });

  test('giữ nguyên 5 hồ sơ đăng nhập mẫu của prototype', () => {
    const long = content.members.find((m) => m.name === 'Nguyễn Phúc Long');
    assert.strictEqual(long.code, 'VBSF-2026-00098');
    assert.strictEqual(long.phone, '0901234567');
    assert.strictEqual(long.disciplines[0].points, 2485);
    assert.strictEqual(content.members.find((m) => m.name === 'Đỗ Thành Nam').status, 'expired');
    assert.strictEqual(content.members.find((m) => m.name === 'Phạm Anh Tú').status, 'pending');
  });

  test('trend chỉ nhận giá trị enum của schema', () => {
    content.members.forEach((m) => m.disciplines.forEach((d) => {
      assert.ok(['up', 'down', 'eq'].includes(d.trend), m.name + ': trend sai');
    }));
  });
});

describe('website-content: giải đấu', () => {
  const byName = (name) => content.tournaments.find((t) => t.name === name);

  test('trạng thái và thể thức nằm trong enum của schema', () => {
    content.tournaments.forEach((t) => {
      assert.ok(['upcoming', 'ongoing', 'completed'].includes(t.status), t.name);
      assert.ok(['SE', 'DE', 'RR', 'SW'].includes(t.format), t.name);
    });
  });

  test('mọi giải đều có bảng giải thưởng và thể lệ', () => {
    content.tournaments.forEach((t) => {
      assert.strictEqual(t.prizes.length, 6, t.name);
      assert.match(t.rules, /Luật cơ bản/, t.name);
    });
  });

  test('giải đã kết thúc có đủ 3 hạng của bục nhận giải', () => {
    content.tournaments.filter((t) => t.status === 'completed').forEach((t) => {
      assert.ok(t.champion, t.name + ': thiếu vô địch');
      assert.ok(t.runnerUp, t.name + ': thiếu á quân');
      assert.ok(t.third, t.name + ': thiếu hạng 3');
    });
  });

  test('note chỉ dùng cho trạng thái đăng ký của giải sắp diễn ra', () => {
    content.tournaments.forEach((t) => {
      if (t.status === 'upcoming') assert.match(t.note, /đăng ký/i, t.name);
      else assert.strictEqual(t.note, '', t.name + ': note phải để trống');
    });
  });

  test('chỉ có đúng một giải đang diễn ra', () => {
    assert.strictEqual(content.tournaments.filter((t) => t.status === 'ongoing').length, 1);
  });

  test('giải đang diễn ra có 16 cơ thủ, hạt giống liên tiếp từ 1', () => {
    const t = byName('Giải Vô địch Quốc gia Pool 2026');
    assert.strictEqual(t.players.length, 16);
    assert.deepStrictEqual(t.players.map((p) => p.seed), Array.from({ length: 16 }, (_, i) => i + 1));
    assert.strictEqual(new Set(t.players.map((p) => p.localId)).size, 16);
  });
});

describe('website-content: sơ đồ nhánh đấu loại trực tiếp', () => {
  const live = content.tournaments.find((t) => t.status === 'ongoing');
  const bracket = live.bracket;
  const nameOf = (id) => {
    const p = live.players.find((x) => x.localId === id);
    return p ? p.name : null;
  };
  const pair = (matchId) => {
    const m = bracket.matches[matchId];
    return [nameOf(m.p1), nameOf(m.p2), m.s1, m.s2, m.status];
  };

  test('hình dạng đúng chuẩn engine: SE, 16 người, 4 vòng, 15 trận', () => {
    assert.strictEqual(bracket.type, 'SE');
    assert.strictEqual(bracket.size, 16);
    assert.strictEqual(bracket.k, 4);
    assert.strictEqual(bracket.rounds.length, 4);
    assert.strictEqual(Object.keys(bracket.matches).length, 15);
    assert.deepStrictEqual(bracket.rounds.map((r) => r.length), [8, 4, 2, 1]);
  });

  test('vòng 1/8 tái tạo đúng từng cặp và tỷ số của prototype', () => {
    const expected = [
      ['Nguyễn Phúc Long', 'Dương Anh Kiệt', 4, 0],
      ['Đặng Văn Hậu', 'Phan Đức Thịnh', 4, 3],
      ['Trần Quốc Bảo', 'Đoàn Minh Tuấn', 4, 1],
      ['Bùi Đức Anh', 'Vương Quốc Huy', 4, 2],
      ['Lê Minh Khôi', 'Lý Gia Bảo', 4, 0],
      ['Ngô Gia Huy', 'Trịnh Xuân Sơn', 4, 3],
      ['Phạm Anh Tú', 'Đỗ Anh Dũng', 4, 1],
      ['Hoàng Minh Quân', 'Vũ Trọng Nghĩa', 4, 2],
    ];
    bracket.rounds[0].forEach((id, i) => {
      assert.deepStrictEqual(pair(id), expected[i].concat(['done']), 'trận 1/8 số ' + (i + 1));
    });
  });

  test('tứ kết: 2 trận xong, 1 trận đang đá 2–1, 1 trận chưa bắt đầu', () => {
    const qf = bracket.rounds[1];
    assert.deepStrictEqual(pair(qf[0]), ['Nguyễn Phúc Long', 'Đặng Văn Hậu', 4, 2, 'done']);
    assert.deepStrictEqual(pair(qf[1]), ['Trần Quốc Bảo', 'Bùi Đức Anh', 2, 1, 'ready']);
    assert.deepStrictEqual(pair(qf[2]), ['Lê Minh Khôi', 'Ngô Gia Huy', 4, 1, 'done']);
    assert.deepStrictEqual(pair(qf[3]), ['Phạm Anh Tú', 'Hoàng Minh Quân', null, null, 'ready']);
  });

  test('người thắng được đẩy sang bán kết, chỗ chưa có kết quả để trống', () => {
    const sf = bracket.rounds[2].map((id) => bracket.matches[id]);
    assert.strictEqual(nameOf(sf[0].p1), 'Nguyễn Phúc Long');
    assert.strictEqual(sf[0].p2, null, 'trận tứ kết đang đá chưa có người thắng');
    assert.strictEqual(nameOf(sf[1].p1), 'Lê Minh Khôi');
    assert.strictEqual(bracket.matches[bracket.rounds[3][0]].status, 'wait');
  });

  test('mọi trận đã done đều có người thắng khớp tỷ số', () => {
    Object.values(bracket.matches).filter((m) => m.status === 'done').forEach((m) => {
      assert.strictEqual(m.win, m.s1 > m.s2 ? m.p1 : m.p2, 'trận ' + m.id);
    });
  });

  test('không có cơ thủ nào xuất hiện hai lần ở vòng đầu', () => {
    const ids = bracket.rounds[0].flatMap((id) => [bracket.matches[id].p1, bracket.matches[id].p2]);
    assert.strictEqual(new Set(ids).size, 16);
  });
});

describe('website-content: các bộ dữ liệu còn lại', () => {
  test('văn bản & media dùng đúng enum của schema', () => {
    content.libraryDocs.forEach((d) => {
      assert.ok(['PDF', 'DOCX', 'XLSX'].includes(d.fileType), d.title);
      assert.ok(['Quy chế', 'Luật', 'Biểu mẫu', 'Thông báo'].includes(d.tag), d.title);
    });
    content.mediaItems.forEach((m) => assert.ok(['photo', 'video'].includes(m.mediaType), m.title));
  });

  test('đối tác phủ đủ 4 hạng của trang Đối tác', () => {
    const tiers = new Set(content.partners.map((p) => p.tier));
    ['Đối tác chiến lược', 'Nhà tài trợ Kim cương', 'Nhà tài trợ Vàng', 'Đối tác đồng hành']
      .forEach((t) => assert.ok(tiers.has(t), 'thiếu hạng ' + t));
    const names = content.partners.map((p) => p.name);
    assert.strictEqual(new Set(names).size, names.length, 'tên đối tác bị trùng');
  });

  test('hội viên tổ chức: mã và số điện thoại không trùng', () => {
    ['code', 'phone'].forEach((f) => {
      const values = content.memberOrgs.map((o) => o[f]);
      assert.strictEqual(new Set(values).size, values.length, 'trùng ' + f);
    });
    content.memberOrgs.forEach((o) => assert.match(o.joinDate, /^\d{4}-\d{2}-\d{2}$/));
  });

  test('ngày để trống được chuyển thành null chứ không phải chuỗi rỗng', () => {
    content.memberOrgs.concat(content.members).forEach((r) => {
      if (r.expiry !== undefined) assert.ok(r.expiry === null || /^\d{4}-\d{2}-\d{2}$/.test(r.expiry));
    });
    content.mediaItems.forEach((m) => assert.ok(m.date === null || /^\d{4}-\d{2}-\d{2}$/.test(m.date)));
  });
});
