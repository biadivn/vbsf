'use strict';
/* Sắp hạt giống vòng 1 và lọc trận cần nhập kết quả.

   Hai chỗ dễ hỏng âm thầm nên test khoá lại:
   - Đổi chỗ hạt giống mà lệch chỉ số thì cặp đấu sai nhưng giao diện vẫn trông
     hợp lý — chỉ phát hiện khi giải đã chạy được nửa chừng.
   - Danh sách "trận cần nhập kết quả" mà lọt trận gặp BYE hoặc trận còn chờ
     người thì ban tổ chức nhập tỷ số cho một trận không tồn tại. */
const { test, describe } = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

/* cms-js/ nằm ngoài strapi-backend/ nên có ngữ cảnh không kèm theo (vd. build
   context của Docker). Bỏ qua cả file thay vì để require ném lỗi — giống cách
   site-config.test.js xử lý site-js/. */
const available = fs.existsSync(path.join(__dirname, '..', '..', 'cms-js', 'tournament-seeding.js'));
const skip = available ? false : 'không có thư mục cms-js trong context này';
const {
  teSeedRows, teReorderForSlot, tePendingMatches, teMatchRoundLabel,
} = available ? require('../../cms-js/tournament-seeding') : {};
const { tbkGenSE, tbkGenDE, tbkDecide } = available ? require('../../cms-js/tournament-engine') : {};

/** n người chơi tên A, B, C… đúng hình dạng record.players của CMS. */
function players(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: 'p' + (i + 1), name: String.fromCharCode(65 + i), club: '',
  }));
}
const names = (list) => list.map((p) => p.name).join('');

/** Cặp đấu vòng 1 dưới dạng "A-B", BYE là "-". */
function pairs(list) {
  return teSeedRows(list).map((r) => (r.a ? r.a.name : '-') + '-' + (r.b ? r.b.name : '-'));
}

describe('teSeedRows: bắt cặp vòng 1 theo hạt giống', { skip }, () => {
  test('dưới 2 người thì không có cặp nào', () => {
    assert.deepStrictEqual(teSeedRows([]), []);
    assert.deepStrictEqual(teSeedRows(players(1)), []);
    assert.deepStrictEqual(teSeedRows(null), []);
  });

  test('4 người: hạt giống 1 gặp 4, hạt giống 2 gặp 3', () => {
    assert.deepStrictEqual(pairs(players(4)), ['A-D', 'B-C']);
  });

  test('8 người: đúng bảng hạt giống chuẩn', () => {
    assert.deepStrictEqual(pairs(players(8)), ['A-H', 'D-E', 'B-G', 'C-F']);
  });

  test('số người không phải luỹ thừa 2 thì bù BYE cho tới cỡ sơ đồ', () => {
    const rows = teSeedRows(players(5));
    assert.strictEqual(rows.length, 4, '5 người -> sơ đồ 8 -> 4 cặp');
    assert.deepStrictEqual(pairs(players(5)), ['A--', 'D-E', 'B--', 'C--']);
  });

  test('BYE luôn rơi vào các hạt giống cuối, không rơi giữa chừng', () => {
    for (const n of [3, 5, 6, 7, 9, 13]) {
      teSeedRows(players(n)).forEach((r) => {
        [[r.seedA, r.a], [r.seedB, r.b]].forEach(([seed, who]) => {
          assert.strictEqual(who === null, seed > n, `n=${n}, hạt giống ${seed}`);
        });
      });
    }
  });

  test('mỗi người chơi xuất hiện đúng một lần trong sơ đồ', () => {
    for (const n of [2, 3, 6, 11, 16, 17]) {
      const seen = teSeedRows(players(n)).flatMap((r) => [r.a, r.b]).filter(Boolean).map((p) => p.id);
      assert.strictEqual(seen.length, n, 'n=' + n);
      assert.strictEqual(new Set(seen).size, n, 'n=' + n + ': có người bị lặp');
    }
  });

  test('cặp đấu khớp với sơ đồ mà engine thật sinh ra', () => {
    // Nếu hai bên lệch nhau thì phần "xem trước" nói dối người dùng.
    const list = players(8);
    const eng = tbkGenSE(list.map((p) => p.id));
    const fromEngine = eng.rounds[0].map((id) => {
      const m = eng.matches[id];
      const nameOf = (pid) => (pid === 'BYE' ? '-' : list.find((p) => p.id === pid).name);
      return nameOf(m.p1) + '-' + nameOf(m.p2);
    });
    assert.deepStrictEqual(pairs(list), fromEngine);
  });
});

