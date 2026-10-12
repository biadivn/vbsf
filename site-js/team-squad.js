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
    var member = a.memberCode
      ? esc(a.memberCode) + (a.memberValid ? '' : ' (hết hiệu lực)')
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
        'Nhập từ tệp CSV: người chưa có hồ sơ hội viên sẽ được tạo hồ sơ mới (chờ Liên đoàn ghi nhận hội phí); người đã là hội viên chỉ được gắn mã, không tạo trùng.' +
      '</div>' +
      (state.athletes.length
        ? state.athletes.map(rowHtml).join('')
        : '<div style="font-size:12.5px;color:#8A968F;padding:12px 0;border-top:0.5px solid #E3E8E4">Chưa có vận động viên nào trong danh sách đội.</div>') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px">' +
        '<button class="btn-out" data-squad-add type="button" style="cursor:pointer"><i class="ti ti-plus"></i> Thêm vận động viên</button>' +
        '<button class="btn-out" data-squad-csv-pick type="button" style="cursor:pointer"><i class="ti ti-file-upload"></i> Nhập từ tệp CSV</button>' +
        '<span class="vb-link" data-squad-csv-sample style="cursor:pointer;font-size:12px">Tải tệp CSV mẫu</span>' +
        '<input type="file" data-squad-csv-file accept=".csv,text/csv" style="display:none">' +
      '</div>' +
      formHtml() +
      '<div data-squad-ok style="display:none;margin-top:10px;font-size:12.5px;color:#00814D"></div>' +
      '<div data-squad-err style="display:none;margin-top:10px;font-size:12.5px;color:#9E2A2B"></div>';
    wire(box, state);
  }

  /* CSV tối giản, có hỗ trợ ô bọc nháy kép vì tên/địa chỉ hay chứa dấu phẩy. */
  function parseCsv(text) {
    var rows = [], row = [], field = '', quoted = false;
    var push = function () { row.push(field); field = ''; };
    var endRow = function () {
      push();
      if (row.some(function (c) { return c.trim(); })) rows.push(row);
      row = [];
    };
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') push();
      else if (c === '\n') endRow();
      else if (c !== '\r') field += c;
    }
    if (field || row.length) endRow();
    return rows;
  }

  var CSV_COLS = ['Họ và tên', 'Số căn cước', 'Ngày sinh (yyyy-mm-dd)', 'Giới tính', 'Điện thoại', 'Địa chỉ'];

  function csvToAthletes(text) {
    var rows = parseCsv(text);
    if (rows.length && /họ|tên|name/i.test(rows[0][0] || '')) rows = rows.slice(1);
    return rows.map(function (c) {
      return {
        fullName: (c[0] || '').trim(), cccd: (c[1] || '').trim(),
        dob: (c[2] || '').trim() || undefined, gender: (c[3] || '').trim(),
        phone: (c[4] || '').trim(), address: (c[5] || '').trim(),
      };
    }).filter(function (r) { return r.fullName || r.cccd; });
  }

  function downloadSample() {
    var text = CSV_COLS.join(',') + '\n' +
      ['Nguyễn Văn A', '079098001234', '1998-04-12', 'Nam', '0909123456', 'Quận 1, TP.HCM'].join(',') + '\n';
    var blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mau-vdv-cua-doi.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
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
    csvFile.addEventListener('change', function () {
      var f = csvFile.files && csvFile.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = async function (ev) {
        msg(ok, ''); msg(err, '');
        var athletes = csvToAthletes(String(ev.target.result || ''));
        csvFile.value = '';
        if (!athletes.length) {
          msg(err, 'Không đọc được dòng nào trong tệp. Tải tệp CSV mẫu để xem đúng thứ tự cột.');
          return;
        }
        try {
          var out = await call('team-athletes/save-bulk', { athletes: athletes });
          await reload(box, state, out.message);
        } catch (ex) { msg(err, ex.message); }
      };
      reader.readAsText(f, 'utf-8');
    });
    box.querySelector('[data-squad-csv-sample]').addEventListener('click', downloadSample);

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
