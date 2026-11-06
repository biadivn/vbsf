/* =========================================================
   DANH SÁCH VĐV CỦA ĐƠN VỊ (mục 1.2)

   Hội viên tổ chức tự thêm/bớt VĐV của mình — mọi loại hình (đội tỉnh/thành,
   CLB, trường học...), không phân biệt orgType; Liên đoàn xác nhận từng người
   trong CMS. Chỉ những người ĐÃ XÁC NHẬN mới chọn được khi đăng ký giải thành
   tích cao (mục 1.3) — nên khối này hiện rõ trạng thái từng người thay vì chỉ
   liệt kê tên.

   Khối được gắn vào hồ sơ đội ở trang Hội viên; index.html dựng lại hồ sơ đó
   mỗi lần đổi trạng thái đăng nhập nên mount() phải gọi lại được nhiều lần.
   ========================================================= */
(function () {
  var STRAPI_URL =
    typeof window !== 'undefined' && typeof window.VBSF_STRAPI_URL === 'string' ? window.VBSF_STRAPI_URL : '';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '';
    var p = function (x) { return String(x).padStart(2, '0'); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  /* Mọi endpoint của khối này đều cần token đội; không có token thì không gọi
     để khỏi nhận 400 rồi hiện lỗi đỏ ngay lúc trang vừa mở. */
  async function call(path, body) {
    var token = window.VBSF_AUTH && window.VBSF_AUTH.orgToken();
    if (!token) throw new Error('Phiên đăng nhập của đơn vị đã hết hạn. Vui lòng đăng nhập lại.');
    var res;
    try {
      res = await fetch(STRAPI_URL + '/api/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body || {}),
      });
    } catch (err) {
      throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
    }
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((out.error && out.error.message) || 'Không thực hiện được. Vui lòng thử lại.');
    return out;
  }

  var STATUS = {
    confirmed: ['Đã xác nhận', 'background:#E7F4EC;color:#00814D'],
    pending: ['Chờ Liên đoàn xác nhận', 'background:#F4F1E8;color:#9A7B2E'],
  };

  function rowHtml(a) {
    var st = STATUS[a.status] || STATUS.pending;
    var meta = [fmtDate(a.dob), a.gender, a.phone].filter(Boolean).join(' · ');
    /* Câu trạng thái do máy chủ soi lại theo hồ sơ hội viên hiện tại
       (memberStatusLabel); bản cũ chỉ có cờ memberValid nên gọi mọi trường hợp
       là "hết hiệu lực", kể cả người mới chờ nộp hội phí lần đầu. */
    var member = a.memberCode
      ? esc(a.memberCode) + (a.memberValid ? '' : ' (' + esc(a.memberStatusLabel || 'chưa có hiệu lực').toLowerCase() + ')')
      : 'chưa là hội viên';
    return '<div style="display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-top:0.5px solid #E3E8E4">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13.5px;font-weight:600;color:#1B2A24">' + esc(a.fullName) + '</div>' +
        '<div style="font-size:11.5px;color:#8A968F;margin-top:2px">CCCD ' + esc(a.cccd || '—') +
          (meta ? ' · ' + esc(meta) : '') + '</div>' +
        '<div style="font-size:11.5px;color:#8A968F;margin-top:2px">Hội viên: ' + member + '</div>' +
      '</div>' +
      '<span class="vb-badge" style="' + st[1] + ';white-space:nowrap">' + st[0] + '</span>' +
      '<span class="vb-link" data-squad-rm="' + esc(a.documentId) + '" title="Bỏ khỏi đội" ' +
        'style="cursor:pointer;color:#9E2A2B;font-size:16px;line-height:1">&times;</span>' +
    '</div>';
  }

  function formHtml() {
    var inp = 'width:100%;border:0.5px solid #E3E8E4;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:13px;color:#1B2A24';
    return '<div data-squad-form style="display:none;border-top:0.5px solid #E3E8E4;padding-top:14px;margin-top:4px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        '<div><div style="font-size:11px;color:#8A968F;margin-bottom:4px">Họ và tên *</div><input type="text" data-squad-name style="' + inp + '"></div>' +
        '<div><div style="font-size:11px;color:#8A968F;margin-bottom:4px">Số căn cước *</div><input type="text" data-squad-cccd style="' + inp + '"></div>' +
        '<div><div style="font-size:11px;color:#8A968F;margin-bottom:4px">Ngày sinh</div><input type="date" data-squad-dob style="' + inp + '"></div>' +
        '<div><div style="font-size:11px;color:#8A968F;margin-bottom:4px">Giới tính</div><select data-squad-gender style="' + inp + '"><option value="">—</option><option>Nam</option><option>Nữ</option></select></div>' +
        '<div><div style="font-size:11px;color:#8A968F;margin-bottom:4px">Điện thoại</div><input type="tel" data-squad-phone style="' + inp + '"></div>' +
        '<div><div style="font-size:11px;color:#8A968F;margin-bottom:4px">Địa chỉ</div><input type="text" data-squad-address style="' + inp + '"></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button class="btn-gold" data-squad-save type="button" style="border:none;cursor:pointer">Thêm vào đội</button>' +
        '<button class="btn-out" data-squad-cancel type="button" style="cursor:pointer">Hủy</button>' +
      '</div>' +
    '</div>';
  }

  function render(box, state) {
    var confirmed = state.athletes.filter(function (a) { return a.status === 'confirmed'; }).length;
    box.innerHTML =
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
        '<div style="font-size:13px;font-weight:600;color:#21428E">Vận động viên của đơn vị</div>' +
        '<div style="font-size:11.5px;color:#8A968F">' + state.athletes.length + ' người · ' + confirmed + ' đã xác nhận</div>' +
      '</div>' +
      '<div style="font-size:11.5px;color:#8A968F;line-height:1.7;margin-bottom:8px">' +
        'Đơn vị tự thêm/bớt vận động viên; Liên đoàn xác nhận từng người. Khi đăng ký giải thành tích cao, đơn vị chỉ chọn được những người đã xác nhận.<br>' +
        'Nhập từ tệp Excel (.xlsx): người chưa có hồ sơ hội viên sẽ được tạo hồ sơ mới (chờ Liên đoàn ghi nhận hội phí); người đã là hội viên chỉ được gắn mã, không tạo trùng.' +
      '</div>' +
      (state.athletes.length
        ? state.athletes.map(rowHtml).join('')
        : '<div style="font-size:12.5px;color:#8A968F;padding:12px 0;border-top:0.5px solid #E3E8E4">Chưa có vận động viên nào trong danh sách đội.</div>') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px">' +
        '<button class="btn-out" data-squad-add type="button" style="cursor:pointer"><i class="ti ti-plus"></i> Thêm vận động viên</button>' +
        '<button class="btn-out" data-squad-csv-pick type="button" style="cursor:pointer"><i class="ti ti-file-upload"></i> Nhập từ tệp Excel</button>' +
        '<span class="vb-link" data-squad-csv-sample style="cursor:pointer;font-size:12px">Tải tệp Excel mẫu</span>' +
        '<input type="file" data-squad-csv-file accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" style="display:none">' +
      '</div>' +
      formHtml() +
      '<div data-squad-ok style="display:none;margin-top:10px;font-size:12.5px;color:#00814D"></div>' +
      '<div data-squad-err style="display:none;margin-top:10px;font-size:12.5px;color:#9E2A2B"></div>';
    wire(box, state);
  }

  var COLS = ['Họ và tên', 'Số căn cước', 'Ngày sinh (yyyy-mm-dd)', 'Giới tính', 'Điện thoại', 'Địa chỉ'];
  var XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

  /* Thư viện đọc/ghi Excel chỉ tải khi đội thật sự bấm nhập hoặc tải mẫu —
     trang hội viên không phải gánh thêm ~900KB cho người không dùng tới. */
  var xlsxLoading = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxLoading) {
      xlsxLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = XLSX_URL;
        s.onload = function () { resolve(window.XLSX); };
        s.onerror = function () { xlsxLoading = null; reject(new Error('Không tải được bộ đọc Excel. Kiểm tra kết nối rồi thử lại.')); };
        document.head.appendChild(s);
      });
    }
    return xlsxLoading;
  }

  /* Ô ngày của Excel là số/Date, không phải chuỗi — chuẩn hoá về yyyy-mm-dd để
     máy chủ nhận đúng như khi gõ tay. Ô chữ thì giữ nguyên người dùng gõ. */
  function cellText(v) {
    if (v == null) return '';
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return '';
      var p = function (x) { return String(x).padStart(2, '0'); };
      return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate());
    }
    return String(v).trim();
  }

  /** Bảng (mảng các dòng) → danh sách VĐV; bỏ dòng tiêu đề nếu có. */
  function rowsToAthletes(rows) {
    rows = (rows || []).filter(function (r) { return r.some(function (c) { return cellText(c); }); });
    if (rows.length && /họ|tên|name/i.test(cellText(rows[0][0]))) rows = rows.slice(1);
    return rows.map(function (c) {
      return {
        fullName: cellText(c[0]), cccd: cellText(c[1]),
        dob: cellText(c[2]) || undefined, gender: cellText(c[3]),
        phone: cellText(c[4]), address: cellText(c[5]),
      };
    }).filter(function (r) { return r.fullName || r.cccd; });
  }

  async function readExcelFile(file) {
    var X = await loadXlsx();
    var wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    var ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    return rowsToAthletes(X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }));
  }

  async function downloadSample() {
    var X = await loadXlsx();
    /* Cột căn cước + điện thoại để dạng chữ: gõ số trần thì Excel làm mất số 0
       đầu (0909... → 909...). */
    var ws = X.utils.aoa_to_sheet([
      COLS,
      ['Nguyễn Văn A', '079098001234', '1998-04-12', 'Nam', '0909123456', 'Quận 1, TP.HCM'],
    ]);
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 30 }];
    for (var r = 2; r <= 200; r++) {
      ['B', 'C', 'E'].forEach(function (col) {
        var ref = col + r;
        if (!ws[ref]) ws[ref] = { t: 's', v: '', z: '@' };
        else ws[ref].z = '@';
      });
    }
    ws['!ref'] = 'A1:F200';
    var wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'VĐV');
    X.writeFile(wb, 'mau-vdv-cua-doi.xlsx');
  }

  function wire(box, state) {
    var form = box.querySelector('[data-squad-form]');
    var ok = box.querySelector('[data-squad-ok]');
    var err = box.querySelector('[data-squad-err]');
    var msg = function (el, text) { if (el) { el.textContent = text || ''; el.style.display = text ? '' : 'none'; } };
    var val = function (sel) { var e = box.querySelector(sel); return e ? e.value.trim() : ''; };

    box.querySelector('[data-squad-add]').addEventListener('click', function () {
      msg(ok, ''); msg(err, '');
      form.style.display = '';
      var n = box.querySelector('[data-squad-name]');
      if (n) n.focus();
    });
    box.querySelector('[data-squad-cancel]').addEventListener('click', function () {
      form.style.display = 'none';
    });

    box.querySelector('[data-squad-save]').addEventListener('click', async function (e) {
      msg(ok, ''); msg(err, '');
      e.target.disabled = true;
      try {
        var out = await call('team-athletes/save', {
          fullName: val('[data-squad-name]'), cccd: val('[data-squad-cccd]'),
          dob: val('[data-squad-dob]') || undefined, gender: val('[data-squad-gender]'),
          phone: val('[data-squad-phone]'), address: val('[data-squad-address]'),
        });
        await reload(box, state, out.message);
      } catch (ex) {
        msg(err, ex.message);
        e.target.disabled = false;
      }
    });

    var csvPick = box.querySelector('[data-squad-csv-pick]');
    var csvFile = box.querySelector('[data-squad-csv-file]');
    csvPick.addEventListener('click', function () { csvFile.click(); });
    csvFile.addEventListener('change', async function () {
      var f = csvFile.files && csvFile.files[0];
      if (!f) return;
      msg(ok, ''); msg(err, '');
      try {
        if (!/\.xlsx?$/i.test(f.name)) throw new Error('Chỉ nhận tệp Excel (.xlsx). Tải tệp Excel mẫu để xem đúng định dạng.');
        var athletes = await readExcelFile(f);
        if (!athletes.length) {
          throw new Error('Không đọc được dòng nào trong tệp. Tải tệp Excel mẫu để xem đúng thứ tự cột.');
        }
        var out = await call('team-athletes/save-bulk', { athletes: athletes });
        await reload(box, state, out.message);
      } catch (ex) {
        msg(err, ex.message || 'Không đọc được tệp Excel.');
      } finally { csvFile.value = ''; }
    });
    box.querySelector('[data-squad-csv-sample]').addEventListener('click', function () {
      msg(err, '');
      downloadSample().catch(function (ex) { msg(err, ex.message); });
    });

    box.querySelectorAll('[data-squad-rm]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Bỏ vận động viên này khỏi danh sách đội?')) return;
        msg(ok, ''); msg(err, '');
        try {
          var out = await call('team-athletes/remove', { documentId: b.getAttribute('data-squad-rm') });
          await reload(box, state, out.message);
        } catch (ex) { msg(err, ex.message); }
      });
    });
  }

  async function reload(box, state, okText) {
    var out = await call('team-athletes/mine', {});
    state.athletes = out.athletes || [];
    render(box, state);
    if (okText) {
      var ok = box.querySelector('[data-squad-ok]');
      if (ok) { ok.textContent = okText; ok.style.display = ''; }
    }
  }

  var api = {
    /** Gắn khối quản lý danh sách đội vào `box`. Gọi lại được nhiều lần. */
    async mount(box) {
      if (!box) return;
      box.innerHTML = '<div style="font-size:12.5px;color:#8A968F">Đang tải danh sách vận động viên của đội…</div>';
      var state = { athletes: [] };
      try {
        var out = await call('team-athletes/mine', {});
        state.athletes = out.athletes || [];
      } catch (err) {
        box.innerHTML = '<div style="font-size:12.5px;color:#9E2A2B">' + esc(err.message) + '</div>';
        return;
      }
      render(box, state);
    },

    /** Danh sách đã được Liên đoàn xác nhận — dùng cho trang đăng ký giải. */
    async confirmed() {
      var out = await call('team-athletes/mine', {});
      return (out.athletes || []).filter(function (a) { return a.status === 'confirmed'; });
    },
  };

  window.VBSF_SQUAD = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