describe('teReorderForSlot: đổi người ở một ô hạt giống', { skip }, () => {
  test('đổi chỗ hai người và giữ nguyên sĩ số', () => {
    const list = players(4);                    // A B C D
    const next = teReorderForSlot(list, 1, 'p3'); // đưa C về hạt giống 1
    assert.strictEqual(names(next), 'CBAD');
    assert.strictEqual(next.length, 4);
  });

  test('trả về ĐÚNG mảng cũ khi không có gì thay đổi', () => {
    const list = players(4);
    // cùng người đang giữ ô đó
    assert.strictEqual(teReorderForSlot(list, 2, 'p2'), list);
    // playerId không tồn tại
    assert.strictEqual(teReorderForSlot(list, 2, 'khong-co'), list);
    // ô BYE (seedNo > số người chơi) — không có ai để đổi
    assert.strictEqual(teReorderForSlot(list, 7, 'p1'), list);
    // seedNo không hợp lệ
    [0, -1, 'x', null, undefined, 1.5].forEach((bad) => {
      assert.strictEqual(teReorderForSlot(list, bad, 'p1'), list, 'seedNo=' + String(bad));
    });
  });

  test('không sửa mảng gốc (bên gọi so sánh tham chiếu để biết có đổi hay không)', () => {
    const list = players(4);
    const next = teReorderForSlot(list, 1, 'p4');
    assert.strictEqual(names(list), 'ABCD', 'mảng gốc bị mutate');
    assert.notStrictEqual(next, list);
  });

  test('id so sánh theo chuỗi nên số hay chuỗi đều khớp', () => {
    const list = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    assert.strictEqual(names(teReorderForSlot(list, 1, '2')), 'BA');
  });

  test('đổi chỗ đủ để tạo ra bất kỳ cặp đấu nào — cho A gặp B ở sơ đồ 4 người', () => {
    // Mặc định A gặp D. Đưa B về ô đối diện A (hạt giống 4).
    let list = players(4);
    assert.deepStrictEqual(pairs(list), ['A-D', 'B-C']);
    list = teReorderForSlot(list, 4, 'p2');
    assert.deepStrictEqual(pairs(list), ['A-B', 'D-C']);
  });

  test('chọn được ai hưởng suất miễn đấu bằng cách đưa họ vào hạt giống ghép với BYE', () => {
    let list = players(5);                       // A hưởng BYE mặc định
    assert.strictEqual(pairs(list)[0], 'A--');
    list = teReorderForSlot(list, 1, 'p5');      // đưa E lên hạt giống 1
    assert.strictEqual(pairs(list)[0], 'E--');
  });
});

