/* =========================================================
   SẮP HẠT GIỐNG VÒNG 1 & DANH SÁCH TRẬN CHỜ KẾT QUẢ
   Thuần logic, không đụng DOM — tách riêng khỏi tournament-editor.js
   để chạy được unit test (tournament-editor.js gắn chặt với DOM).

   MÔ HÌNH: thứ tự record.players CHÍNH LÀ thứ tự hạt giống — người thứ i
   trong danh sách là hạt giống #i+1, và tbkGenSE/tbkGenDE ghép cặp vòng 1
   theo bảng hạt giống chuẩn (tbkBracketSeeds). Muốn đổi cặp đấu thì đổi chỗ
   hai người trong danh sách; không cần mô hình dữ liệu riêng cho từng ô.

   Cách này phủ được MỌI cách bắt cặp: hoán vị danh sách là hoán vị các ô
   hạt giống. Riêng suất miễn đấu (BYE) luôn rơi vào các hạt giống cuối —
   đúng thông lệ (hạt giống trên được miễn đấu), và vẫn chọn được ai hưởng
   bằng cách đặt người đó vào hạt giống ghép với ô BYE.
   ========================================================= */

/* Trình duyệt: các hàm tbk* là biến toàn cục do tournament-engine.js khai báo
   (nạp trước file này trong cms.html). Node (unit test): nạp qua require. */
var TS_ENG = (typeof module === 'object' && module.exports)
  ? require('./tournament-engine.js')
  : { tbkNextPow2: tbkNextPow2, tbkBracketSeeds: tbkBracketSeeds, tbkRoundName: tbkRoundName };

/**
 * Các cặp đấu vòng 1 suy ra từ thứ tự hạt giống hiện tại.
 * @returns [{seedA, a, seedB, b}] — a/b là player, hoặc null nếu ô đó là BYE.
 */
function teSeedRows(players) {
  var list = players || [];
  var n = list.length;
  if (n < 2) return [];
  var size = TS_ENG.tbkNextPow2(n);
  var seeds = TS_ENG.tbkBracketSeeds(size);
  var at = function (s) { return s <= n ? list[s - 1] : null; };
  var rows = [];
  for (var i = 0; i < size / 2; i++) {
    rows.push({ seedA: seeds[2 * i], a: at(seeds[2 * i]), seedB: seeds[2 * i + 1], b: at(seeds[2 * i + 1]) });
  }
  return rows;
}

/**
 * Đặt playerId vào ô hạt giống seedNo bằng cách đổi chỗ với người đang giữ ô đó.
 * Trả về MẢNG MỚI khi có thay đổi, và trả về đúng mảng cũ khi không đổi gì —
 * bên gọi dựa vào đó để bỏ qua việc lưu/đồng bộ thừa.
 */
function teReorderForSlot(players, seedNo, playerId) {
  var list = players || [];
  var i = Number(seedNo) - 1;
  // seedNo ngoài khoảng 1..n là ô BYE — không có người nào để đổi chỗ.
  if (!Number.isInteger(i) || i < 0 || i >= list.length) return players;
  var j = -1;
  for (var k = 0; k < list.length; k++) {
    if (String(list[k].id) === String(playerId)) { j = k; break; }
  }
  if (j < 0 || j === i) return players;
  var next = list.slice();
  next[i] = list[j];
  next[j] = list[i];
  return next;
}

/* Nhóm nhánh khi sắp xếp: nhánh thắng → nhánh thua → chung kết → tái đấu,
   khớp với cách sơ đồ DE được vẽ nên đọc danh sách thấy quen mắt. */
var TS_BRANCH_ORDER = { W: 0, L: 1, GF: 2, GF2: 3 };

/**
 * Các trận đã đủ hai người chơi thật nhưng chưa có tỷ số — tức là những trận
 * ban tổ chức nhập được ngay. Bỏ qua trận còn chờ người, và trận gặp BYE
 * (engine tự xử qua tbkResolveByes).
 */
function tePendingMatches(bracket) {
  if (!bracket || !bracket.matches) return [];
  var all = Object.keys(bracket.matches).map(function (k) { return bracket.matches[k]; });
  return all.filter(function (m) {
    return m.win == null && m.status === 'ready'
      && m.p1 != null && m.p2 != null && m.p1 !== 'BYE' && m.p2 !== 'BYE';
  }).sort(function (a, b) {
    return ((TS_BRANCH_ORDER[a.br] || 0) - (TS_BRANCH_ORDER[b.br] || 0))
      || (a.round - b.round)
      || (a.idx - b.idx);
  });
}

/** Tên vòng của một trận, dùng chung cách gọi với nhãn trên sơ đồ. */
function teMatchRoundLabel(bracket, m) {
  if (!bracket || !m) return '';
  if (bracket.type === 'SE') return TS_ENG.tbkRoundName(m.round, bracket.rounds.length);
  if (m.br === 'W') return 'WB ' + TS_ENG.tbkRoundName(m.round, bracket.WB.length);
  if (m.br === 'L') return 'LB Vòng ' + (m.round + 1);
  if (m.br === 'GF') return 'Chung kết';
  return 'Chung kết (tái đấu)';
}

if (typeof module === 'object' && module.exports) {
  module.exports = { teSeedRows, teReorderForSlot, tePendingMatches, teMatchRoundLabel };
}
