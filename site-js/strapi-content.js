/* =========================================================
   VBSF PUBLIC SITE — LỚP DỮ LIỆU TỪ STRAPI

   Site public (index.html + pages/*.html) vốn là HTML tĩnh. File này nạp
   nội dung thật từ Strapi rồi render đè vào đúng các khối đã đánh dấu
   sẵn trong HTML (`[data-section]`, `[data-items]`, `[data-fill]`), giữ
   nguyên markup/class để không đụng tới CSS.

   Nguyên tắc: progressive enhancement — nếu Strapi không truy cập được
   (offline, chưa chạy backend, lỗi mạng) thì KHÔNG đụng gì vào DOM và
   site vẫn hiển thị nội dung tĩnh như cũ.

   Điểm nối với index.html:
   - VBSF_CONTENT.load()                  -> Promise<bundle>, cache 1 lần
   - VBSF_CONTENT.hydrate(pageId, el)     -> gọi TRƯỚC initFns[pageId]
   - VBSF_CONTENT.afterNav(dest, el, ds)  -> gọi sau khi điều hướng [data-go]
   ========================================================= */
(function () {
  'use strict';

  /* Địa chỉ Strapi do site-js/config.js quyết định (site public và Strapi ở hai
     domain khác nhau trên production). Nhánh dự phòng phía dưới để module vẫn
     chạy độc lập được trong unit test. */
  var STRAPI_URL =
    typeof window !== 'undefined' && typeof window.VBSF_STRAPI_URL === 'string'
      ? window.VBSF_STRAPI_URL
      : location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:1337'
      : '';

  var PAGE_SIZE = 200;

  /* ---------------- tiện ích ---------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /** '2026-06-12' -> '12/06/2026' */
  function fmtDate(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return String(iso);
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  /** '2026-06-12' -> {d:'12', m:'Th6'} cho khối lịch giải đấu */
  function dateBlock(iso) {
    if (!iso) return { d: '--', m: '' };
    var p = String(iso).slice(0, 10).split('-');
    return { d: p[2], m: 'Th' + parseInt(p[1], 10) };
  }

  /** 2485 -> '2.485' */
  function fmtPoints(n) {
    return Number(n || 0).toLocaleString('vi-VN');
  }

  function mediaUrl(m) {
    if (!m || !m.url) return '';
    return m.url.indexOf('http') === 0 ? m.url : STRAPI_URL + m.url;
  }

  /** Ảnh thật nếu có, không thì giữ nguyên ô placeholder .vb-ph của prototype. */
  function imageBox(media, styleAttr, iconSize) {
    var url = mediaUrl(media);
    if (url) {
      return (
        '<div style="' + styleAttr + ';background-image:url(\'' + esc(url) +
        '\');background-size:cover;background-position:center"></div>'
      );
    }
    return (
      '<div class="vb-ph" style="' + styleAttr + '"><i class="ti ti-photo"' +
      (iconSize ? ' style="font-size:' + iconSize + '"' : '') + '></i></div>'
    );
  }

  /** Ảnh đại diện tròn — dùng ảnh thật nếu hội viên đã tải lên, không thì giữ
      ô placeholder .vb-ph như prototype. */
  function avatarCircle(media, size, border, iconSize, margin) {
    var base = 'width:' + size + ';height:' + size + ';border-radius:50%;margin:' + (margin || '10px auto') +
      (border ? ';border:' + border : '');
    var url = mediaUrl(media);
    if (url) {
      return '<div style="' + base + ';background-image:url(\'' + esc(url) + '\');background-size:cover;background-position:center"></div>';
    }
    return '<div class="vb-ph" style="' + base + '"><i class="ti ti-user"' +
      (iconSize ? ' style="font-size:' + iconSize + '"' : '') + '></i></div>';
  }

  /** '200.000đ' -> 200000 (đọc mức phí trong Thông tin tổ chức). */
  function parseVnd(s) {
    var digits = String(s == null ? '' : s).replace(/[^\d]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }

  function byDateDesc(a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  }
  function byDateAsc(a, b) {
    return String(a.date || '').localeCompare(String(b.date || ''));
  }

  /* ---------------- tải dữ liệu ---------------- */

  async function apiRaw(path) {
    var res = await fetch(STRAPI_URL + '/api/' + path);
    if (!res.ok) throw new Error('Strapi ' + res.status + ' cho /' + path);
    return res.json();
  }

  async function api(path) {
    return (await apiRaw(path)).data;
  }

  /** Một trang dữ liệu + meta.pagination của Strapi. */
  async function apiPage(path, params) {
    var qs = Object.keys(params)
      .filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
      .map(function (k) { return k + '=' + encodeURIComponent(params[k]); })
      .join('&');
    var out = await apiRaw(path + (qs ? '?' + qs : ''));
    return { data: out.data || [], pagination: (out.meta && out.meta.pagination) || { page: 1, pageCount: 1, total: (out.data || []).length } };
  }

  /* Bộ nút phân trang dùng chung — dựng lại markup .vb-pg của prototype và gọi
     onGo(page) khi bấm. Hiển thị tối đa 5 số quanh trang hiện tại. */
  function renderPager(container, pagination, onGo) {
    if (!container) return;
    var page = pagination.page || 1;
    var last = pagination.pageCount || 1;
    if (last <= 1) { container.innerHTML = ''; return; }

    var from = Math.max(1, Math.min(page - 2, last - 4));
    var to = Math.min(last, from + 4);
    var html = '<span class="vb-pg' + (page === 1 ? ' dis' : '') + '" data-pg="' + (page - 1) +
      '"><i class="ti ti-chevron-left"></i></span>';
    for (var i = from; i <= to; i++) {
      html += '<span class="vb-pg' + (i === page ? ' on' : '') + '" data-pg="' + i + '">' + i + '</span>';
    }
    html += '<span class="vb-pg' + (page === last ? ' dis' : '') + '" data-pg="' + (page + 1) +
      '"><i class="ti ti-chevron-right"></i></span>';
    container.innerHTML = html;

    container.querySelectorAll('[data-pg]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('dis') || btn.classList.contains('on')) return;
        var target = parseInt(btn.getAttribute('data-pg'), 10);
        if (target >= 1 && target <= last) onGo(target);
      });
    });
  }

  function list(path, query) {
    return api(path + '?pagination[pageSize]=' + PAGE_SIZE + (query ? '&' + query : ''));
  }

  var bundlePromise = null;

  /* Mỗi nguồn dữ liệu tải độc lập: một endpoint hỏng thì chỉ mất đúng phần đó,
     các phần còn lại vẫn render. Trước đây dùng Promise.all nên chỉ cần
     "Thông tin tổ chức" chưa có dữ liệu (Strapi trả 404 cho single type rỗng)
     là cả trang mất sạch dữ liệu và rơi về bản tĩnh. */
  function load() {
    if (bundlePromise) return bundlePromise;

    var SOURCES = [
      { key: 'settings', fallback: {}, load: function () { return api('setting'); } },
      { key: 'contact', fallback: {}, load: function () { return api('contact-info'); } },
      { key: 'news', fallback: [], load: function () { return list('news-articles', 'sort=date:desc&populate=image'); } },
      { key: 'tournaments', fallback: [], load: function () { return list('tournaments', 'populate=prizes&populate=players'); } },
      { key: 'members', fallback: [], load: function () { return list('members', 'populate=disciplines&populate=avatar'); } },
      { key: 'memberOrgs', fallback: [], load: function () { return list('member-orgs'); } },
      { key: 'partners', fallback: [], load: function () { return list('partners', 'populate=image'); } },
      { key: 'libraryDocs', fallback: [], load: function () { return list('library-docs', 'populate=file'); } },
      { key: 'mediaItems', fallback: [], load: function () { return list('media-items', 'populate=assets'); } },
      { key: 'leaders', fallback: [], load: function () { return list('leaders', 'sort=order:asc&populate=photo'); } },
      { key: 'pageContent', fallback: {}, load: function () { return api('page-content'); } },
    ];

    bundlePromise = Promise.all(
      SOURCES.map(function (source) {
        return source.load().catch(function (err) {
          return { __failed: source.key, error: err };
        });
      })
    ).then(function (results) {
      var bundle = {};
      var failed = [];
      results.forEach(function (value, i) {
        var source = SOURCES[i];
        if (value && value.__failed) {
          failed.push(source.key);
          bundle[source.key] = source.fallback;
        } else {
          bundle[source.key] = value || source.fallback;
        }
      });

      // Hỏng sạch thì coi như không có Strapi — giữ nguyên nội dung tĩnh.
      if (failed.length === SOURCES.length) {
        console.warn('[VBSF] Không nạp được dữ liệu từ Strapi — giữ nội dung tĩnh.');
        return null;
      }
      if (failed.length) {
        console.warn('[VBSF] Thiếu dữ liệu cho: ' + failed.join(', ') + ' — các phần còn lại vẫn hiển thị.');
      }
      return bundle;
    });

    return bundlePromise;
  }

  /** POST tới endpoint form công khai; ném Error kèm thông báo của backend. */
  async function submitForm(path, payload) {
    var res;
    try {
      res = await fetch(STRAPI_URL + '/api/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
    }
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((out.error && out.error.message) || 'Không gửi được. Vui lòng thử lại.');
    return out.message || 'Đã gửi.';
  }

  /* ---------------- suy dẫn dữ liệu ---------------- */

  /* Site phân biệt 4 trạng thái giải đấu; Strapi lưu 3 (`status`) + trạng thái
     đăng ký ở `note`, nên "sắp diễn ra" tách đôi dựa vào note. */
  function siteStatus(t) {
    if (t.status === 'ongoing') return 'live';
    if (t.status === 'completed') return 'finished';
    return /sắp/i.test(t.note || '') ? 'upcoming-soon' : 'upcoming-open';
  }

  function statusLabel(t) {
    var s = siteStatus(t);
    if (s === 'live') return 'Đang diễn ra · Trực tiếp';
    if (s === 'finished') return 'Đã kết thúc';
    return t.note || (s === 'upcoming-soon' ? 'Sắp mở đăng ký' : 'Mở đăng ký');
  }

  /** Bảng xếp hạng theo (nhóm, bộ môn) — gom từ component disciplines. */
  function rankingRows(members, group, category) {
    var rows = [];
    members.forEach(function (m) {
      if (group && m.group !== group) return;
      (m.disciplines || []).forEach(function (d) {
        if (d.category !== category) return;
        rows.push({
          rank: d.rank,
          name: m.name,
          avatar: m.avatar,
          club: m.club || m.province || '',
          province: m.province || '',
          points: d.points,
          matches: d.matches,
          trend: d.trend,
          trendValue: d.trendValue,
        });
      });
    });
    return rows.sort(function (a, b) {
      if (a.rank != null && b.rank != null) return a.rank - b.rank;
      return (b.points || 0) - (a.points || 0);
    });
  }

  /* Các cặp (nhóm | bộ môn) có mặt trong bảng xếp hạng, giữ thứ tự
     Nam -> Nữ -> VĐV trẻ như prototype. */
  var DISCIPLINE_ORDER = [
    'Pool 8 bi', 'Pool 9 bi', 'Pool 10 bi',
    'Carom 1 băng', 'Carom 3 băng', 'Snooker', 'English Billiards',
  ];

  function rankingKeys(members) {
    var order = ['Nam', 'Nữ', 'VĐV trẻ'];
    var seen = {};
    var keys = [];
    members.forEach(function (m) {
      (m.disciplines || []).forEach(function (d) {
        var k = m.group + '|' + d.category;
        if (seen[k]) return;
        seen[k] = true;
        keys.push({ key: k, group: m.group, category: d.category });
      });
    });
    return keys.sort(function (a, b) {
      var ga = order.indexOf(a.group), gb = order.indexOf(b.group);
      if (ga !== gb) return ga - gb;
      var da = DISCIPLINE_ORDER.indexOf(a.category), db = DISCIPLINE_ORDER.indexOf(b.category);
      if (da !== db) return (da < 0 ? 99 : da) - (db < 0 ? 99 : db);
      return a.category.localeCompare(b.category, 'vi');
    });
  }

  /** Dataset gắn lên phần tử [data-go] của 1 giải đấu — trang chi tiết đọc lại. */
  function tournamentDataset(t) {
    var ds = {
      doc: t.documentId,
      status: siteStatus(t),
      statuslabel: statusLabel(t),
      name: t.name,
      entryfee: t.entryFee || '',
      disc: t.category || '',
      date: fmtDate(t.date),
      loc: t.location || '',
    };
    if (t.liveRound) {
      ds.round = t.liveRound;
      ds.round2 = t.liveRound + ' · Kết quả các trận đấu loại';
    }
    if (t.champion) ds.champion = t.champion;
    if (t.runnerUp) ds.runnerup = t.runnerUp;
    if (t.third) ds.third = t.third;
    return ds;
  }

  function dsAttrs(ds) {
    return Object.keys(ds)
      .filter(function (k) { return ds[k] !== '' && ds[k] != null; })
      .map(function (k) { return 'data-' + k + '="' + esc(ds[k]) + '"'; })
      .join(' ');
  }

  /* ---------------- render từng khối ---------------- */

  function section(page, key) {
    return page.querySelector('[data-section="' + key + '"]');
  }
  function items(el) {
    return el ? el.querySelector('[data-items]') : null;
  }
  function fill(page, key, text) {
    page.querySelectorAll('[data-fill="' + key + '"]').forEach(function (n) {
      n.textContent = text;
    });
  }

  /* --- Tin tức --- */

  function newsCardHome(n) {
    return (
      '<div class="vb-card" data-go="tin-tuc-chi-tiet" data-doc="' + esc(n.documentId) +
      '" style="cursor:pointer">' +
      imageBox(n.image, 'height:108px', '24px') +
      '<div style="padding:11px 13px"><span class="vb-tag">' + esc(n.category || '') + '</span>' +
      '<div style="font-size:13px;line-height:1.35;margin-top:8px;font-weight:500">' + esc(n.title) + '</div>' +
      '<div style="font-size:10.5px;color:#8A968F;margin-top:6px">' + fmtDate(n.date) + '</div></div></div>'
    );
  }

  function newsCardList(n) {
    return (
      '<div class="vb-card" data-go="tin-tuc-chi-tiet" data-doc="' + esc(n.documentId) +
      '" style="cursor:pointer">' +
      imageBox(n.image, 'height:104px', '24px') +
      '<div style="padding:12px 14px"><span class="vb-tag">' + esc(n.category || '') + '</span>' +
      '<div class="vb-ttl">' + esc(n.title) + '</div>' +
      '<div class="vb-ex">' + esc(n.excerpt || '') + '</div>' +
      '<div class="vb-dt">' + fmtDate(n.date) + '</div></div></div>'
    );
  }

  function newsRowSmall(n, thumbStyle) {
    return (
      '<div data-go="tin-tuc-chi-tiet" data-doc="' + esc(n.documentId) +
      '" style="display:flex;gap:10px;cursor:pointer">' +
      imageBox(n.image, thumbStyle) +
      '<div style="font-size:12.5px;color:#1B2A24;line-height:1.35">' + esc(n.title) +
      '<div style="color:#8A968F;font-size:10.5px;margin-top:3px">' + fmtDate(n.date) + '</div></div></div>'
    );
  }

  /* --- Giải đấu --- */

  function tournamentRowHome(t) {
    var db = dateBlock(t.date);
    return (
      '<div style="display:flex;align-items:center;gap:14px;border:0.5px solid #E3E8E4;border-radius:8px;padding:10px 14px;cursor:pointer" ' +
      'data-go="giai-dau-chi-tiet" ' + dsAttrs(tournamentDataset(t)) + '>' +
      '<div class="vb-dateblk"><div class="d">' + db.d + '</div><div class="m">' + db.m + '</div></div>' +
      '<div style="flex:1"><div style="font-size:13.5px;font-weight:500">' + esc(t.name) + '</div>' +
      '<div style="font-size:11.5px;color:#8A968F;margin-top:2px"><i class="ti ti-map-pin"></i> ' + esc(t.location || '') + '</div></div>' +
      '<span class="vb-tag">' + esc(t.category || '') + '</span></div>'
    );
  }

  function tournamentRowUpcoming(t) {
    var db = dateBlock(t.date);
    var ds = tournamentDataset(t);
    var open = siteStatus(t) === 'upcoming-open';
    var badge = open
      ? '<span class="vb-badge" style="background:#EAF1FB;color:#0190BF">Mở đăng ký</span>'
      : '<span class="vb-badge" style="background:#F4F1E8;color:#9A7B2E">Sắp mở</span>';
    var regBtn = open
      ? '<a class="btn-out" data-go="giai-dau-dang-ky" ' + dsAttrs(ds) +
        ' style="padding:6px 14px;font-size:11.5px;white-space:nowrap">Đăng ký</a>'
      : '';
    var meta = esc(t.location || '') + (t.participants ? ' · ' + t.participants + ' cơ thủ' : '');
    return (
      '<div class="vb-row" style="flex-wrap:wrap">' +
      '<div class="vb-dateblk"><div class="d">' + db.d + '</div><div class="m">' + db.m + '</div></div>' +
      '<div style="flex:1"><div style="font-size:13.5px;font-weight:500;color:#1B2A24;cursor:pointer" data-go="giai-dau-chi-tiet" ' +
      dsAttrs(ds) + '>' + esc(t.name) + '</div>' +
      '<div style="font-size:11.5px;color:#8A968F;margin-top:3px"><i class="ti ti-map-pin"></i> ' + meta + '</div></div>' +
      '<span class="vb-tag">' + esc(t.category || '') + '</span>' + badge + regBtn + '</div>'
    );
  }

  function tournamentRowFinished(t, standings) {
    var ds = tournamentDataset(t);
    if (standings && standings.length) ds.more = JSON.stringify(standings);
    return (
      '<div class="vb-row"><div style="flex:1">' +
      '<div style="font-size:13.5px;font-weight:500;color:#1B2A24;cursor:pointer" data-go="giai-dau-chi-tiet" ' +
      dsAttrs(ds) + '>' + esc(t.name) + '</div>' +
      '<div style="font-size:11.5px;color:#8A968F;margin-top:3px"><i class="ti ti-trophy" style="color:var(--gold-ink)"></i> Vô địch: ' +
      esc(t.champion || '—') + ' · ' + fmtDate(t.date) + '</div></div>' +
      '<span class="vb-tag">' + esc(t.category || '') + '</span>' +
      '<span class="vb-link" style="cursor:pointer" data-go="giai-dau-ket-qua" ' + dsAttrs(ds) + '>Xem kết quả →</span></div>'
    );
  }

  /** Bảng xếp hạng chung cuộc (hạng 4+) suy từ ranking quốc gia của nội dung đó. */
  function finalStandings(data, t) {
    return rankingRows(data.members, null, t.category)
      .filter(function (r) { return r.rank && r.rank >= 4; })
      .slice(0, 9)
      .map(function (r) { return { r: r.rank, n: r.name, c: r.club || r.province }; });
  }

  /* ---------------- hydrate theo từng trang ---------------- */

  var RENDER = {};

  RENDER['trang-chu'] = function (page, data) {
    var s = data.settings;

    // Hero — tiêu đề/phụ đề lấy từ Thông tin tổ chức, ảnh từ giải nổi bật.
    var hero = section(page, 'hero');
    if (hero && (s.heroTitle || s.heroSubtitle)) {
      var titleEl = hero.querySelector('[style*="font-size:18px"]');
      var subEl = titleEl && titleEl.nextElementSibling;
      if (titleEl && s.heroTitle) titleEl.textContent = s.heroTitle;
      if (subEl && s.heroSubtitle) subEl.textContent = s.heroSubtitle;
    }

    // Tin nổi bật (cột phải hero)
    if (hero && data.news.length) {
      var sideWrap = hero.children[1];
      if (sideWrap) {
        var head = sideWrap.firstElementChild;
        var sideNews = data.news.slice(3, 6);
        if (!sideNews.length) sideNews = data.news.slice(0, 3);
        sideWrap.innerHTML = head.outerHTML + sideNews.map(function (n) {
          return newsRowSmall(n, 'width:64px;height:48px;border-radius:6px;flex-shrink:0');
        }).join('');
      }
    }

    // Tin tức mới nhất
    var newsBox = items(section(page, 'tin-tuc-home'));
    if (newsBox && data.news.length) {
      newsBox.innerHTML = data.news.slice(0, 3).map(newsCardHome).join('');
    }

    // Lịch giải đấu sắp diễn ra — giải đang diễn ra trước, rồi tới ngày gần nhất
    var schedule = items(section(page, 'lich-giai-dau'));
    if (schedule) {
      var upcoming = data.tournaments
        .filter(function (t) { return t.status !== 'completed'; })
        .sort(function (a, b) {
          if (a.status === 'ongoing' && b.status !== 'ongoing') return -1;
          if (b.status === 'ongoing' && a.status !== 'ongoing') return 1;
          return byDateAsc(a, b);
        })
        .slice(0, 3);
      if (upcoming.length) schedule.innerHTML = upcoming.map(tournamentRowHome).join('');
    }

    // Top players — mỗi ô là 1 cặp (nhóm | bộ môn), tự động chạy slide
    var top = section(page, 'top-players');
    if (top && data.members.length) {
      var keys = rankingKeys(data.members);
      var grids = top.querySelectorAll('.tp-grid');
      var male = keys.filter(function (k) { return k.group === 'Nam'; });
      var rest = keys.filter(function (k) { return k.group !== 'Nam'; });

      function boxHtml(k) {
        var top3 = rankingRows(data.members, k.group, k.category).slice(0, 3);
        if (!top3.length) return '';
        var label = k.group === 'Nam' ? k.category + ' nam'
          : k.group === 'Nữ' ? k.category + ' nữ'
          : k.category + ' trẻ';
        return (
          '<div class="tp-box vb-card" data-tp-cat="' + esc(label) + '">' +
          '<div style="padding:9px 12px;border-bottom:0.5px solid #EEF1EE;font-size:11.5px;font-weight:600;color:#21428E">' +
          esc(label) + '</div><div class="tp-slides" style="padding:12px;text-align:center">' +
          top3.map(function (r, i) {
            return (
              '<div class="tp-slide' + (i === 0 ? ' on' : '') + '">' +
              avatarCircle(r.avatar, '44px', '', '', '0 auto 6px') +
              '<div style="font-size:11px;font-weight:600;color:#21428E">HẠNG ' + (r.rank || i + 1) + '</div>' +
              '<div style="font-size:12px;margin-top:2px">' + esc(r.name) + '</div>' +
              '<div style="font-size:12.5px;font-weight:600;color:#21428E;margin-top:2px">' + fmtPoints(r.points) + ' đ</div></div>'
            );
          }).join('') +
          '</div></div>'
        );
      }
      if (grids[0] && male.length) grids[0].innerHTML = male.map(boxHtml).join('');
      if (grids[1] && rest.length) grids[1].innerHTML = rest.map(boxHtml).join('');
    }

    // Dải logo đối tác
    var partnerBox = items(section(page, 'doi-tac-home'));
    if (partnerBox && data.partners.length) {
      partnerBox.innerHTML = data.partners.slice(0, 5).map(function (p) {
        return imageBox(p.image, 'width:96px;height:40px;border-radius:6px').replace('ti-photo', 'ti-building');
      }).join('');
    }
  };

  /* Trang Tin tức phân trang THẬT: lọc chuyên mục + tìm kiếm + đổi trang đều
     gửi query lên Strapi, chỉ tải đúng số bài của trang đang xem. */
  var NEWS_PAGE_SIZE = 6;

  RENDER['tin-tuc'] = function (page, data) {
    if (!data.news.length) return;
    var featured = data.news.filter(function (n) { return n.featured; })[0] || data.news[0];

    // Bài nổi bật
    var feat = section(page, 'tin-noi-bat');
    if (feat) {
      feat.setAttribute('data-doc', featured.documentId);
      var ph = feat.querySelector('.vb-ph');
      var url = mediaUrl(featured.image);
      if (ph && url) {
        ph.classList.remove('vb-ph');
        ph.innerHTML = '';
        ph.style.backgroundImage = "url('" + url + "')";
        ph.style.backgroundSize = 'cover';
        ph.style.backgroundPosition = 'center';
      }
      var body = feat.children[1];
      if (body) {
        body.querySelector('.vb-tag').textContent = (featured.category || '').toUpperCase();
        body.querySelector('[style*="font-size:18px"]').textContent = featured.title;
        body.querySelector('.vb-ex').textContent = featured.excerpt || '';
        body.querySelector('.vb-dt').textContent = fmtDate(featured.date);
      }
    }

    // Sidebar "Tin xem nhiều"
    var side = section(page, 'sidebar-tin-tuc');
    if (side) {
      var sideHead = side.firstElementChild;
      side.innerHTML = sideHead.outerHTML + data.news.slice(0, 3).map(function (n) {
        return (
          '<div data-go="tin-tuc-chi-tiet" data-doc="' + esc(n.documentId) +
          '" style="display:flex;gap:10px;margin-bottom:12px;cursor:pointer">' +
          imageBox(n.image, 'width:54px;height:42px;border-radius:6px;flex-shrink:0') +
          '<div style="font-size:12.5px;color:#1B2A24;line-height:1.35">' + esc(n.title) + '</div></div>'
        );
      }).join('');
    }

    var listSec = section(page, 'danh-sach-tin');
    var grid = items(listSec);
    if (!grid) return;
    var pagerBox = listSec.querySelector('[style*="justify-content:center"]');
    var searchInput = page.querySelector('[data-news-search]');
    var pills = page.querySelectorAll('.vb-pill');

    // initNews() của index.html lọc phía client trên các thẻ đã render — đánh dấu
    // để nó nhường quyền cho phân trang/lọc phía máy chủ ở đây.
    page.setAttribute('data-server-driven', '1');

    var state = { page: 1, category: '', q: '' };
    var timer = null;

    async function show() {
      grid.innerHTML = '<div style="font-size:12.5px;color:#8A968F">Đang tải…</div>';
      var res = await apiPage('news-articles', {
        'sort': 'date:desc',
        'populate': 'image',
        'pagination[page]': state.page,
        'pagination[pageSize]': NEWS_PAGE_SIZE,
        'filters[documentId][$ne]': featured.documentId,
        'filters[category][$eq]': state.category || undefined,
        'filters[title][$containsi]': state.q || undefined,
      });
      grid.innerHTML = res.data.length
        ? res.data.map(newsCardList).join('')
        : '<div style="font-size:12.5px;color:#8A968F">Không tìm thấy bài viết phù hợp.</div>';
      renderPager(pagerBox, res.pagination, function (p) { state.page = p; show(); });
    }

    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        pills.forEach(function (x) { x.classList.toggle('on', x === pill); });
        var label = pill.textContent.trim();
        state.category = label === 'Tất cả' ? '' : label;
        state.page = 1;
        show();
      });
    });
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.q = searchInput.value.trim();
          state.page = 1;
          show();
        }, 300);
      });
    }
    show();
  };

  RENDER['giai-dau'] = function (page, data) {
    if (!data.tournaments.length) return;

    var live = data.tournaments.filter(function (t) { return t.status === 'ongoing'; });
    var liveSec = section(page, 'dang-dien-ra');
    if (liveSec) {
      if (!live.length) {
        liveSec.style.display = 'none';
      } else {
        var t = live[0];
        var ds = tournamentDataset(t);
        liveSec.innerHTML =
          '<div class="vb-stag">Đang diễn ra</div>' +
          '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:16px;border:1px solid #21428E;border-radius:10px;padding:16px 18px;margin-top:10px;margin-bottom:24px;background:linear-gradient(0deg,#F3F8F5,#fff)">' +
          '<div style="flex:1;min-width:240px"><span class="vb-badge" style="background:#FDECEC;color:#9E2A2B">' +
          '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#9E2A2B;vertical-align:1px;margin-right:4px"></span>TRỰC TIẾP</span>' +
          '<div style="font-size:17px;font-weight:600;color:#21428E;margin-top:8px;cursor:pointer" data-go="giai-dau-chi-tiet" ' +
          dsAttrs(ds) + '>' + esc(t.name) + '</div>' +
          '<div style="font-size:12px;color:#5C6B63;margin-top:4px"><i class="ti ti-map-pin"></i> ' +
          esc(t.location || '') + (t.liveRound ? ' · ' + esc(t.liveRound) : '') + '</div>' +
          '<div style="margin-top:8px"><span class="vb-tag">' + esc(t.category || '') + '</span>' +
          (t.participants ? ' <span class="vb-tag" style="background:#F1F1EE;color:#5C6B63">' + t.participants + ' cơ thủ</span>' : '') +
          '</div></div>' +
          '<span class="vb-link" style="font-weight:500;cursor:pointer" data-go="giai-dau-truc-tiep" ' + dsAttrs(ds) +
          '>Xem kết quả trực tiếp →</span></div>';
      }
    }

    var upcomingBox = items(section(page, 'sap-dien-ra'));

    var doneBox = items(section(page, 'ket-qua-gan-day'));

    /* Hai ô chọn "nội dung" và "năm" trước đây chỉ là nhãn tĩnh. Nay dựng lựa
       chọn từ chính dữ liệu đang có và lọc thật cả 3 khối. */
    var catSel = page.querySelector('[data-td-category]');
    var yearSel = page.querySelector('[data-td-year]');
    var yearOf = function (t) { return t.date ? String(t.date).slice(0, 4) : ''; };

    function fillOptions(sel, values, allLabel) {
      if (!sel || sel.options.length > 1) return;
      sel.innerHTML = '<option value="">' + allLabel + '</option>' +
        values.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
    }
    fillOptions(catSel, [...new Set(data.tournaments.map(function (t) { return t.category; }).filter(Boolean))]
      .sort(function (a, b) { return DISCIPLINE_ORDER.indexOf(a) - DISCIPLINE_ORDER.indexOf(b); }), 'Tất cả nội dung');
    fillOptions(yearSel, [...new Set(data.tournaments.map(yearOf).filter(Boolean))].sort().reverse(), 'Tất cả năm');

    function matches(t) {
      if (catSel && catSel.value && t.category !== catSel.value) return false;
      if (yearSel && yearSel.value && yearOf(t) !== yearSel.value) return false;
      return true;
    }

    function renderUpcoming() {
      if (!upcomingBox) return;
      var list = data.tournaments.filter(function (t) { return t.status === 'upcoming' && matches(t); }).sort(byDateAsc);
      upcomingBox.innerHTML = list.length
        ? list.map(tournamentRowUpcoming).join('')
        : '<div style="font-size:12.5px;color:#8A968F">Không có giải đấu nào phù hợp bộ lọc.</div>';
    }
    function renderDone() {
      if (!doneBox) return;
      var list = data.tournaments.filter(function (t) { return t.status === 'completed' && matches(t); }).sort(byDateDesc);
      doneBox.innerHTML = list.length
        ? list.map(function (t) { return tournamentRowFinished(t, finalStandings(data, t)); }).join('')
        : '<div style="font-size:12.5px;color:#8A968F">Không có kết quả nào phù hợp bộ lọc.</div>';
    }
    function renderLive() {
      if (!liveSec) return;
      var visible = live.filter(matches);
      liveSec.style.display = visible.length ? '' : 'none';
    }

    [catSel, yearSel].forEach(function (sel) {
      if (sel) sel.addEventListener('change', function () { renderUpcoming(); renderDone(); renderLive(); });
    });
    renderUpcoming();
    renderDone();
  };

  RENDER['ranking'] = function (page, data) {
    if (!data.members.length) return;
    var keys = rankingKeys(data.members);
    if (!keys.length) return;

    // Carousel Top 3
    var carousel = section(page, 'rk-carousel');
    if (carousel) {
      carousel.querySelectorAll('.rk-car-slide').forEach(function (s) { s.remove(); });
      var html = keys.map(function (k, i) {
        var top3 = rankingRows(data.members, k.group, k.category).slice(0, 3);
        if (top3.length < 1) return '';
        function pod(r, place) {
          if (!r) return '';
          if (place === 1) {
            return (
              '<div class="pod" style="border-top:3px solid var(--gold);box-shadow:0 6px 20px rgba(12,58,42,.10);padding-top:22px;padding-bottom:22px">' +
              '<div style="font-size:11px;font-weight:700;color:#21428E"><i class="ti ti-crown"></i> HẠNG 1</div>' +
              avatarCircle(r.avatar, '66px', '2px solid #21428E', '28px') +
              '<div style="font-size:14px;font-weight:600;color:#1B2A24">' + esc(r.name) + '</div>' +
              '<div style="font-size:11px;color:#8A968F;margin-top:1px">' + esc(r.club || r.province) + '</div>' +
              '<div style="font-size:18px;font-weight:700;color:#21428E;margin-top:6px">' + fmtPoints(r.points) + '</div></div>'
            );
          }
          var border = place === 2 ? '#B4B2A9' : '#C99A6B';
          var color = place === 2 ? '#888780' : '#A9784E';
          return (
            '<div class="pod" style="border-top:3px solid ' + border + '">' +
            '<div style="font-size:11px;font-weight:600;color:' + color + '"><i class="ti ti-medal"></i> HẠNG ' + place + '</div>' +
            avatarCircle(r.avatar, '52px', '', '22px') +
            '<div style="font-size:13px;font-weight:500;color:#1B2A24">' + esc(r.name) + '</div>' +
            '<div style="font-size:11px;color:#8A968F;margin-top:1px">' + esc(r.club || r.province) + '</div>' +
            '<div style="font-size:15px;font-weight:600;color:#21428E;margin-top:6px">' + fmtPoints(r.points) + '</div></div>'
          );
        }
        return (
          '<div class="rk-car-slide' + (i === 0 ? ' on' : '') + '" data-car-key="' + esc(k.key) +
          '" data-car-group="' + esc(k.group) + '" data-car-disc="' + esc(k.category) + '">' +
          '<div style="display:flex;gap:12px;align-items:flex-end">' +
          pod(top3[1], 2) + pod(top3[0], 1) + pod(top3[2], 3) +
          '</div></div>'
        );
      }).join('');
      carousel.insertAdjacentHTML('beforeend', html);
    }

    // Pill chọn nhóm/bộ môn — dựng lại theo đúng các cặp đang có dữ liệu
    var pillRows = page.querySelectorAll('[data-rank-key]');
    if (pillRows.length) {
      var groups = ['Nam', 'Nữ', 'VĐV trẻ'];
      var pillWraps = {};
      page.querySelectorAll('.vb-pill[data-rank-key]').forEach(function (p) {
        var g = p.getAttribute('data-rank-key').split('|')[0];
        if (!pillWraps[g]) pillWraps[g] = p.parentNode;
      });
      groups.forEach(function (g) {
        var wrap = pillWraps[g];
        if (!wrap) return;
        var mine = keys.filter(function (k) { return k.group === g; });
        wrap.innerHTML = mine.map(function (k, i) {
          return '<span class="vb-pill' + (k.key === keys[0].key ? ' on' : '') + '" data-rank-key="' +
            esc(k.key) + '">' + esc(k.category) + '</span>';
        }).join('');
      });
    }

    // Bảng hạng 4+ — đổi theo cặp đang chọn
    var tbody = items(section(page, 'bang-xep-hang'));
    if (tbody) {
      var searchInput = page.querySelector('[data-rank-search]');
      var currentKey = keys[0].key;
      var renderTable = function (key) {
        currentKey = key;
        var parts = key.split('|');
        var province = (page.querySelector('[data-rk-province]') || {}).value || '';
        var rows = rankingRows(data.members, parts[0], parts[1]).filter(function (r) {
          if (province && r.province !== province) return false;
          return !r.rank || r.rank >= 4;
        });
        tbody.innerHTML = rows.length
          ? rows.map(function (r) {
              var trend =
                r.trend === 'up'
                  ? '<span class="up"><i class="ti ti-caret-up-filled" style="font-size:9px"></i>' + (r.trendValue || 0) + '</span>'
                  : r.trend === 'down'
                  ? '<span class="dn"><i class="ti ti-caret-down-filled" style="font-size:9px"></i>' + (r.trendValue || 0) + '</span>'
                  : '<span class="eq"><i class="ti ti-minus" style="font-size:9px"></i></span>';
              return (
                '<tr><td><b>' + (r.rank || '') + '</b> ' + trend + '</td>' +
                '<td><span class="av"><i class="ti ti-user" style="font-size:15px"></i></span>' + esc(r.name) + '</td>' +
                '<td style="color:#5C6B63">' + esc(r.province || r.club) + '</td>' +
                '<td style="text-align:right;color:#5C6B63">' + (r.matches || 0) + '</td>' +
                '<td style="text-align:right;font-weight:600;color:#21428E">' + fmtPoints(r.points) + '</td></tr>'
              );
            }).join('')
          : '<tr><td colspan="5" style="color:#8A968F">Chưa có cơ thủ nào từ hạng 4 ở nội dung này.</td></tr>';
        // Bảng được dựng lại khi đổi bộ môn -> áp lại từ khoá đang tìm.
        var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
        if (q) {
          tbody.querySelectorAll('tr').forEach(function (tr) {
            var nameCell = tr.querySelectorAll('td')[1];
            tr.style.display = nameCell && nameCell.textContent.trim().toLowerCase().indexOf(q) > -1 ? '' : 'none';
          });
        }
      };
      /* Ô "Toàn quốc" trước đây là nhãn tĩnh — nay lọc thật theo tỉnh/thành của
         chính các cơ thủ đang có trong bảng. */
      var provSel = page.querySelector('[data-rk-province]');
      if (provSel && provSel.options.length <= 1) {
        var provinces = [...new Set(data.members.map(function (m) { return m.province; }).filter(Boolean))]
          .sort(function (a, b) { return a.localeCompare(b, 'vi'); });
        provSel.innerHTML = '<option value="">Toàn quốc</option>' +
          provinces.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('');
      }
      var renderCurrent = function () { renderTable(currentKey); };
      if (provSel) provSel.addEventListener('change', renderCurrent);

      renderTable(keys[0].key);
      // Đổi bảng khi bấm pill hoặc khi carousel tự chuyển slide.
      page.addEventListener('click', function (e) {
        var pill = e.target.closest('[data-rank-key]');
        if (pill && page.contains(pill)) renderTable(pill.getAttribute('data-rank-key'));
      });
      var carEl = section(page, 'rk-carousel');
      if (carEl) {
        new MutationObserver(function () {
          var on = carEl.querySelector('.rk-car-slide.on');
          if (on) renderTable(on.getAttribute('data-car-key'));
        }).observe(carEl, { attributes: true, attributeFilter: ['class'], subtree: true });
      }
    }
  };

  RENDER['thu-vien'] = function (page, data) {
    var docsBox = items(section(page, 'van-ban-luat'));
    if (docsBox && data.libraryDocs.length) {
      var TAG_STYLE = {
        'Quy chế': 'background:#E8EEF9;color:#21428E',
        'Luật': 'background:#EAF1FB;color:#0190BF',
        'Biểu mẫu': 'background:#F4F1E8;color:#9A7B2E',
        'Thông báo': 'background:#F1F1EE;color:#5C6B63',
      };
      // Bộ lọc của site dùng 2 nhóm: "luật thi đấu" và "văn bản".
      var catOf = function (d) { return d.tag === 'Luật' ? 'luật thi đấu' : 'văn bản'; };
      docsBox.innerHTML = data.libraryDocs.map(function (d) {
        var isPdf = (d.fileType || 'PDF') === 'PDF';
        var icon = isPdf
          ? '<div class="ficon" style="background:#FDECEC;color:#9E2A2B"><i class="ti ti-file-type-pdf" style="font-size:20px"></i></div>'
          : '<div class="ficon" style="background:#EAF1FB;color:#0190BF"><i class="ti ti-file-text" style="font-size:20px"></i></div>';
        var meta = [d.fileType, d.size, fmtDate(d.date)].filter(Boolean).join(' · ');
        var url = mediaUrl(d.file);
        var dl = url
          ? '<a href="' + esc(url) + '" target="_blank" rel="noopener"><i class="ti ti-download" style="color:#21428E;font-size:18px"></i></a>'
          : '<i class="ti ti-download" style="color:#21428E;font-size:18px"></i>';
        return (
          '<div class="doc-row" data-cat="' + catOf(d) + '">' + icon +
          '<div style="flex:1"><div style="font-size:13.5px;font-weight:500;color:#1B2A24">' + esc(d.title) + '</div>' +
          '<div style="font-size:11px;color:#8A968F;margin-top:2px">' + esc(meta) + '</div></div>' +
          '<span class="vb-tag" style="' + (TAG_STYLE[d.tag] || TAG_STYLE['Thông báo']) + '">' + esc(d.tag || '') + '</span>' +
          dl + '</div>'
        );
      }).join('');
    }

    var mediaBox = items(section(page, 'thu-vien-media'));
    if (mediaBox && data.mediaItems.length) {
      mediaBox.innerHTML = data.mediaItems.map(function (m) {
        var cover = (m.assets && m.assets[0]) || null;
        var overlay =
          m.mediaType === 'video'
            ? '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">' +
              '<span style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;color:#21428E">' +
              '<i class="ti ti-player-play-filled" style="font-size:16px"></i></span></span>'
            : '<span style="position:absolute;right:7px;bottom:7px;background:rgba(8,42,31,.8);color:#fff;font-size:10px;padding:1px 7px;border-radius:10px">' +
              '<i class="ti ti-photo" style="font-size:11px"></i> ' + (m.count || 0) + '</span>';
        var url = mediaUrl(cover);
        var thumb = url
          ? '<div style="height:96px;position:relative;background-image:url(\'' + esc(url) + '\');background-size:cover;background-position:center">' + overlay + '</div>'
          : '<div class="vb-ph" style="height:96px;position:relative"><i class="ti ti-photo" style="font-size:24px"></i>' + overlay + '</div>';
        return (
          '<div class="media">' + thumb +
          '<div style="padding:9px 12px;font-size:12.5px;font-weight:500;color:#1B2A24">' + esc(m.title) + '</div></div>'
        );
      }).join('');
    }
  };

  RENDER['doi-tac'] = function (page, data) {
    if (!data.partners.length) return;
    var TIERS = [
      { name: 'Đối tác chiến lược', named: true },
      { name: 'Nhà tài trợ Kim cương', height: 84, icon: 'ti-building-skyscraper', size: '26px' },
      { name: 'Nhà tài trợ Vàng', height: 66, icon: 'ti-building', size: '22px' },
      { name: 'Đối tác đồng hành', height: 54, icon: 'ti-building-store', size: '18px' },
    ];
    var boxes = page.querySelectorAll('[data-tier]');
    if (!boxes.length) return;
    boxes.forEach(function (box) {
      var tierName = box.getAttribute('data-tier');
      var tier = TIERS.filter(function (t) { return t.name === tierName; })[0];
      var list = data.partners.filter(function (p) { return p.tier === tierName; });
      if (!list.length) {
        box.innerHTML = '<div style="font-size:12.5px;color:#8A968F">Chưa có đơn vị nào ở hạng này.</div>';
        return;
      }
      box.innerHTML = list.map(function (p) {
        if (tier && tier.named) {
          var desc = String(p.description || '').replace(/<[^>]*>/g, '').trim();
          return (
            '<div style="background:#fff;border:0.5px solid #E3E8E4;border-radius:10px;padding:18px;display:flex;align-items:center;gap:14px">' +
            imageBox(p.image, 'width:64px;height:64px;border-radius:10px;flex-shrink:0', '26px').replace('ti-photo', 'ti-building') +
            '<div><div style="font-size:14px;font-weight:600;color:#1B2A24">' + esc(p.name) + '</div>' +
            '<div style="font-size:12px;color:#8A968F;margin-top:2px">' + esc(desc) + '</div></div></div>'
          );
        }
        var url = mediaUrl(p.image);
        if (url) {
          return (
            '<div class="logobox" style="height:' + tier.height + 'px;background-image:url(\'' + esc(url) +
            '\');background-size:contain;background-repeat:no-repeat;background-position:center" title="' + esc(p.name) + '"></div>'
          );
        }
        return (
          '<div class="logobox" style="height:' + tier.height + 'px" title="' + esc(p.name) + '">' +
          '<i class="ti ' + tier.icon + '" style="font-size:' + tier.size + '"></i></div>'
        );
      }).join('');
    });
  };

  RENDER['gioi-thieu'] = function (page, data) {
    var s = data.settings;
    var sec = section(page, 'thong-tin-chung');
    if (sec) {
      var about = sec.querySelector('.vb-p');
      if (about && s.about) about.textContent = s.about;
      var stats = [s.foundedYear, s.memberCount, s.clubCount, s.provinceCount];
      sec.querySelectorAll('[style*="text-align:center"]').forEach(function (cell, i) {
        var v = cell.firstElementChild;
        if (v && stats[i]) v.textContent = stats[i];
      });
    }

    // Tầm nhìn / Sứ mệnh — lấy từ "Nội dung trang website" nếu đã nhập.
    var gt = (data.pageContent && data.pageContent.data && data.pageContent.data.pageSections
      && data.pageContent.data.pageSections['gioi-thieu']) || [];
    var chung = gt.filter(function (x) { return x && x.key === 'thong-tin-chung'; })[0];
    if (chung && chung.values) {
      if (chung.values.visionText) setText(page, '[data-vision]', chung.values.visionText);
      if (chung.values.missionText) setText(page, '[data-mission]', chung.values.missionText);
      if (chung.values.paragraph && sec) {
        var p = sec.querySelector('.vb-p');
        if (p) p.textContent = chung.values.paragraph;
      }
    }

    // Ban lãnh đạo — collection riêng trong CMS.
    var box = page.querySelector('[data-leaders]');
    if (box && data.leaders.length) {
      box.innerHTML = data.leaders.map(function (l) {
        return (
          '<div style="background:#fff;border:0.5px solid #E3E8E4;border-radius:8px;padding:16px;text-align:center">' +
          avatarCircle(l.photo, '56px', '', '24px', '0 auto 10px') +
          '<div style="font-size:13px;font-weight:500;color:#1B2A24">' + esc(l.name) + '</div>' +
          '<div style="font-size:11.5px;color:var(--gold-ink);margin-top:2px">' + esc(l.role || '') + '</div></div>'
        );
      }).join('');
    }
  };

  function setText(scope, selector, value) {
    var el = scope.querySelector(selector);
    if (el && value) el.textContent = value;
  }

  RENDER['lien-he'] = function (page, data) {
    wireContactForm(page);
    var c = data.contact;
    var values = [c.address, c.email, c.phone, c.hours];
    page.querySelectorAll('.ci .ci-v').forEach(function (el, i) {
      if (values[i]) el.textContent = values[i];
    });
    // Icon mạng xã hội: chỉ hiện cái nào có link trong CMS.
    var socials = [
      { url: c.facebook, sel: 'ti-brand-facebook' },
      { url: c.youtube, sel: 'ti-brand-youtube' },
      { url: c.tiktok, sel: 'ti-brand-tiktok' },
    ];
    page.querySelectorAll('.soc').forEach(function (el) {
      var icon = el.querySelector('i');
      if (!icon) return;
      var match = socials.filter(function (s) { return icon.className.indexOf(s.sel) > -1; })[0];
      if (!match) return;
      if (match.url) {
        el.style.cursor = 'pointer';
        el.onclick = function () { window.open(match.url, '_blank', 'noopener'); };
      }
    });
  };

  /* Danh sách tỉnh/thành khớp enum `province` trong schema Strapi — gửi giá trị
     ngoài danh sách này thì API đăng ký sẽ từ chối. */
  var PROVINCES = [
    'Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Hải Phòng',
    'Cần Thơ', 'An Giang', 'Bà Rịa - Vũng Tàu', 'Bạc Liêu',
    'Bắc Giang', 'Bắc Kạn', 'Bắc Ninh', 'Bến Tre',
    'Bình Định', 'Bình Dương', 'Bình Phước', 'Bình Thuận',
    'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông',
    'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai',
    'Hà Giang', 'Hà Nam', 'Hà Tĩnh', 'Hải Dương',
    'Hậu Giang', 'Hòa Bình', 'Hưng Yên', 'Khánh Hòa',
    'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng',
    'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
    'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ',
    'Phú Yên', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi',
    'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng', 'Sơn La',
    'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa',
    'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
    'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
  ];

  /* Form Liên hệ gửi thật lên /api/contact-messages/submit (trước đây chỉ hiện
     dòng "Đã gửi!" mà không gửi đi đâu). */
  function wireContactForm(page) {
    var btn = page.querySelector('[data-contact-btn]');
    if (!btn || btn.__wired) return;
    btn.__wired = true;
    var ok = page.querySelector('[data-contact-msg]');
    var err = page.querySelector('[data-contact-err]');
    var val = function (sel) { var e = page.querySelector(sel); return e ? e.value.trim() : ''; };
    var show = function (el, text) { if (el) { el.innerHTML = text || ''; el.style.display = text ? '' : 'none'; } };

    btn.addEventListener('click', async function () {
      show(ok, ''); show(err, '');
      btn.disabled = true;
      try {
        var msg = await submitForm('contact-messages/submit', {
          name: val('[data-contact-name]'),
          email: val('[data-contact-email]'),
          phone: val('[data-contact-phone]'),
          subject: val('[data-contact-subject]'),
          message: val('[data-contact-message]'),
        });
        show(ok, '<i class="ti ti-circle-check-filled"></i> ' + esc(msg));
        ['[data-contact-name]', '[data-contact-email]', '[data-contact-phone]', '[data-contact-message]']
          .forEach(function (sel) { var e = page.querySelector(sel); if (e) e.value = ''; });
      } catch (e) {
        show(err, esc(e.message));
      } finally { btn.disabled = false; }
    });
  }

  /* Form Đăng ký thi đấu — tên giải lấy từ ô [data-fill="name"] mà router đã điền
     khi bấm "Đăng ký" ở danh sách giải. */
  RENDER['giai-dau-dang-ky'] = function (page) {
    var btn = page.querySelector('[data-reg-tourney-submit]');
    if (!btn || btn.__wired) return;
    btn.__wired = true;
    var ok = page.querySelector('[data-reg-tourney-ok]');
    var err = page.querySelector('[data-reg-tourney-err]');
    var val = function (sel) { var e = page.querySelector(sel); return e ? e.value.trim() : ''; };
    var show = function (el, text) { if (el) { el.innerHTML = text || ''; el.style.display = text ? '' : 'none'; } };

    btn.addEventListener('click', async function () {
      show(ok, ''); show(err, '');
      var nameEl = page.querySelector('[data-fill="name"]');
      btn.disabled = true;
      try {
        var msg = await submitForm('tournament-registrations/submit', {
          tournamentName: nameEl ? nameEl.textContent.trim() : '',
          playerName: val('[data-reg-player]'),
          memberCode: val('[data-reg-code]'),
          phone: val('[data-reg-phone2]'),
          club: val('[data-reg-club2]'),
          note: val('[data-reg-note]'),
        });
        show(ok, '<i class="ti ti-circle-check-filled"></i> ' + esc(msg));
        ['[data-reg-player]', '[data-reg-code]', '[data-reg-phone2]', '[data-reg-club2]', '[data-reg-note]']
          .forEach(function (sel) { var e = page.querySelector(sel); if (e) e.value = ''; });
      } catch (e) {
        show(err, esc(e.message));
      } finally { btn.disabled = false; }
    });
  };

  RENDER['hoi-vien'] = function (page, data) {
    var s = data.settings;
    // Khối VietQR: ngân hàng / số TK / chủ TK
    page.querySelectorAll('[data-bank]').forEach(function (el) {
      var k = el.getAttribute('data-bank');
      var v = k === 'name' ? s.bankName : k === 'account' ? s.bankAccount : s.bankHolder;
      if (v) el.textContent = v;
    });

    // Ô chọn tỉnh/thành trong 2 form đăng ký
    page.querySelectorAll('[data-province-select]').forEach(function (sel) {
      if (sel.options.length) return;
      sel.innerHTML = '<option value="">— Chọn tỉnh / thành —</option>' +
        PROVINCES.map(function (name) { return '<option value="' + esc(name) + '">' + esc(name) + '</option>'; }).join('');
    });
  };

  // Trang gia hạn dùng chung khối VietQR, thêm mức phí thường niên.
  RENDER['hoi-vien-gia-han'] = function (page, data) {
    RENDER['hoi-vien'](page, data);
    var fee = page.querySelector('[data-fee="renewal"]');
    if (fee && data.settings.feeRenewal) fee.textContent = data.settings.feeRenewal;
  };

  /* Danh sách hội viên phân trang THẬT: tìm kiếm + đổi trang gọi thẳng Strapi.
     API công khai đã lược bỏ CCCD/SĐT (xem src/api/member/controllers/member.js). */
  var MEMBER_PAGE_SIZE = 10;

  var MEMBER_STATUS = {
    active: ['Đang hiệu lực', 'background:#E7F4EC;color:#00814D'],
    pending: ['Chờ thanh toán', 'background:#F4F1E8;color:#9A7B2E'],
    expired: ['Hết hạn', 'background:#F1F1EE;color:#8A8A82'],
  };

  function memberRow(m) {
    var st = MEMBER_STATUS[m.status] || MEMBER_STATUS.active;
    var ds = {
      name: m.name, code: m.code || '', club: m.club || '', province: m.province || '',
      status: m.status, statuslabel: st[0], expiry: m.expiry ? fmtDate(m.expiry) : '—',
    };
    var url = mediaUrl(m.avatar);
    var av = url
      ? '<span class="av" style="background-image:url(\'' + esc(url) + '\');background-size:cover;background-position:center"></span>'
      : '<span class="av"><i class="ti ti-user" style="font-size:15px"></i></span>';
    return (
      '<tr style="cursor:pointer" data-go="hoi-vien-chi-tiet" ' + dsAttrs(ds) + '>' +
      '<td>' + av + esc(m.name) + '</td>' +
      '<td style="color:#5C6B63">' + esc(m.code || '') + '</td>' +
      '<td><span class="vb-badge" style="' + st[1] + '">' + st[0] + '</span></td></tr>'
    );
  }

  function orgRow(o) {
    var st = MEMBER_STATUS[o.status] || MEMBER_STATUS.active;
    var ds = {
      name: o.name, code: o.code || '', club: o.orgType || '', province: o.address || o.province || '',
      status: o.status, statuslabel: st[0], expiry: o.expiry ? fmtDate(o.expiry) : '—',
    };
    return (
      '<tr style="cursor:pointer" data-go="hoi-vien-chi-tiet" ' + dsAttrs(ds) + '>' +
      '<td><span class="av"><i class="ti ti-building" style="font-size:15px"></i></span>' + esc(o.name) + '</td>' +
      '<td style="color:#5C6B63">' + esc(o.joinDate ? String(o.joinDate).slice(0, 4) : '') + '</td>' +
      '<td style="color:#5C6B63">' + esc(o.address || o.province || '') + '</td>' +
      '<td><span class="vb-badge" style="' + st[1] + '">' + st[0] + '</span></td></tr>'
    );
  }

  RENDER['hoi-vien-danh-sach'] = function (page) {
    page.setAttribute('data-server-driven', '1');

    function wirePanel(opts) {
      var panel = page.querySelector('[data-tabpanel="' + opts.tab + '"]');
      if (!panel) return;
      var tbody = panel.querySelector('tbody');
      var footer = panel.querySelector('[style*="justify-content:space-between"]');
      var countEl = footer && footer.firstElementChild;
      var pagerBox = footer && footer.lastElementChild;
      var searchInput = panel.querySelector(opts.searchSelector);
      var state = { page: 1, q: '' };
      var timer = null;

      async function show() {
        tbody.innerHTML = '<tr><td colspan="4" style="color:#8A968F">Đang tải…</td></tr>';
        var res = await apiPage(opts.path, {
          'populate': opts.populate || undefined,
          'sort': 'name:asc',
          'pagination[page]': state.page,
          'pagination[pageSize]': MEMBER_PAGE_SIZE,
          'filters[name][$containsi]': state.q || undefined,
        });
        tbody.innerHTML = res.data.length
          ? res.data.map(opts.row).join('')
          : '<tr><td colspan="4" style="color:#8A968F">Không tìm thấy ' + opts.noun + ' phù hợp.</td></tr>';
        if (countEl) {
          var p = res.pagination;
          var from = (p.page - 1) * MEMBER_PAGE_SIZE + 1;
          countEl.textContent = p.total
            ? 'Tổng ' + p.total + ' ' + opts.noun + ' · hiển thị ' + from + '–' + Math.min(from + res.data.length - 1, p.total)
            : 'Chưa có ' + opts.noun + ' nào';
        }
        renderPager(pagerBox, res.pagination, function (n) { state.page = n; show(); });
      }

      if (searchInput) {
        searchInput.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () { state.q = searchInput.value.trim(); state.page = 1; show(); }, 300);
        });
      }
      show();
    }

    wirePanel({ tab: 'ca-nhan', path: 'members', row: memberRow, searchSelector: '[data-member-search]', noun: 'hội viên cá nhân', populate: 'avatar' });
    wirePanel({ tab: 'to-chuc', path: 'member-orgs', row: orgRow, searchSelector: '[data-org-search]', noun: 'hội viên tổ chức' });
  };

  /* ---------------- các trang chi tiết (điền sau khi điều hướng) ---------------- */

  /** Bài viết: đổ tiêu đề/ảnh/nội dung richtext + tin liên quan. */
  function fillArticle(page, data, docId) {
    var n = data.news.filter(function (a) { return a.documentId === docId; })[0];
    if (!n) return;

    var headWrap = page.firstElementChild;
    var crumb = headWrap.querySelector('[style*="font-size:11px"] span:last-child');
    if (crumb) crumb.textContent = n.category || 'Tin tức';
    var tag = headWrap.querySelector('.vb-tag');
    if (tag) tag.textContent = (n.category || '').toUpperCase();
    var h1 = headWrap.querySelector('h1');
    if (h1) h1.textContent = n.title;
    var metas = headWrap.querySelectorAll('[style*="color:#8A968F"]');
    if (metas[0]) metas[0].innerHTML = '<i class="ti ti-calendar"></i> ' + fmtDate(n.date);
    if (metas[1]) metas[1].innerHTML = '<i class="ti ti-user"></i> ' + esc(n.author || 'VBSF');

    var figure = page.children[1];
    if (figure) {
      var ph = figure.querySelector('.vb-ph');
      var url = mediaUrl(n.image);
      if (ph && url) {
        ph.classList.remove('vb-ph');
        ph.innerHTML = '';
        ph.style.backgroundImage = "url('" + url + "')";
        ph.style.backgroundSize = 'cover';
        ph.style.backgroundPosition = 'center';
      }
      var caption = figure.lastElementChild;
      if (caption) caption.textContent = 'Ảnh: ' + n.title;
    }

    // Thân bài: richtext của Strapi, ánh xạ về đúng class typography của site.
    var body = page.children[2];
    if (body && n.content) {
      var tmp = document.createElement('div');
      tmp.innerHTML = n.content;
      tmp.querySelectorAll('p').forEach(function (p, i) { p.className = i === 0 ? 'art-lead' : 'art-p'; });
      tmp.querySelectorAll('h1,h2,h3,h4').forEach(function (h) {
        var d = document.createElement('h3');
        d.className = 'art-h';
        d.textContent = h.textContent;
        h.replaceWith(d);
      });
      tmp.querySelectorAll('ul,ol').forEach(function (ul) {
        var frag = document.createDocumentFragment();
        ul.querySelectorAll('li').forEach(function (li) {
          var d = document.createElement('div');
          d.className = 'art-li';
          d.innerHTML = li.innerHTML;
          frag.appendChild(d);
        });
        ul.replaceWith(frag);
      });
      tmp.querySelectorAll('blockquote').forEach(function (q) {
        var d = document.createElement('div');
        d.className = 'art-quote';
        d.textContent = q.textContent;
        q.replaceWith(d);
      });
      body.innerHTML = tmp.innerHTML;
    }

    // Tin liên quan: cùng chuyên mục trước, thiếu thì lấy bài mới nhất.
    var relatedWrap = page.lastElementChild.querySelector('[style*="grid-template-columns"]');
    if (relatedWrap) {
      var pool = data.news.filter(function (a) { return a.documentId !== n.documentId; });
      var related = pool.filter(function (a) { return a.category === n.category; }).concat(
        pool.filter(function (a) { return a.category !== n.category; })
      ).slice(0, 3);
      relatedWrap.innerHTML = related.map(function (a) {
        return (
          '<div class="vb-card" data-go="tin-tuc-chi-tiet" data-doc="' + esc(a.documentId) + '" style="cursor:pointer">' +
          imageBox(a.image, 'height:96px', '22px') +
          '<div style="padding:11px 13px"><span class="vb-tag">' + esc(a.category || '') + '</span>' +
          '<div style="font-size:12.5px;font-weight:500;color:#1B2A24;line-height:1.35;margin-top:7px">' + esc(a.title) + '</div>' +
          '<div style="font-size:10.5px;color:#8A968F;margin-top:6px">' + fmtDate(a.date) + '</div></div></div>'
        );
      }).join('');
    }
  }

  /** Chi tiết giải đấu: bảng giải thưởng + thể lệ lấy từ chính giải đó. */
  function fillTournamentDetail(page, data, docId) {
    var t = data.tournaments.filter(function (x) { return x.documentId === docId; })[0];
    if (!t) return;

    var prizeBody = page.querySelector('[data-tabpanel="chung"] table.rk-tbl tbody');
    if (prizeBody && t.prizes && t.prizes.length) {
      prizeBody.innerHTML = t.prizes.map(function (p) {
        var cash = p.cash && p.cash !== '—'
          ? '<td style="font-weight:600;color:#21428E">' + esc(p.cash) + '</td>'
          : '<td style="color:#8A968F">—</td>';
        return '<tr><td><b>' + esc(p.rank || '') + '</b></td>' + cash +
          '<td style="color:#5C6B63">' + esc(p.item || '') + '</td></tr>';
      }).join('');
    }

    var rulesTarget = page.querySelector('[data-rules-target]');
    if (rulesTarget && t.rules) {
      // Dòng bắt đầu bằng "·" là một điều luật; dòng còn lại là tiêu đề nhóm.
      rulesTarget.innerHTML = t.rules.split('\n').map(function (raw) {
        var line = raw.trim();
        if (!line) return '';
        if (line.indexOf('·') === 0) {
          return '<div class="art-li">' + esc(line.replace(/^·\s*/, '')) + '</div>';
        }
        return '<div class="vb-h" style="font-size:13.5px;margin-top:14px">' + esc(line) + '</div>';
      }).join('');
    }
  }

  /** Kết quả trực tiếp: dựng lại từng vòng đấu từ bracket JSON của engine. */
  function fillLiveResults(page, data, docId) {
    var t = data.tournaments.filter(function (x) { return x.documentId === docId; })[0];
    if (!t || !t.bracket || !t.bracket.rounds) return;

    var nameOf = {};
    (t.players || []).forEach(function (p) { nameOf[p.localId] = p.name; });
    var rounds = t.bracket.rounds;
    var total = rounds.length;

    function roundName(i) {
      var fromEnd = total - 1 - i;
      if (fromEnd === 0) return 'Chung kết';
      if (fromEnd === 1) return 'Bán kết';
      if (fromEnd === 2) return 'Vòng tứ kết';
      return 'Vòng 1/' + Math.pow(2, total - i - 1);
    }

    function matchRow(m) {
      var p1 = nameOf[m.p1] || '— chờ —';
      var p2 = nameOf[m.p2] || '— chờ —';
      var done = m.status === 'done';
      var livePlaying = !done && m.s1 != null && m.s2 != null;
      var badge = done
        ? '<span class="vb-badge" style="background:#F1F1EE;color:#8A968F;min-width:50px;text-align:center">KT</span>'
        : livePlaying
        ? '<span class="vb-badge" style="background:#FDECEC;color:#9E2A2B;min-width:50px;text-align:center">LIVE</span>'
        : '<span class="vb-badge" style="background:#F4F1E8;color:#9A7B2E;min-width:50px;text-align:center">SẮP</span>';
      var score = m.s1 != null && m.s2 != null
        ? '<span style="font-size:15px;font-weight:700;color:#21428E">' + m.s1 + ' – ' + m.s2 + '</span>'
        : '<span style="font-size:15px;font-weight:700;color:#8A968F">–</span>';
      var rowStyle = livePlaying ? ' style="border-color:#21428E;background:#FDF6EC"' : (done ? '' : ' style="opacity:.6"');
      return (
        '<div class="vb-row"' + rowStyle + '>' + badge +
        '<div style="flex:1;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<span style="font-size:13.5px;font-weight:600;color:#21428E">' + esc(p1) + '</span>' + score +
        '<span style="font-size:13.5px;color:#5C6B63">' + esc(p2) + '</span></div></div>'
      );
    }

    // Chỉ hiển thị các vòng đã bắt đầu (có ít nhất 1 trận đủ 2 cơ thủ).
    var html = '';
    rounds.forEach(function (ids, i) {
      var ms = ids.map(function (id) { return t.bracket.matches[id]; }).filter(Boolean);
      var started = ms.filter(function (m) { return m.p1 != null && m.p2 != null; });
      if (!started.length) return;
      var allDone = ms.every(function (m) { return m.status === 'done'; });
      html +=
        '<div class="vb-stag" style="margin-bottom:12px">' + roundName(i) +
        (allDone ? ' · Đã hoàn thành' : '') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">' +
        ms.map(matchRow).join('') + '</div>';
    });

    var body = page.children[1];
    if (body && html) {
      body.innerHTML = html +
        '<div style="font-size:11px;color:#8A968F;margin-top:14px">Tỷ số theo thể thức đấu loại trực tiếp · Cập nhật tự động khi có kết quả mới</div>';
    }
  }

  /** Kết quả chung cuộc: bảng xếp hạng chi tiết có thể chưa có dữ liệu. */
  function fillFinalResults(page) {
    var body = page.querySelector('[data-more-target]');
    if (body && !body.children.length) {
      body.innerHTML =
        '<tr><td colspan="3" style="color:#8A968F">Bảng xếp hạng chung cuộc chi tiết chưa được công bố cho nội dung này.</td></tr>';
    }
  }

  /* ---------------- API công khai ---------------- */

  /* Footer nằm ngoài các trang (luôn hiển thị) nên điền một lần, không theo trang. */
  function hydrateFooter(data) {
    var c = data.contact || {};
    var map = { address: c.address, email: c.email, phone: c.phone };
    document.querySelectorAll('[data-footer]').forEach(function (el) {
      var value = map[el.getAttribute('data-footer')];
      if (!value) return;
      var icon = el.querySelector('i');
      el.textContent = ' ' + value;
      if (icon) el.insertBefore(icon, el.firstChild);
    });
  }

  /* Nhãn/tiêu đề do module "Trang website" trong CMS quản lý. Chỉ áp những khối
     có chỗ để áp; phần nào chưa nhập thì giữ nguyên chữ tĩnh trong HTML. */
  function applyPageContent(pageId, page, data) {
    var all = data.pageContent && data.pageContent.data && data.pageContent.data.pageSections;
    var sections = (all && all[pageId]) || [];
    sections.forEach(function (entry) {
      if (!entry || !entry.key || !entry.values) return;
      var el = section(page, entry.key);
      if (!el) return;
      var v = entry.values;

      // Tiêu đề khối (khối nào cũng có thể có [data-title])
      if (v.title) setText(el, '[data-title]', v.title);

      if (entry.key === 'hero') {
        if (v.bannerTag) setText(el, '[style*="font-size:10.5px"]', v.bannerTag);
        if (v.bannerTitle) setText(el, '[style*="font-size:18px"]', v.bannerTitle);
        if (v.bannerSubtitle) setText(el, '[style*="font-size:12px"]', v.bannerSubtitle);
        if (v.sideLabel && el.children[1]) setText(el.children[1], 'div', v.sideLabel);
      }

      if (entry.key === 'event-banner') {
        ['tag', 'title', 'subtitle', 'buttonText'].forEach(function (k) {
          if (v[k]) setText(el, '[data-fill-eb="' + k + '"]', v[k]);
        });
        if (v.enabled === false) el.setAttribute('data-eb-enabled', 'false');
      }
    });
  }

  async function hydrate(pageId, page) {
    var data = await load();
    if (!data) return;
    try { hydrateFooter(data); applyPageContent(pageId, page, data); }
    catch (err) { console.warn('[VBSF] Lỗi áp nội dung trang.', err); }
    var fn = RENDER[pageId];
    if (!fn) return;
    try {
      fn(page, data);
    } catch (err) {
      console.warn('[VBSF] Lỗi render trang "' + pageId + '" — giữ nội dung tĩnh.', err);
    }
  }

  async function afterNav(dest, page, dataset) {
    var data = await load();
    if (!data || !dataset) return;
    try {
      if (dest === 'tin-tuc-chi-tiet' && dataset.doc) fillArticle(page, data, dataset.doc);
      if (dest === 'giai-dau-chi-tiet' && dataset.doc) fillTournamentDetail(page, data, dataset.doc);
      if (dest === 'giai-dau-truc-tiep' && dataset.doc) fillLiveResults(page, data, dataset.doc);
      if (dest === 'giai-dau-ket-qua') fillFinalResults(page);
    } catch (err) {
      console.warn('[VBSF] Lỗi điền trang "' + dest + '".', err);
    }
  }

  /** Mức hội phí trong Thông tin tổ chức (đơn vị: đồng). */
  async function fees() {
    var data = await load();
    if (!data) return null;
    var s = data.settings;
    return {
      firstTime: parseVnd(s.feeFirstTime),
      annualFull: parseVnd(s.feeAnnualFull),
      annualHalf: parseVnd(s.feeAnnualHalf),
      renewal: parseVnd(s.feeRenewal),
    };
  }

  window.VBSF_CONTENT = {
    load: load,
    submitPaymentClaim: function (payload) { return submitForm('payment-claims/submit', payload); },
    hydrate: hydrate,
    afterNav: afterNav,
    fees: fees,
    fmtDate: fmtDate,
    strapiUrl: STRAPI_URL,
  };
})();
