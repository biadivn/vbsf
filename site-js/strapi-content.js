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

  // Local dev (file:// hoặc localhost): Strapi chạy riêng ở cổng 1337.
  // Trên live: nginx reverse-proxy Strapi dưới cùng domain -> path tương đối.
  var STRAPI_URL =
    location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
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

  async function api(path) {
    var res = await fetch(STRAPI_URL + '/api/' + path);
    if (!res.ok) throw new Error('Strapi ' + res.status + ' cho /' + path);
    var out = await res.json();
    return out.data;
  }

  function list(path, query) {
    return api(path + '?pagination[pageSize]=' + PAGE_SIZE + (query ? '&' + query : ''));
  }

  var bundlePromise = null;

  function load() {
    if (bundlePromise) return bundlePromise;
    bundlePromise = (async function () {
      var r = await Promise.all([
        api('setting'),
        api('contact-info'),
        list('news-articles', 'sort=date:desc&populate=image'),
        list('tournaments', 'populate=prizes&populate=players'),
        list('members', 'populate=disciplines'),
        list('member-orgs'),
        list('partners', 'populate=image'),
        list('library-docs', 'populate=file'),
        list('media-items', 'populate=assets'),
      ]);
      return {
        settings: r[0] || {},
        contact: r[1] || {},
        news: r[2] || [],
        tournaments: r[3] || [],
        members: r[4] || [],
        memberOrgs: r[5] || [],
        partners: r[6] || [],
        libraryDocs: r[7] || [],
        mediaItems: r[8] || [],
      };
    })().catch(function (err) {
      console.warn('[VBSF] Không nạp được dữ liệu từ Strapi — giữ nội dung tĩnh.', err);
      return null;
    });
    return bundlePromise;
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
      '<div style="font-size:11.5px;color:#8A968F;margin-top:3px"><i class="ti ti-trophy" style="color:#FFFFFF"></i> Vô địch: ' +
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
              '<div class="vb-ph" style="width:44px;height:44px;border-radius:50%;margin:0 auto 6px"><i class="ti ti-user"></i></div>' +
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

    // Lưới bài viết
    var grid = items(section(page, 'danh-sach-tin'));
    if (grid) {
      grid.innerHTML = data.news
        .filter(function (n) { return n.documentId !== featured.documentId; })
        .map(newsCardList)
        .join('');
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
    if (upcomingBox) {
      var upcoming = data.tournaments
        .filter(function (t) { return t.status === 'upcoming'; })
        .sort(byDateAsc);
      upcomingBox.innerHTML = upcoming.length
        ? upcoming.map(tournamentRowUpcoming).join('')
        : '<div style="font-size:12.5px;color:#8A968F">Chưa có giải đấu nào sắp diễn ra.</div>';
    }

    var doneBox = items(section(page, 'ket-qua-gan-day'));
    if (doneBox) {
      var done = data.tournaments
        .filter(function (t) { return t.status === 'completed'; })
        .sort(byDateDesc);
      doneBox.innerHTML = done.length
        ? done.map(function (t) { return tournamentRowFinished(t, finalStandings(data, t)); }).join('')
        : '<div style="font-size:12.5px;color:#8A968F">Chưa có kết quả giải đấu nào.</div>';
    }
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
              '<div class="pod" style="border-top:3px solid #FFFFFF;box-shadow:0 6px 20px rgba(12,58,42,.10);padding-top:22px;padding-bottom:22px">' +
              '<div style="font-size:11px;font-weight:700;color:#21428E"><i class="ti ti-crown"></i> HẠNG 1</div>' +
              '<div class="vb-ph" style="width:66px;height:66px;border-radius:50%;margin:10px auto;border:2px solid #21428E"><i class="ti ti-user" style="font-size:28px"></i></div>' +
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
            '<div class="vb-ph" style="width:52px;height:52px;border-radius:50%;margin:10px auto"><i class="ti ti-user" style="font-size:22px"></i></div>' +
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
      var renderTable = function (key) {
        var parts = key.split('|');
        var rows = rankingRows(data.members, parts[0], parts[1]).filter(function (r) {
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
    if (!sec) return;
    var about = sec.querySelector('.vb-p');
    if (about && s.about) about.textContent = s.about;
    var stats = [s.foundedYear, s.memberCount, s.clubCount, s.provinceCount];
    sec.querySelectorAll('[style*="text-align:center"]').forEach(function (cell, i) {
      var v = cell.firstElementChild;
      if (v && stats[i]) v.textContent = stats[i];
    });
  };

  RENDER['lien-he'] = function (page, data) {
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

  RENDER['hoi-vien'] = function (page, data) {
    var s = data.settings;
    // Khối VietQR: ngân hàng / số TK / chủ TK
    page.querySelectorAll('[data-bank]').forEach(function (el) {
      var k = el.getAttribute('data-bank');
      var v = k === 'name' ? s.bankName : k === 'account' ? s.bankAccount : s.bankHolder;
      if (v) el.textContent = v;
    });
  };

  // Trang gia hạn dùng chung khối VietQR, thêm mức phí thường niên.
  RENDER['hoi-vien-gia-han'] = function (page, data) {
    RENDER['hoi-vien'](page, data);
    var fee = page.querySelector('[data-fee="renewal"]');
    if (fee && data.settings.feeRenewal) fee.textContent = data.settings.feeRenewal;
  };

  RENDER['hoi-vien-danh-sach'] = function (page, data) {
    var STATUS = {
      active: ['Đang hiệu lực', 'background:#E7F4EC;color:#00814D'],
      pending: ['Chờ thanh toán', 'background:#F4F1E8;color:#9A7B2E'],
      expired: ['Hết hạn', 'background:#F1F1EE;color:#8A8A82'],
    };
    var tbodies = page.querySelectorAll('table.mtbl tbody');

    if (tbodies[0] && data.members.length) {
      tbodies[0].innerHTML = data.members.map(function (m) {
        var st = STATUS[m.status] || STATUS.active;
        var ds = {
          name: m.name, code: m.code || '', club: m.club || '', province: m.province || '',
          status: m.status, statuslabel: st[0], expiry: m.expiry ? fmtDate(m.expiry) : '—',
        };
        return (
          '<tr style="cursor:pointer" data-go="hoi-vien-chi-tiet" ' + dsAttrs(ds) + '>' +
          '<td><span class="av"><i class="ti ti-user" style="font-size:15px"></i></span>' + esc(m.name) + '</td>' +
          '<td style="color:#5C6B63">' + esc(m.code || '') + '</td>' +
          '<td><span class="vb-badge" style="' + st[1] + '">' + st[0] + '</span></td></tr>'
        );
      }).join('');
      var cnt = page.querySelector('[data-tabpanel="ca-nhan"] [style*="font-size:11px"]');
      if (cnt) cnt.textContent = 'Tổng ' + data.members.length + ' hội viên cá nhân · hiển thị 1–' + data.members.length;
    }

    if (tbodies[1] && data.memberOrgs.length) {
      tbodies[1].innerHTML = data.memberOrgs.map(function (o) {
        var st = STATUS[o.status] || STATUS.active;
        var ds = {
          name: o.name, code: o.code || '', club: o.orgType || '', province: o.address || o.province || '',
          status: o.status, statuslabel: st[0], expiry: o.expiry ? fmtDate(o.expiry) : '—',
        };
        var joinYear = o.joinDate ? String(o.joinDate).slice(0, 4) : '';
        return (
          '<tr style="cursor:pointer" data-go="hoi-vien-chi-tiet" ' + dsAttrs(ds) + '>' +
          '<td><span class="av"><i class="ti ti-building" style="font-size:15px"></i></span>' + esc(o.name) + '</td>' +
          '<td style="color:#5C6B63">' + esc(joinYear) + '</td>' +
          '<td style="color:#5C6B63">' + esc(o.address || o.province || '') + '</td>' +
          '<td><span class="vb-badge" style="' + st[1] + '">' + st[0] + '</span></td></tr>'
        );
      }).join('');
      var cntOrg = page.querySelector('[data-tabpanel="to-chuc"] [style*="font-size:11px"]');
      if (cntOrg) cntOrg.textContent = 'Tổng ' + data.memberOrgs.length + ' hội viên tổ chức · hiển thị 1–' + data.memberOrgs.length;
    }
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
      var rowStyle = livePlaying ? ' style="border-color:#21428E;background:#FFFFFF"' : (done ? '' : ' style="opacity:.6"');
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

  async function hydrate(pageId, page) {
    var data = await load();
    if (!data) return;
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

  /** Hồ sơ hội viên / tổ chức cho luồng đăng nhập demo trong index.html. */
  async function loginTables() {
    var data = await load();
    if (!data) return null;
    return {
      members: data.members.map(function (m) {
        var d = (m.disciplines || []).slice().sort(function (a, b) { return (b.points || 0) - (a.points || 0); })[0] || {};
        return {
          code: m.code, name: m.name, phone: m.phone, cccd: m.cccd,
          club: m.club || '', province: m.province || '', category: m.category || d.category || '',
          status: m.status, expiry: m.expiry ? fmtDate(m.expiry) : '',
          rank: d.rank, points: d.points, matches: d.matches, trend: d.trend, trendValue: d.trendValue,
        };
      }),
      orgs: data.memberOrgs.map(function (o) {
        return {
          code: o.code, name: o.name, orgType: o.orgType, province: o.province || '', address: o.address || '',
          repName: o.repName || '', repTitle: o.repTitle || '', repPhone: o.repPhone || '', repEmail: o.repEmail || '',
          phone: o.phone, package: o.package || '',
          joinYear: o.joinDate ? String(o.joinDate).slice(0, 4) : '',
          status: o.status, expiry: o.expiry ? fmtDate(o.expiry) : '',
        };
      }),
    };
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
    hydrate: hydrate,
    afterNav: afterNav,
    loginTables: loginTables,
    fees: fees,
    fmtDate: fmtDate,
    strapiUrl: STRAPI_URL,
  };
})();