describe('tePendingMatches: trận nhập được ngay', { skip }, () => {
  test('sơ đồ rỗng / thiếu dữ liệu thì trả mảng rỗng', () => {
    assert.deepStrictEqual(tePendingMatches(null), []);
    assert.deepStrictEqual(tePendingMatches({}), []);
    assert.deepStrictEqual(tePendingMatches({ matches: {} }), []);
  });

  test('sơ đồ 8 người mới tạo: đúng 4 trận vòng 1, các vòng sau còn chờ', () => {
    const eng = tbkGenSE(players(8).map((p) => p.id));
    const pending = tePendingMatches(eng);
    assert.strictEqual(pending.length, 4);
    assert.ok(pending.every((m) => m.round === 0));
  });

  test('KHÔNG liệt kê trận gặp BYE — engine đã tự xử', () => {
    const eng = tbkGenSE(players(5).map((p) => p.id));
    const pending = tePendingMatches(eng);
    pending.forEach((m) => {
      assert.notStrictEqual(m.p1, 'BYE');
      assert.notStrictEqual(m.p2, 'BYE');
    });
    // 5 người / sơ đồ 8: chỉ D-E là trận thật ở vòng 1.
    assert.strictEqual(pending.filter((m) => m.round === 0).length, 1);
  });

  test('KHÔNG liệt kê trận còn chờ người', () => {
    const eng = tbkGenSE(players(4).map((p) => p.id));
    assert.ok(tePendingMatches(eng).every((m) => m.p1 != null && m.p2 != null));
  });

  test('trận vừa nhập kết quả rời danh sách, trận kế tiếp xuất hiện khi đủ hai người', () => {
    const eng = tbkGenSE(players(4).map((p) => p.id));
    const [m1, m2] = tePendingMatches(eng);
    tbkDecide(eng.matches, m1.id, m1.p1, 5, 2);
    let pending = tePendingMatches(eng);
    assert.ok(!pending.some((m) => m.id === m1.id), 'trận đã có kết quả vẫn còn trong danh sách');
    assert.strictEqual(pending.length, 1, 'chung kết mới có 1 người, chưa được liệt kê');
    tbkDecide(eng.matches, m2.id, m2.p1, 5, 3);
    pending = tePendingMatches(eng);
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].round, 1, 'chung kết đã đủ hai người');
  });

  test('sơ đồ loại kép: xếp nhánh thắng trước nhánh thua', () => {
    const eng = tbkGenDE(players(8).map((p) => p.id));
    const branches = tePendingMatches(eng).map((m) => m.br);
    const firstL = branches.indexOf('L');
    if (firstL >= 0) {
      assert.ok(branches.slice(0, firstL).every((b) => b === 'W'));
      assert.ok(branches.slice(firstL).every((b) => b !== 'W'));
    }
  });

  test('trong cùng nhánh thì vòng nhỏ trước, cùng vòng thì theo thứ tự trên sơ đồ', () => {
    const pending = tePendingMatches(tbkGenSE(players(16).map((p) => p.id)));
    for (let i = 1; i < pending.length; i++) {
      const a = pending[i - 1], b = pending[i];
      assert.ok(a.round < b.round || (a.round === b.round && a.idx < b.idx),
        `sai thứ tự tại ${i}: (${a.round},${a.idx}) trước (${b.round},${b.idx})`);
    }
  });
});

describe('teMatchRoundLabel: tên vòng', { skip }, () => {
  test('sơ đồ loại trực tiếp gọi tên theo khoảng cách tới chung kết', () => {
    const eng = tbkGenSE(players(8).map((p) => p.id));
    const at = (r, i) => teMatchRoundLabel(eng, eng.matches[eng.rounds[r][i]]);
    assert.strictEqual(at(0, 0), 'Tứ kết');
    assert.strictEqual(at(1, 0), 'Bán kết');
    assert.strictEqual(at(2, 0), 'Chung kết');
  });

  test('sơ đồ 16 người: vòng đầu gọi theo số người còn lại', () => {
    const eng = tbkGenSE(players(16).map((p) => p.id));
    assert.strictEqual(teMatchRoundLabel(eng, eng.matches[eng.rounds[0][0]]), 'Vòng 16');
  });

  test('loại kép phân biệt nhánh thắng, nhánh thua và hai trận chung kết', () => {
    const eng = tbkGenDE(players(8).map((p) => p.id));
    const label = (br, round) => teMatchRoundLabel(eng, { br, round });
    assert.match(label('W', 0), /^WB /);
    assert.strictEqual(label('L', 0), 'LB Vòng 1');
    assert.strictEqual(label('L', 2), 'LB Vòng 3');
    assert.strictEqual(label('GF', 0), 'Chung kết');
    assert.strictEqual(label('GF2', 0), 'Chung kết (tái đấu)');
  });

  test('thiếu dữ liệu thì trả chuỗi rỗng, không ném lỗi', () => {
    assert.strictEqual(teMatchRoundLabel(null, {}), '');
    assert.strictEqual(teMatchRoundLabel({ type: 'SE' }, null), '');
  });
});
