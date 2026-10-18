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

  /* ---------------- ngôn ngữ đang xem ----------------

     Logic thuần nằm ở site-js/i18n.js (có unit test); ở đây chỉ là phần dính
     vào trình duyệt: nhớ lựa chọn, dịch chữ tĩnh trong DOM, và nút đổi ngôn ngữ.

     Đổi ngôn ngữ thì TẢI LẠI TRANG. Render lại tại chỗ nghe gọn hơn nhưng phải
     dựng lại mọi khối đang mở (tab, phân trang, form dở, trạng thái đăng nhập)
     — nhiều đường để sót. Tải lại luôn ra đúng trạng thái, và ngôn ngữ thì
     người xem đổi vài lần một phiên chứ không liên tục. */
  var LANG_KEY = 'vbsf_lang';

  function normLang(v) {
    return typeof normalizeLang === 'function' ? normalizeLang(v) : 'vi';
  }

  var langCache = null;
  function currentLang() {
    if (langCache) return langCache;
    var fromUrl = '';
    try {
      fromUrl = new URLSearchParams(location.search).get('lang') || '';
    } catch (err) { fromUrl = ''; }
    var stored = '';
    try { stored = localStorage.getItem(LANG_KEY) || ''; } catch (err) { stored = ''; }
    /* ?lang= thắng để link dán ra ngoài luôn mở đúng thứ tiếng người gửi thấy,
       và ghi lại luôn cho những lần sau. */
    langCache = normLang(fromUrl || stored);
    if (fromUrl) { try { localStorage.setItem(LANG_KEY, langCache); } catch (err) { /* chặn cookie */ } }
    return langCache;
  }

  function setLang(value) {
    var next = normLang(value);
    if (next === currentLang()) return;
    try { localStorage.setItem(LANG_KEY, next); } catch (err) { /* chặn cookie: vẫn đổi được trong lần này */ }
    /* Giữ nguyên trang đang xem. Có ?lang= trên URL thì phải điều hướng để bỏ
       nó đi (nếu không, lần tải lại sau vẫn đọc ?lang= cũ và nút bấm như không
       ăn); không có thì reload() là đủ và chắc chắn tải lại. */
    if (location.search) location.replace(location.pathname + location.hash);
    else location.reload();
  }

  /** Chuỗi ghép từ biến (số lượng, tên bảng...) — không tra từ điển cả câu được. */
  function L(vi, en) {
    return currentLang() === 'en' ? en : vi;
  }

  /* Dịch chữ tĩnh trong một nhánh DOM. Tra theo đúng chuỗi tiếng Việt: không có
     trong từ điển thì giữ nguyên, nên tên người / mã số / nội dung CMS đi thẳng
     qua (xem site-js/i18n.js). */
  var TRANSLATABLE_ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];

  function translateTree(root) {
    if (currentLang() === 'vi' || !root || typeof translateUi !== 'function') return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        /* Chữ trong <script>/<style> không phải nội dung hiển thị. */
        var tag = node.parentNode && node.parentNode.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    var nodes = [];
    for (var n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    nodes.forEach(function (node) {
      var out = translateUi(node.nodeValue, 'en');
      if (out !== node.nodeValue) node.nodeValue = out;
    });

    TRANSLATABLE_ATTRS.forEach(function (attr) {
      var targets = root.querySelectorAll ? Array.prototype.slice.call(root.querySelectorAll('[' + attr + ']')) : [];
      // querySelectorAll chỉ soi con cháu — nhánh mới có thể CHÍNH NÓ là <input
      // placeholder="..."> nên phải xét thêm chính nó.
      if (root.hasAttribute && root.hasAttribute(attr)) targets.push(root);
      targets.forEach(function (el) {
        var cur = el.getAttribute(attr);
        var out = translateUi(cur, 'en');
        if (out !== cur) el.setAttribute(attr, out);
      });
    });
    /* <option> dựng sẵn trong HTML có cả value lẫn nhãn; nhãn đã dịch ở trên,
       value giữ nguyên để form gửi lên vẫn là giá trị tiếng Việt backend hiểu. */
  }

  /* Trang dựng lại nhiều khối bằng innerHTML SAU khi render lần đầu (phân trang
     tin, đổi tab bảng xếp hạng, mở modal...). Bám theo từng chỗ gọi là chắc
     chắn sót, nên theo dõi chung: hễ có nhánh DOM mới thì dịch nhánh đó.
     Chỉ nghe childList — việc dịch chỉ ghi nodeValue nên không tự kích lại. */
  function watchForNewNodes() {
    if (currentLang() === 'vi' || typeof MutationObserver === 'undefined') return;
    var pending = [];
    var timer = null;
    var observer = new MutationObserver(function (records) {
      records.forEach(function (rec) {
        Array.prototype.forEach.call(rec.addedNodes, function (node) {
          if (node.nodeType === 1 || node.nodeType === 3) pending.push(node);
        });
      });
      if (!pending.length || timer) return;
      timer = setTimeout(function () {
        timer = null;
        var batch = pending;
        pending = [];
        batch.forEach(function (node) {
          if (!node.parentNode) return;              // đã bị gỡ khỏi trang
          if (node.nodeType === 3) {
            var out = translateUi(node.nodeValue, 'en');
            if (out !== node.nodeValue) node.nodeValue = out;
          } else {
            translateTree(node);
          }
        });
      }, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /** Dịch phần nằm ngoài <body>: thẻ <title> và các meta dùng khi chia sẻ link. */
  function translateHead() {
    document.documentElement.setAttribute('lang', currentLang());
    if (currentLang() === 'vi') return;
    document.title = translateUi(document.title, 'en');
    document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"],meta[property="og:site_name"]')
      .forEach(function (m) {
        m.setAttribute('content', translateUi(m.getAttribute('content'), 'en'));
      });
    var locale = document.querySelector('meta[property="og:locale"]');
    if (locale) locale.setAttribute('content', 'en_US');
  }

  /** Gọi một lần lúc trang nạp xong, trước khi điều hướng tới trang đầu tiên. */
  function initLang() {
    translateHead();
    translateTree(document.body);
    watchForNewNodes();
  }

  /* ---------------- tiện ích ---------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /** '2026-06-12' -> '12/06/2026' */
  /* Strapi trả dung lượng media theo KB. Chỉ dùng khi admin bỏ trống ô "Dung lượng". */
  function docSize(kb) {
    if (kb == null) return '';
    return kb < 1024 ? Math.round(kb) + ' KB' : (kb / 1024).toFixed(1).replace('.', ',') + ' MB';
  }

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
    if (!m) return '';
    /* Ảnh bản dịch tiếng Anh lưu thẳng URL (chuỗi) trong cột i18n, không phải
       quan hệ media của Strapi — xem site-js/i18n.js. */
    var url = typeof m === 'string' ? m : m.url;
    if (!url) return '';
    return url.indexOf('http') === 0 || url.indexOf('data:') === 0 ? url : STRAPI_URL + url;
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
      // events/docs phục vụ trang Đăng ký thi đấu; media nằm trong component nên
      // phải populate lồng, populate=docs một tầng sẽ trả file rỗng.
      { key: 'tournaments', fallback: [], load: function () { return list('tournaments', 'populate[prizes]=*&populate[players]=*&populate[events]=*&populate[docs][populate]=file'); } },
      { key: 'members', fallback: [], load: function () { return list('members', 'populate=disciplines&populate=avatar'); } },
      { key: 'memberOrgs', fallback: [], load: function () { return list('member-orgs'); } },
      { key: 'partners', fallback: [], load: function () { return list('partners', 'populate=image'); } },
      // Không cần populate=file: controller tự nạp quan hệ và chỉ trả downloadUrl.
      { key: 'libraryDocs', fallback: [], load: function () { return list('library-docs'); } },
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
      /* Đang xem tiếng Anh thì phủ cột i18n lên đây, MỘT lần. Làm ở chỗ khác —
         rải ra từng hàm render — là chắc chắn sót chỗ nào đó và trang nửa Việt
         nửa Anh. */
      return typeof overlayData === 'function' ? overlayData(bundle, currentLang()) : bundle;
    });

    return bundlePromise;
  }

  /** POST tới endpoint form công khai; ném Error kèm thông báo của backend. */
  async function submitForm(path, payload, token) {
    var res;
    try {
      var headers = { 'Content-Type': 'application/json' };
      /* Endpoint đăng ký thi đấu cần biết người gửi là ĐỘI nào / HỘI VIÊN nào —
         token của site public, không phải JWT của CMS. */
      if (token) headers.Authorization = 'Bearer ' + token;
      res = await fetch(STRAPI_URL + '/api/' + path, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
    }
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((out.error && out.error.message) || 'Không gửi được. Vui lòng thử lại.');
    return out.message || 'Đã gửi.';
  }

  /** Gọi endpoint của site và trả nguyên JSON (submitForm chỉ trả message). */
  async function postJson(path, payload, token) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    var res = await fetch(STRAPI_URL + '/api/' + path, {
      method: 'POST', headers: headers, body: JSON.stringify(payload || {}),
    });
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((out.error && out.error.message) || 'Không tải được dữ liệu.');
    return out;
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
    var meta = esc(t.location || '') + (t.participants ? ' · ' + t.participants + L(' cơ thủ', ' players') : '');
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
      '<div style="font-size:11.5px;color:#8A968F;margin-top:3px"><i class="ti ti-trophy" style="color:var(--gold-ink)"></i> ' +
      L('Vô địch: ', 'Champion: ') +
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
    var cfg = function (key) { return sectionEntry(data.pageContent, 'trang-chu', key); };

    /* Banner lớn: MỘT bài viết nổi bật do CMS chọn; chưa chọn thì lấy bài mới
       nhất — banner trống trên trang chủ là tệ nhất. Ảnh banner của bài đè lên
       "Ảnh nền" của khối, vì ảnh đi kèm bài mới là thứ người đọc đang xem. */
    var banner = section(page, 'hero-banner');
    if (banner && !data.news.length) {
      /* Chưa có bài nào: xoá chữ mẫu và gỡ link, để banner không mời người ta
         bấm vào một bài không tồn tại. */
      setText(banner, '[data-hero-name]', 'Chưa có bài viết');
      clearText(banner, '[data-hero-meta]');
      banner.removeAttribute('data-go');
      banner.removeAttribute('data-doc');
    }
    if (banner && data.news.length) {
      var feat = pickOne(cfg('hero-banner'), data.news, 'newsIds') || data.news[0];
      if (feat) {
        setText(banner, '[data-hero-name]', feat.title);
        setText(banner, '[data-hero-meta]',
          [translateUi(feat.category, currentLang()), fmtDate(feat.date)].filter(Boolean).join(' · '));
        if (feat.image) setBackground(banner.querySelector('[data-hero-image]'), feat.image);
        // Bấm banner mở đúng bài đó thay vì danh sách tin chung.
        banner.setAttribute('data-go', 'tin-tuc-chi-tiet');
        if (feat.documentId) banner.setAttribute('data-doc', feat.documentId);
      }
    }

    /* Banner sự kiện: đích đến do CMS đặt ở ô "Liên kết khi bấm". Link ngoài
       (http…) mở tab mới; còn lại coi như trang trong site. Bỏ trống thì giữ
       nguyên data-go có sẵn trong HTML (trang Trực tiếp). */
    var eventBanner = section(page, 'event-banner');
    var ebCfg = eventBanner ? cfg('event-banner') : null;
    /* Chưa cấu hình trong CMS thì ẩn hẳn: chữ mẫu trong HTML là một sự kiện cụ
       thể ("Vòng chung kết ... tại Nhà thi đấu Phú Thọ"), để nguyên là quảng
       cáo một sự kiện không có thật. */
    if (eventBanner) eventBanner.style.display = ebCfg ? '' : 'none';
    if (eventBanner && ebCfg) {
      /* Chữ của khối này màu trắng. Tải ảnh banner lên mà để nguyên thì gặp ảnh
         sáng là không đọc được, nên phủ thêm một lớp tối lên trên ảnh. */
      if (ebCfg && ebCfg.backgroundImage) {
        eventBanner.style.backgroundImage =
          "linear-gradient(rgba(20,38,84,0.72),rgba(20,38,84,0.72)), url('" + ebCfg.backgroundImage + "')";
        eventBanner.style.backgroundSize = 'cover';
        eventBanner.style.backgroundPosition = 'center';
      }
      var ebLink = contentValue(ebCfg, 'link').trim();
      if (ebLink && /^https?:\/\//i.test(ebLink)) {
        eventBanner.removeAttribute('data-go');
        if (!eventBanner.__ebWired) {
          eventBanner.__ebWired = true;
          eventBanner.addEventListener('click', function () {
            window.open(ebLink, '_blank', 'noopener');
          });
        }
      } else if (ebLink) {
        eventBanner.setAttribute('data-go', ebLink.replace(/^#/, ''));
      }
    }

    // Tin nổi bật (cột phải banner) — bài do CMS chọn, mặc định 3 bài mới nhất.
    var sideBox = items(section(page, 'hero-tin-noi-bat'));
    fillList(sideBox, pickItems(cfg('hero-tin-noi-bat'), data.news, 'newsIds', 3)
      .map(function (n) { return newsRowSmall(n, 'width:64px;height:48px;border-radius:6px;flex-shrink:0'); })
      .join(''), 'Chưa có bài viết nổi bật.');

    // Tin tức mới nhất
    var newsBox = items(section(page, 'tin-tuc-home'));
    fillList(newsBox, pickItems(cfg('tin-tuc-home'), data.news, 'newsIds', 3).map(newsCardHome).join(''),
      'Chưa có bài viết nào.');

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
        ;
      var picked = pickItems(cfg('lich-giai-dau'), upcoming, 'tournamentIds', 3);
      fillList(schedule, picked.map(tournamentRowHome).join(''), 'Chưa có giải đấu nào sắp diễn ra.');
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
              '<div style="font-size:12.5px;font-weight:600;color:#21428E;margin-top:2px">' + fmtPoints(r.points) + L(' đ', ' pts') + '</div></div>'
            );
          }).join('') +
          '</div></div>'
        );
      }
      fillList(grids[0], male.map(boxHtml).join(''), 'Chưa có dữ liệu xếp hạng.');
      fillList(grids[1], rest.map(boxHtml).join(''), 'Chưa có dữ liệu xếp hạng.');
    } else if (top) {
      top.querySelectorAll('.tp-grid').forEach(function (g) {
        fillList(g, '', 'Chưa có dữ liệu xếp hạng.');
      });
    }

    // Dải logo đối tác
    var partnerBox = items(section(page, 'doi-tac-home'));
    fillList(partnerBox, pickItems(cfg('doi-tac-home'), data.partners, 'partnerIds', 5).map(function (p) {
      return imageBox(p.image, 'width:96px;height:40px;border-radius:6px').replace('ti-photo', 'ti-building');
    }).join(''), 'Chưa có đối tác nào.');
  };

  /* ---------- Khối dựng từ dữ liệu: rỗng thì phải NÓI là rỗng ----------

     pages/*.html chứa sẵn nội dung mẫu của giai đoạn dựng prototype (bài viết,
     giải đấu, đối tác... có tiêu đề và ngày tháng trông y như thật). Trước đây
     mỗi khối chỉ ghi đè khi CÓ dữ liệu, nên khi Strapi chưa có gì — hoặc khi
     vận hành vừa xoá sạch trong CMS — trang vẫn hiện nguyên nội dung mẫu.

     Hai cái hại: người xem tưởng Liên đoàn đang có bài/giải đó, và người vận
     hành tưởng thao tác xoá trong CMS không ăn. Nên từ đây: không có dữ liệu
     thì thay bằng một dòng "chưa có", không bao giờ để lại markup mẫu. */
  function emptyNote(text) {
    return '<div style="font-size:12.5px;color:#8A968F;padding:10px 0">' + esc(text) + '</div>';
  }

  /** Ghi `html` vào khối; `html` rỗng thì ghi dòng "chưa có" thay vì để nguyên. */
  function fillList(box, html, emptyText) {
    if (!box) return;
    box.innerHTML = html || emptyNote(emptyText || 'Chưa có nội dung.');
  }

  /** Xoá trắng một ô chữ. setText() cố tình bỏ qua chuỗi rỗng (để không ghi đè
      nhầm khi dữ liệu thiếu field), nên muốn XOÁ phải đi đường này. */
  function clearText(scope, selector) {
    var el = scope && scope.querySelector(selector);
    if (el) el.textContent = '';
  }

  /* Trang chi tiết mở mà không có bản ghi — vào thẳng bằng link, bản ghi đã bị
     xoá, hoặc API lỗi. Phải nói "không tìm thấy" chứ không được để nguyên nội
     dung mẫu: ở trang Trực tiếp, nội dung mẫu là cả một bảng tỷ số với tên vận
     động viên cụ thể, người xem không có cách nào biết đó là dữ liệu giả. */
  function showMissing(page, text) {
    /* Không ghi đè page.innerHTML: trang chi tiết nằm sẵn trong DOM sau lần nạp
       đầu, và initTourneyDetail() đã gắn sự kiện vào các tab bên trong — ghi đè
       là mất hết, lần sau mở một giải CÓ thật thì tab không bấm được nữa. Chỉ
       ẩn phần thân rồi chèn một khối thông báo, và gỡ được. */
    var note = page.querySelector('[data-missing-note]');
    if (!note) {
      note = document.createElement('div');
      note.setAttribute('data-missing-note', '');
      note.style.padding = '26px';
      page.appendChild(note);
    }
    note.innerHTML = emptyNote(text) +
      '<div style="margin-top:12px"><span class="vb-link" data-go="trang-chu" style="cursor:pointer">← Về trang chủ</span></div>';
    note.style.display = '';
    Array.prototype.forEach.call(page.children, function (el) {
      if (el === note) return;
      if (el.getAttribute('data-hidden-by-missing') == null) {
        el.setAttribute('data-hidden-by-missing', el.style.display);
      }
      el.style.display = 'none';
    });
  }

  /** Ngược của showMissing(): lần này có bản ghi thì mở lại thân trang. */
  function hideMissing(page) {
    var note = page.querySelector('[data-missing-note]');
    if (note) note.style.display = 'none';
    Array.prototype.forEach.call(page.children, function (el) {
      var prev = el.getAttribute('data-hidden-by-missing');
      if (prev == null) return;
      el.style.display = prev;
      el.removeAttribute('data-hidden-by-missing');
    });
  }

  /* Trang Tin tức phân trang THẬT: lọc chuyên mục + tìm kiếm + đổi trang đều
     gửi query lên Strapi, chỉ tải đúng số bài của trang đang xem. */
  var NEWS_PAGE_SIZE = 6;

  RENDER['tin-tuc'] = function (page, data) {
    var featured = pickItems(sectionEntry(data.pageContent, 'tin-tuc', 'tin-noi-bat'), data.news, 'newsIds', 1)[0]
      || data.news.filter(function (n) { return n.featured; })[0] || data.news[0];

    // Bài nổi bật
    var feat = section(page, 'tin-noi-bat');
    /* Không có bài nào: ẩn hẳn khối nổi bật thay vì để lại bài mẫu trong HTML. */
    if (feat && !featured) feat.style.display = 'none';
    if (feat && featured) {
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
    if (side && !data.news.length) {
      var head = side.firstElementChild;
      side.innerHTML = (head ? head.outerHTML : '') + emptyNote('Chưa có bài viết nào.');
    } else if (side) {
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
        'filters[documentId][$ne]': featured ? featured.documentId : undefined,
        'filters[category][$eq]': state.category || undefined,
        'filters[title][$containsi]': state.q || undefined,
      });
      grid.innerHTML = res.data.length
        ? res.data.map(newsCardList).join('')
        : emptyNote(state.q || state.category ? 'Không tìm thấy bài viết phù hợp.' : 'Chưa có bài viết nào.');
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
      var loc = (catSel && catSel.value) || (yearSel && yearSel.value);
      fillList(upcomingBox, list.map(tournamentRowUpcoming).join(''),
        loc ? 'Không có giải đấu nào phù hợp bộ lọc.' : 'Chưa có giải đấu nào sắp diễn ra.');
    }
    function renderDone() {
      if (!doneBox) return;
      var list = data.tournaments.filter(function (t) { return t.status === 'completed' && matches(t); }).sort(byDateDesc);
      var locD = (catSel && catSel.value) || (yearSel && yearSel.value);
      fillList(doneBox, list.map(function (t) { return tournamentRowFinished(t, finalStandings(data, t)); }).join(''),
        locD ? 'Không có kết quả nào phù hợp bộ lọc.' : 'Chưa có giải đấu nào đã kết thúc.');
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
    var keys = rankingKeys(data.members);
    /* Chưa có hội viên/điểm số: dọn sạch bục vinh danh và bảng xếp hạng mẫu,
       nói rõ là chưa có dữ liệu. */
    if (!keys.length) {
      var emptyCar = section(page, 'rk-carousel');
      if (emptyCar) {
        emptyCar.querySelectorAll('.rk-car-slide').forEach(function (x) { x.remove(); });
        fillList(emptyCar, '', 'Chưa có dữ liệu xếp hạng.');
      }
      fillList(items(section(page, 'bang-xep-hang')), '', 'Chưa có hội viên nào trong bảng xếp hạng.');
      return;
    }

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
    if (docsBox && !data.libraryDocs.length) fillList(docsBox, '', 'Chưa có văn bản nào.');
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
        var size = d.size || (d.fileSizeKb != null ? docSize(d.fileSizeKb) : '');
        var meta = [d.fileType, size, fmtDate(d.date)].filter(Boolean).join(' · ');
        /* downloadUrl do API trả về, trỏ vào endpoint tải của Strapi — đường dẫn
           /uploads thật không xuất hiện ở đâu trên trang để bot lần theo. */
        var dl = d.downloadUrl
          ? '<a href="' + esc(STRAPI_URL + d.downloadUrl) + '" rel="nofollow noopener" ' +
            'title="Tải ' + esc(d.title) + '"><i class="ti ti-download" style="color:#21428E;font-size:18px"></i></a>'
          : '<i class="ti ti-download" style="color:#C9CFC9;font-size:18px" title="Chưa có tệp đính kèm"></i>';
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
    if (mediaBox && !data.mediaItems.length) fillList(mediaBox, '', 'Chưa có album ảnh/video nào.');
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
      var sec = box.closest('[data-section]');
      var entry = sec ? sectionEntry(data.pageContent, 'doi-tac', sec.getAttribute('data-section')) : null;
      // Chọn tay trong CMS thì theo đúng danh sách đó; không thì lọc theo hạng.
      var list = (entry && entry.pickerMode === 'manual' && (entry.partnerIds || []).length)
        ? pickItems(entry, data.partners, 'partnerIds', 0)
        : data.partners.filter(function (p) { return p.tier === tierName; });
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

  /* Một thẻ bộ môn. Ảnh của mục section lưu thẳng là data URI trong
     page-content (xem section-detail-panel.js), không phải media của Strapi,
     nên không đi qua mediaUrl()/imageBox(). */
  function boMonCard(it) {
    var img = it.image
      ? '<div style="height:84px;background-image:url(\'' + esc(it.image) +
        '\');background-size:cover;background-position:center"></div>'
      : '<div class="vb-ph" style="height:84px"><i class="ti ti-photo" style="font-size:26px"></i></div>';
    var tags = String(it.tags || '').split(',').map(function (t) { return t.trim(); })
      .filter(Boolean)
      .map(function (t) { return '<span class="vb-tag">' + esc(t) + '</span>'; })
      .join(' ');
    return (
      '<div style="border:0.5px solid #E3E8E4;border-radius:8px;overflow:hidden">' + img +
      '<div style="padding:12px 14px">' +
      '<div style="font-size:14px;font-weight:600;color:#21428E">' + esc(it.name || '') + '</div>' +
      (it.desc ? '<div class="vb-p" style="font-size:12.5px;margin:4px 0 8px">' + esc(it.desc) + '</div>' : '') +
      tags + '</div></div>'
    );
  }

  RENDER['gioi-thieu'] = function (page, data) {
    /* Đoạn giới thiệu, tầm nhìn, sứ mệnh và dải 4 ô số liệu đều là cấu hình của
       khối "Thông tin chung", và applyPageContent() đã điền qua data-fill /
       data-fill-html. Ở đây chỉ còn phần dữ liệu thật: ban lãnh đạo.

       Bản cũ đọc lại chúng từ Thông tin tổ chức rồi GHI ĐÈ lên những gì
       applyPageContent vừa điền — nên sửa ô "Đoạn giới thiệu" trong CMS không có
       tác dụng. Nó còn dò dải số liệu bằng
       sec.querySelectorAll('[style*="text-align:center"]'): đổi chút CSS trong
       HTML là hỏng mà không ai biết. Khối đọc chung.values thì đã chết sẵn, vì
       CMS ghi vào entry.content chứ không phải entry.values. */

    /* Dải 4 ô số liệu là nội bộ khối "Thông tin chung". HTML mẫu ghi sẵn
       "200x / 1.500+ hội viên / 120+ CLB / 30+ tỉnh thành" — CMS chưa nhập thì
       ẩn hẳn dải, vì để lại là Liên đoàn công bố những con số không có thật. */
    var stats = page.querySelector('[data-stats]');
    if (stats) {
      var sc = (sectionEntry(data.pageContent, 'gioi-thieu', 'thong-tin-chung') || {}).content || {};
      var hasStat = ['stat1Value', 'stat2Value', 'stat3Value', 'stat4Value'].some(function (k) {
        return sc[k] != null && String(sc[k]).trim() !== '';
      });
      stats.style.display = hasStat ? '' : 'none';
    }

    /* Bộ môn thi đấu: mỗi bộ môn là một block do CMS nhập (hình minh hoạ, tên,
       mô tả, các nội dung thi đấu). Trước đây trang dựng cứng 3 thẻ Pool /
       Carom / Snooker trong pages/gioi-thieu.html, nên admin sửa trong CMS
       không có tác dụng gì mà cũng không báo lỗi — và khi chưa nhập thì đó lại
       là nội dung mẫu nằm trên trang thật. */
    var boMon = section(page, 'bo-mon');
    var boMonBox = items(boMon);
    if (boMonBox) {
      var boMonEntry = sectionEntry(data.pageContent, 'gioi-thieu', 'bo-mon') || {};
      var boMonItems = (boMonEntry.items || []).filter(function (it) {
        return it && (it.name || it.desc || it.image);
      });
      var boMonLimit = parseInt(boMonEntry.itemCount, 10);
      if (boMonLimit > 0) boMonItems = boMonItems.slice(0, boMonLimit);
      fillList(boMonBox, boMonItems.map(boMonCard).join(''), 'Chưa cập nhật bộ môn thi đấu.');
    }

    // Ban lãnh đạo — collection riêng trong CMS.
    var box = page.querySelector('[data-leaders]');
    if (box && !data.leaders.length) fillList(box, '', 'Chưa cập nhật ban lãnh đạo.');
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
  /* Hội viên đã đăng nhập thì không bắt nhập lại tên/mã/điện thoại/CLB — hồ sơ
     đã có sẵn những thứ đó. Vẫn để lối "nhập thủ công" cho trường hợp đăng ký hộ
     người khác. Trạng thái này áp lại MỖI lần vào trang, vì người dùng có thể
     đăng nhập rồi quay lại mà trang không tải lại. */
  async function applyMemberIdentity(page) {
    var card = page.querySelector('[data-reg-asmember]');
    var manualBox = page.querySelector('[data-reg-identity]');
    if (!card || !manualBox) return null;

    var auth = window.VBSF_AUTH;
    var me = auth ? auth.currentMember() : null;
    /* RENDER có thể chạy trước khi index.html khôi phục xong phiên; hỏi lại một
       lần thay vì kết luận là khách. */
    if (!me && auth && typeof auth.restoreMember === 'function') {
      try { me = await auth.restoreMember(); } catch (e) { me = null; }
    }
    /* Chú thích "* Bắt buộc" chỉ đúng khi còn ô bắt buộc trên màn hình. */
    var reqNote = page.querySelector('[data-reg-required-note]');
    var setManual = function (on) {
      card.style.display = on ? 'none' : '';
      manualBox.style.display = on ? '' : 'none';
      if (reqNote) reqNote.style.display = on ? '' : 'none';
    };

    if (!me || page.__regManual) { setManual(true); return null; }

    setText(card, '[data-reg-me-name]', me.name || '—');
    setText(card, '[data-reg-me-code]', me.code || 'Chưa có mã');
    setText(card, '[data-reg-me-phone]', me.phone || '—');
    var clubEl = card.querySelector('[data-reg-me-club]');
    if (clubEl) clubEl.textContent = me.club ? ' (' + me.club + ')' : '';

    var avatar = card.querySelector('[data-reg-me-avatar]');
    if (avatar && me.avatar) {
      avatar.classList.remove('vb-ph');
      avatar.innerHTML = '';
      avatar.style.backgroundImage = "url('" + me.avatar + "')";
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
    }

    /* Trạng thái hội phí hiện ra để người đăng ký biết trước — ban tổ chức vẫn là
       bên xác nhận, nên không chặn nút gửi ở đây. */
    var STATUS = {
      active: ['Đang hiệu lực', 'background:#E7F4EC;color:#00814D'],
      pending: ['Chờ thanh toán hội phí', 'background:#F4F1E8;color:#9A7B2E'],
      expired: ['Hội phí đã hết hạn', 'background:#F1F1EE;color:#8A8A82'],
    };
    var st = card.querySelector('[data-reg-me-status]');
    if (st) {
      var info = STATUS[me.status];
      if (info) { st.textContent = info[0]; st.setAttribute('style', info[1]); }
      else { st.style.display = 'none'; }
    }

    setManual(false);
    return me;
  }

  /* ---------------- Đăng ký thi đấu ----------------
     Hai luồng, quyết định bởi `nature` của giải (đặt trong CMS):
     - national  : chỉ tài khoản ĐỘI tỉnh/thành gửi được, kèm danh sách VĐV.
                   VĐV không tự đăng ký (quy định hiện hành của Liên đoàn).
     - grassroots: VĐV tự đăng ký; giải có memberOnly thì phải là hội viên.
     Cả hai đều vào cùng một nơi để vận hành duyệt TỪNG NGƯỜI vào danh sách thi
     đấu chính thức trước khi bốc thăm. */

  /** Giải đang đăng ký. Ưu tiên documentId router gắn vào trang; vào bằng hash
      thì không có, nên dò theo tên giải đang hiển thị trên băng tiêu đề. */
  function regTournament(page, data) {
    var list = (data && data.tournaments) || [];
    if (page.__regDoc) {
      var byDoc = list.filter(function (t) { return t.documentId === page.__regDoc; })[0];
      if (byDoc) return byDoc;
    }
    var nameEl = page.querySelector('[data-fill="name"]');
    var name = nameEl ? nameEl.textContent.trim() : '';
    if (!name || name === 'Tên giải đấu') return null;
    return list.filter(function (t) { return (t.name || '').trim() === name; })[0] || null;
  }

  function regEvents(t) {
    return ((t && t.events) || []).filter(function (e) { return e && e.name; });
  }

  /** So theo NGÀY để hạn chót tính hết ngày, giống hệt phía máy chủ. */
  function regDay(v) {
    if (!v) return null;
    var d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  function regWindow(t) {
    var now = new Date();
    var today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    var open = regDay(t && t.regOpenDate);
    var close = regDay(t && (t.regCloseDate || t.regDeadline));
    if (open != null && today < open) {
      return { ok: false, error: 'Giải chưa mở đăng ký. Thời gian nhận đăng ký bắt đầu từ ' + fmtDate(t.regOpenDate) + '.' };
    }
    if (close != null && today > close) {
      return { ok: false, error: 'Giải đã hết hạn đăng ký (hạn chót ' + fmtDate(t.regCloseDate || t.regDeadline) + ').' };
    }
    return { ok: true };
  }

  /* Lệ phí: giải khai nhiều nội dung thì liệt kê từng nội dung, vì người đăng ký
     chọn nội dung nào thì đóng tiền nội dung đó. Giải chưa khai nội dung thì giữ
     nguyên ô "Phí tham dự" cũ. */
  function regFillFees(page, t) {
    var box = page.querySelector('[data-reg-fee-list]');
    if (!box) return;
    var evs = regEvents(t);
    if (!evs.length) {
      /* Giải chưa khai lệ phí: để "—". Ô mẫu trong HTML ghi 200.000đ, giữ lại
         là báo sai số tiền người đăng ký phải nộp. */
      var base = page.querySelector('[data-reg-fee-base]');
      if (base) base.textContent = (t && t.entryFee) ? t.entryFee : '—';
      return;
    }
    box.innerHTML = evs.map(function (e) {
      return '<div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:6px">' +
        '<span style="color:#5C6B63">' + esc(e.name) + '</span>' +
        '<span style="font-weight:600;color:#21428E;white-space:nowrap">' + esc(e.fee || '—') + '</span></div>';
    }).join('');
  }

  function regFillDocs(page, t) {
    var box = page.querySelector('[data-reg-docs]');
    var listEl = page.querySelector('[data-reg-docs-list]');
    if (!box || !listEl) return;
    var docs = ((t && t.docs) || []).filter(function (d) { return d && d.file && d.file.url; });
    if (!docs.length) { box.style.display = 'none'; return; }
    box.style.display = '';
    listEl.innerHTML = docs.map(function (d) {
      return '<div><a href="' + esc(mediaUrl(d.file)) + '" target="_blank" rel="nofollow noopener"><i class="ti ti-file-text"></i> ' +
        esc(d.label || d.file.name || 'Tài liệu') + '</a></div>';
    }).join('');
  }

  /* ----- Giải phong trào: ô chọn nội dung + tổng lệ phí tạm tính ----- */
  function parseFeeNumber(v) {
    var digits = String(v == null ? '' : v).replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
  }
  function formatVnd(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  }
  function regSelfEvents(page) {
    return Array.prototype.slice.call(page.querySelectorAll('[data-reg-self-ev]:checked'))
      .map(function (i) { return i.value; });
  }
  function regFillSelfEvents(page, t) {
    var box = page.querySelector('[data-reg-self-events]');
    var list = page.querySelector('[data-reg-self-events-list]');
    if (!box || !list) return;
    var evs = regEvents(t);
    if (!evs.length) { box.style.display = 'none'; list.innerHTML = ''; return; }
    box.style.display = '';
    list.innerHTML = evs.map(function (e) {
      return '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:#1B2A24;cursor:pointer">' +
        '<input type="checkbox" data-reg-self-ev value="' + esc(e.name) + '"> ' + esc(e.name) +
        (e.fee ? ' <span style="color:#8A968F">(' + esc(e.fee) + ')</span>' : '') + '</label>';
    }).join('');
    var total = page.querySelector('[data-reg-self-fee]');
    var recalc = function () {
      if (!total) return;
      var picked = regSelfEvents(page);
      var sum = 0, counted = 0;
      picked.forEach(function (n) {
        var ev = evs.filter(function (e) { return e.name === n; })[0];
        var fee = ev ? parseFeeNumber(ev.fee) : null;
        if (fee != null) { sum += fee; counted++; }
      });
      total.textContent = counted ? 'Tạm tính: ' + formatVnd(sum) : '';
    };
    list.querySelectorAll('[data-reg-self-ev]').forEach(function (i) { i.addEventListener('change', recalc); });
    recalc();
  }

  /* ----- Giải thành tích cao: chọn VĐV từ danh sách đội đã được xác nhận -----
     Không cho gõ tay VĐV ở trang này: quy định là đội đăng ký "kèm danh sách
     VĐV đã được xác nhận thuộc đội của mình", nên người mới phải đi qua bước
     thêm vào đội + Liên đoàn xác nhận (trang Hội viên → hồ sơ đội). */

  /* Trạng thái đơn hiện có của một VĐV, hiển thị ngay trên dòng của người đó.
     'official' đã vào danh sách thi đấu chính thức: máy chủ giữ nguyên bản ghi
     đó khi đội gửi lại đơn, nên ở đây khoá ô tick luôn — bỏ tick cũng không gỡ
     được, để ô mở ra chỉ làm người dùng tưởng mình vừa rút người đó. */
  var REG_ENTRY_STATE = {
    official: ['Đã vào danh sách chính thức', 'background:#E7F4EC;color:#00814D'],
    pending: ['Đã đăng ký · chờ Liên đoàn duyệt', 'background:#F4F1E8;color:#9A7B2E'],
    rejected: ['Đơn đã bị từ chối', 'background:#FBEAEA;color:#9E2A2B'],
  };

  function regSquadRowHtml(a, evs, entry) {
    var cell = 'padding:10px 12px;border-top:0.5px solid #E3E8E4';
    var meta = [a.cccd ? 'CCCD ' + a.cccd : '', a.memberCode || 'chưa là hội viên']
      .filter(Boolean).join(' · ');
    var state = entry ? (REG_ENTRY_STATE[entry.status] || REG_ENTRY_STATE.pending) : null;
    var locked = !!entry && entry.status === 'official';
    /* Tick sẵn người đã có trong đơn: gửi lại là THAY danh sách chưa duyệt chứ
       không cộng dồn, nên để trống ô của họ là lần gửi sau âm thầm rút họ ra. */
    var picked = !!entry && entry.status !== 'rejected';
    var pickedEvents = (entry && Array.isArray(entry.events)) ? entry.events : [];

    return '<div data-squad-row="' + esc(a.documentId) + '"' + (entry ? ' data-had-entry="1"' : '') +
      ' style="' + cell + ';display:flex;gap:12px;flex-wrap:wrap">' +
      '<label style="display:flex;align-items:flex-start;gap:8px;flex:1;min-width:200px;cursor:' + (locked ? 'default' : 'pointer') + '">' +
        '<input type="checkbox" data-reg-pick="' + esc(a.documentId) + '" style="margin-top:3px"' +
          (picked ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
        '<span><span style="font-size:13px;font-weight:600;color:#1B2A24">' + esc(a.fullName) + '</span>' +
        (state ? ' <span class="vb-badge" style="' + state[1] + ';font-size:10.5px;white-space:nowrap">' + state[0] + '</span>' : '') +
        '<span style="display:block;font-size:11.5px;color:#8A968F;margin-top:2px">' + esc(meta) +
          (entry && entry.paid ? ' · đã ghi nhận lệ phí' : '') + '</span></span>' +
      '</label>' +
      (evs.length
        ? '<div style="display:flex;flex-wrap:wrap;gap:4px 14px;align-items:flex-start">' + evs.map(function (e) {
            var on = pickedEvents.indexOf(e.name) >= 0;
            return '<label style="display:flex;align-items:center;gap:5px;white-space:nowrap;font-size:11.5px;color:#5C6B63;cursor:' + (locked ? 'default' : 'pointer') + '">' +
              '<input type="checkbox" data-pick-ev value="' + esc(e.name) + '"' + (on ? ' checked' : '') + (locked ? ' disabled' : '') + '> ' + esc(e.name) + '</label>';
          }).join('') + '</div>'
        : '') +
    '</div>';
  }

  /** [{documentId, events}] của những người đang được tick. */
  function regReadPicks(page) {
    var out = [];
    page.querySelectorAll('[data-squad-row]').forEach(function (row) {
      var cb = row.querySelector('[data-reg-pick]');
      if (!cb || !cb.checked) return;
      out.push({
        documentId: cb.getAttribute('data-reg-pick'),
        events: Array.prototype.slice.call(row.querySelectorAll('[data-pick-ev]:checked'))
          .map(function (i) { return i.value; }),
      });
    });
    return out;
  }

  function regSquadSummary(page, t) {
    var sum = page.querySelector('[data-reg-squad-sum]');
    if (!sum) return;
    var picks = regReadPicks(page);
    if (!picks.length) { sum.textContent = ''; return; }
    var evs = regEvents(t);
    var total = 0, counted = 0;
    picks.forEach(function (p) {
      p.events.forEach(function (n) {
        var ev = evs.filter(function (e) { return e.name === n; })[0];
        var fee = ev ? parseFeeNumber(ev.fee) : null;
        if (fee != null) { total += fee; counted++; }
      });
    });
    /* Nói thẳng hệ quả của việc gửi lại: ai đang có trong đơn mà lần này không
       tick thì bị rút khỏi đơn (máy chủ thay danh sách chưa duyệt, không cộng
       dồn). Đây là chỗ dễ sai nhất khi đội sửa đơn đã gửi. */
    var had = page.querySelectorAll('[data-squad-row][data-had-entry]').length;
    var dropped = 0;
    page.querySelectorAll('[data-squad-row][data-had-entry]').forEach(function (row) {
      var cb = row.querySelector('[data-reg-pick]');
      if (cb && !cb.checked) dropped++;
    });
    sum.textContent = 'Đã chọn ' + picks.length + ' vận động viên' +
      (counted ? ' · tạm tính lệ phí ' + formatVnd(total) : '') +
      (had ? ' · gửi lại sẽ thay danh sách đã nộp' : '') +
      (dropped ? ' · ' + dropped + ' người đang có trong đơn sẽ bị rút ra' : '');
  }

  /** Đơn hiện có của đội cho giải này, tra theo CCCD. Lỗi thì coi như chưa có
      đơn nào — mất nhãn trạng thái còn hơn là không đăng ký được. */
  async function regFetchEntries(t) {
    var token = window.VBSF_AUTH && window.VBSF_AUTH.orgToken();
    if (!token || !t || !t.documentId) return {};
    try {
      var out = await postJson('tournament-entries/mine-team', { tournamentDocId: t.documentId }, token);
      var byCccd = {};
      (out.entries || []).forEach(function (e) {
        var key = String(e.cccd || '').replace(/[^\dA-Za-z]/g, '');
        if (key) byCccd[key] = e;
      });
      return byCccd;
    } catch (err) {
      return {};
    }
  }

  async function regFillSquad(page, t) {
    var listBox = page.querySelector('[data-reg-squad-list]');
    var emptyBox = page.querySelector('[data-reg-squad-empty]');
    if (!listBox || !emptyBox) return;

    var squad = [];
    try {
      squad = window.VBSF_SQUAD ? await window.VBSF_SQUAD.confirmed() : [];
    } catch (err) {
      squad = [];
    }
    if (!squad.length) {
      listBox.style.display = 'none';
      listBox.innerHTML = '';
      emptyBox.style.display = '';
      return;
    }
    emptyBox.style.display = 'none';
    listBox.style.display = '';
    var evs = regEvents(t);
    var entries = await regFetchEntries(t);
    listBox.innerHTML = squad.map(function (a) {
      var key = String(a.cccd || '').replace(/[^\dA-Za-z]/g, '');
      return regSquadRowHtml(a, evs, key ? entries[key] : null);
    }).join('');
    listBox.querySelectorAll('input[type=checkbox]').forEach(function (i) {
      i.addEventListener('change', function () { regSquadSummary(page, t); });
    });
    page.__regEntries = entries;
    regSquadSummary(page, t);
  }

  /* ----- Dựng lại cả trang theo giải đang chọn + trạng thái đăng nhập ----- */
  async function applyRegistrationPage(page, data) {
    var t = regTournament(page, data);
    var show = function (sel, on) { var e = page.querySelector(sel); if (e) e.style.display = on ? '' : 'none'; };

    /* Vào trang bằng hash hoặc link trực tiếp thì router không có dataset để điền
       băng tiêu đề; điền từ chính bản ghi giải để không còn chữ mẫu "Tên giải đấu". */
    if (t) {
      fill(page, 'name', t.name || '');
      fill(page, 'disc', t.category || '');
      fill(page, 'date', fmtDate(t.date));
      fill(page, 'loc', t.location || '');
      /* Giải chưa khai nội dung lẫn ngày thì dòng phụ chỉ còn mỗi dấu "·". */
      var sub = page.querySelector('[data-reg-sub]');
      if (sub) sub.style.display = (t.category || t.date) ? '' : 'none';
    }

    regFillFees(page, t);
    regFillDocs(page, t);

    var closed = page.querySelector('[data-reg-closed]');
    var win = t ? regWindow(t) : { ok: true };
    if (closed) {
      closed.innerHTML = win.ok ? '' : '<i class="ti ti-clock-x"></i> ' + esc(win.error);
      closed.style.display = win.ok ? 'none' : '';
    }

    /* Giải chưa khai `nature` là giải tạo trước khi có luồng mới — Liên đoàn quy
       định mặc định là giải thành tích cao. */
    var national = !t || (t.nature || 'national') === 'national';
    show('[data-reg-national]', national && win.ok);
    show('[data-reg-grassroots]', !national && win.ok);

    if (national) {
      var auth = window.VBSF_AUTH;
      var org = auth ? auth.currentOrg() : null;
      if (!org && auth && typeof auth.restoreOrg === 'function') {
        try { org = await auth.restoreOrg(); } catch (e) { org = null; }
      }
      show('[data-reg-team-login]', !org);
      show('[data-reg-team-form]', !!org);
      if (org) {
        setText(page, '[data-reg-team-name]', org.name || '—');
        setText(page, '[data-reg-team-code]', org.code || '—');
        setText(page, '[data-reg-team-prov]', org.province || org.orgType || '—');
        var leader = page.querySelector('[data-reg-leader]');
        if (leader && !leader.value) leader.value = org.repName || '';
        var ltitle = page.querySelector('[data-reg-leader-title]');
        if (ltitle && !ltitle.value) ltitle.value = org.repTitle || '';
        var lphone = page.querySelector('[data-reg-leader-phone]');
        if (lphone && !lphone.value) lphone.value = org.repPhone || '';
        /* Nạp lại danh sách đội mỗi lần vào trang: ô chọn nội dung phụ thuộc
           vào giải, và Liên đoàn có thể vừa xác nhận thêm người. */
        await regFillSquad(page, t);
      }
    } else {
      var me = await applyMemberIdentity(page);
      regFillSelfEvents(page, t);
      show('[data-reg-memberonly]', !!(t && t.memberOnly) && !me);
    }
    page.__regT = t;
  }

  RENDER['giai-dau-dang-ky'] = function (page, data) {
    applyBankBox(page, data && data.settings);
    applyRegistrationPage(page, data);

    var manualLink = page.querySelector('[data-reg-manual]');
    if (manualLink && !manualLink.__wired) {
      manualLink.__wired = true;
      manualLink.addEventListener('click', function () {
        page.__regManual = true;
        applyMemberIdentity(page);
      });
    }

    var show = function (el, text) { if (el) { el.innerHTML = text || ''; el.style.display = text ? '' : 'none'; } };
    var val = function (sel) { var e = page.querySelector(sel); return e ? e.value.trim() : ''; };

    /* ----- nút của luồng đội ----- */
    var teamBtn = page.querySelector('[data-reg-team-submit]');
    if (teamBtn && !teamBtn.__wired) {
      teamBtn.__wired = true;
      var tOk = page.querySelector('[data-reg-team-ok]');
      var tErr = page.querySelector('[data-reg-team-err]');
      teamBtn.addEventListener('click', async function () {
        show(tOk, ''); show(tErr, '');
        var t = page.__regT;
        if (!t) {
          show(tErr, 'Chưa chọn giải đấu. Vào mục Giải đấu rồi bấm "Đăng ký" ở giải bạn muốn tham dự.');
          return;
        }
        var picks = regReadPicks(page);
        if (!picks.length) { show(tErr, 'Chưa chọn vận động viên nào trong danh sách đội.'); return; }
        var token = window.VBSF_AUTH && window.VBSF_AUTH.orgToken();
        if (!token) { show(tErr, 'Phiên đăng nhập của đội đã hết hạn. Vui lòng đăng nhập lại.'); return; }
        teamBtn.disabled = true;
        try {
          var msg = await submitForm('tournament-entries/submit-team', {
            tournamentDocId: t.documentId,
            leaderName: val('[data-reg-leader]'),
            leaderTitle: val('[data-reg-leader-title]'),
            leaderPhone: val('[data-reg-leader-phone]'),
            note: val('[data-reg-team-note]'),
            athletes: picks,
          }, token);
          show(tOk, '<i class="ti ti-circle-check-filled"></i> ' + esc(msg));
          // Vẽ lại danh sách để nhãn "Đã đăng ký" hiện ngay, không phải tải lại trang.
          await regFillSquad(page, t);
        } catch (e) {
          show(tErr, esc(e.message));
        } finally { teamBtn.disabled = false; }
      });
    }

    /* ----- nút của luồng VĐV tự đăng ký ----- */
    var btn = page.querySelector('[data-reg-tourney-submit]');
    if (!btn || btn.__wired) return;
    btn.__wired = true;
    var ok = page.querySelector('[data-reg-tourney-ok]');
    var err = page.querySelector('[data-reg-tourney-err]');

    btn.addEventListener('click', async function () {
      show(ok, ''); show(err, '');
      var t = page.__regT;
      if (!t) {
        show(err, 'Chưa chọn giải đấu. Vào mục Giải đấu rồi bấm "Đăng ký" ở giải bạn muốn tham dự.');
        return;
      }
      btn.disabled = true;
      try {
        /* Gửi đúng thứ người dùng đang NHÌN THẤY: chỉ dùng hồ sơ khi thẻ hội viên
           đang hiện. Gọi applyMemberIdentity() ở đây sẽ đổi giao diện ngay lúc
           bấm gửi và có thể bỏ qua những gì họ vừa gõ tay. */
        var card = page.querySelector('[data-reg-asmember]');
        var usingMember = !!card && card.style.display !== 'none';
        var me = usingMember && window.VBSF_AUTH ? window.VBSF_AUTH.currentMember() : null;
        var msg = await submitForm('tournament-entries/submit', {
          tournamentDocId: t.documentId,
          fullName: me ? me.name : val('[data-reg-player]'),
          dob: me ? undefined : (val('[data-reg-dob]') || undefined),
          cccd: me ? undefined : val('[data-reg-cccd]'),
          phone: me ? me.phone : val('[data-reg-phone2]'),
          address: me ? undefined : val('[data-reg-club2]'),
          note: val('[data-reg-note]'),
          events: regSelfEvents(page),
        }, window.VBSF_AUTH && window.VBSF_AUTH.memberToken());
        show(ok, '<i class="ti ti-circle-check-filled"></i> ' + esc(msg));
        ['[data-reg-player]', '[data-reg-dob]', '[data-reg-cccd]', '[data-reg-phone2]', '[data-reg-club2]', '[data-reg-note]']
          .forEach(function (sel) { var e = page.querySelector(sel); if (e) e.value = ''; });
      } catch (e) {
        show(err, esc(e.message));
      } finally { btn.disabled = false; }
    });
  };

  /* Khối chuyển khoản dùng chung cho 3 trang: Đăng ký hội viên, Gia hạn hội viên
     và Đăng ký thi đấu. Ngân hàng/số TK/chủ TK lấy ở "Thông tin tổ chức"; ảnh QR
     cũng vậy, nhưng tách 2 mã — `member` cho hội phí, `tournament` cho lệ phí giải.
     Chưa tải mã nào lên thì giữ nguyên ô giữ chỗ (và ở trang đăng ký giải thì
     khối QR vẫn ẩn), nên trang cũ không đổi giao diện. */
  function applyBankBox(page, s) {
    if (!s) return;
    page.querySelectorAll('[data-bank]').forEach(function (el) {
      var k = el.getAttribute('data-bank');
      var v = k === 'name' ? s.bankName : k === 'account' ? s.bankAccount : s.bankHolder;
      if (v) el.textContent = v;
    });
    page.querySelectorAll('[data-qr]').forEach(function (el) {
      var src = el.getAttribute('data-qr') === 'tournament' ? s.qrTournament : s.qrMember;
      if (!src) return;
      el.classList.remove('vb-ph');
      el.innerHTML = '<img src="' + esc(src) + '" alt="Mã QR chuyển khoản" ' +
        'style="width:100%;height:100%;object-fit:contain;display:block">';
      // Trang đăng ký giải giấu sẵn khối QR + số tài khoản cho tới khi có mã.
      var box = el.closest('[data-qr-box]');
      if (box) {
        box.style.display = '';
        var bank = box.parentNode && box.parentNode.querySelector('[data-qr-bank]');
        if (bank) bank.style.display = '';
      }
    });
  }

  RENDER['hoi-vien'] = function (page, data) {
    var s = data.settings;
    applyBankBox(page, s);

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
          : '<tr><td colspan="4" style="color:#8A968F">' +
            L('Không tìm thấy ' + opts.noun + ' phù hợp.', 'No matching ' + opts.nounEn + '.') + '</td></tr>';
        if (countEl) {
          var p = res.pagination;
          var from = (p.page - 1) * MEMBER_PAGE_SIZE + 1;
          var to = Math.min(from + res.data.length - 1, p.total);
          countEl.textContent = p.total
            ? L('Tổng ' + p.total + ' ' + opts.noun + ' · hiển thị ' + from + '–' + to,
                p.total + ' ' + opts.nounEn + ' · showing ' + from + '–' + to)
            : L('Chưa có ' + opts.noun + ' nào', 'No ' + opts.nounEn + ' yet');
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

    wirePanel({ tab: 'ca-nhan', path: 'members', row: memberRow, searchSelector: '[data-member-search]', noun: 'hội viên cá nhân', nounEn: 'individual members', populate: 'avatar' });
    wirePanel({ tab: 'to-chuc', path: 'member-orgs', row: orgRow, searchSelector: '[data-org-search]', noun: 'hội viên tổ chức', nounEn: 'organisation members' });
  };

  /* ---------------- các trang chi tiết (điền sau khi điều hướng) ---------------- */

  /** Bài viết: đổ tiêu đề/ảnh/nội dung richtext + tin liên quan. */
  function fillArticle(page, data, docId) {
    var n = data.news.filter(function (a) { return a.documentId === docId; })[0];
    if (!n) { showMissing(page, 'Không tìm thấy bài viết này. Bài có thể đã được gỡ.'); return; }
    hideMissing(page);

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
    if (!t) { showMissing(page, 'Không tìm thấy giải đấu này. Giải có thể đã được gỡ.'); return; }
    hideMissing(page);

    var prizeBody = page.querySelector('[data-tabpanel="chung"] table.rk-tbl tbody');
    /* Bảng giải thưởng mẫu trong HTML ghi sẵn "20.000.000đ". Giải chưa khai giải
       thưởng thì phải nói là chưa công bố, không để lại con số đó. */
    if (prizeBody && !(t.prizes && t.prizes.length)) {
      prizeBody.innerHTML = '<tr><td colspan="3" style="color:#8A968F">Chưa công bố cơ cấu giải thưởng.</td></tr>';
    }
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
    if (rulesTarget && !t.rules) {
      rulesTarget.innerHTML = emptyNote('Chưa công bố thể lệ giải.');
    }
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
    if (!t) { showMissing(page, 'Không tìm thấy giải đấu này. Giải có thể đã được gỡ.'); return; }
    hideMissing(page);

    /* Nội dung mẫu của trang này là CẢ MỘT BẢNG TỶ SỐ với tên vận động viên cụ
       thể. Chưa có sơ đồ thi đấu mà để nguyên thì người xem không có cách nào
       biết đó là dữ liệu giả — nên xoá trước, điền sau. */
    var liveBody = page.children[1];
    if (!t.bracket || !t.bracket.rounds || !t.bracket.rounds.length) {
      fillList(liveBody, '', 'Giải chưa bốc thăm xếp cặp. Kết quả sẽ hiển thị khi giải bắt đầu.');
      return;
    }

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

    fillList(liveBody, html && html +
      '<div style="font-size:11px;color:#8A968F;margin-top:14px">Tỷ số theo thể thức đấu loại trực tiếp · Cập nhật tự động khi có kết quả mới</div>',
      'Chưa có trận nào bắt đầu. Kết quả sẽ hiển thị ngay khi có.');
  }

  /** Kết quả chung cuộc: bảng xếp hạng chi tiết có thể chưa có dữ liệu. */
  function fillFinalResults(page) {
    var body = page.querySelector('[data-more-target]');
    if (body && !body.children.length) {
      body.innerHTML =
        '<tr><td colspan="3" style="color:#8A968F">Bảng xếp hạng chung cuộc chi tiết chưa được công bố cho nội dung này.</td></tr>';
    }
  }

  var DETAIL_FILL = {
    'tin-tuc-chi-tiet': fillArticle,
    'giai-dau-chi-tiet': fillTournamentDetail,
    'giai-dau-truc-tiep': fillLiveResults,
  };

  /* ---------------- API công khai ---------------- */

  /* Logo do CMS quản lý (Thông tin tổ chức → Logo tổ chức). Nằm ngoài các trang
     như footer nên điền theo tài liệu, không theo trang. Chưa tải lên thì giữ
     nguyên vòng tròn chữ "VBSF" trong HTML. */
  function hydrateBrand(data) {
    var url = (data.settings && data.settings.logo) || '';
    if (!url) return;
    /* Đặt ảnh BÊN TRONG vòng tròn, giữ nguyên viền tròn như trước: ô này đã là
       flex căn giữa nên chỉ cần chèn <img> vào. Dùng ảnh nền cho cả ô thì mất
       viền và logo bị kéo sát mép. */
    document.querySelectorAll('[data-logo-slot]').forEach(function (el) {
      el.innerHTML = '<img src="' + esc(url) + '" alt="Logo VBSF" ' +
        'style="width:78%;height:78%;object-fit:contain;display:block">';
    });
    /* Tab của trình duyệt: không có <link rel="icon"> sẵn trong HTML nên tự
       thêm, để đổi logo trong CMS là đổi luôn icon trên tab. */
    var icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = url;
  }

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
  /* Áp cấu hình CMS lên một trang: bật/tắt khối, tiêu đề khối, các ô [data-fill]
     và ảnh nền. Phần dữ liệu (tin/giải/đối tác) do RENDER lo — có dùng bộ chọn
     của CMS qua pickItems/pickOne. */
  /* Đặt ảnh nền cho một ô. Ô đang là khung xám chờ ảnh (.vb-ph + icon) thì gỡ
     luôn khung và icon, không thì ảnh nằm dưới lớp xám và coi như không thấy. */
  function setBackground(el, url) {
    if (!el || !url) return;
    if (el.classList.contains('vb-ph')) {
      el.classList.remove('vb-ph');
      var icon = el.querySelector(':scope > i');
      if (icon) icon.remove();
    }
    el.style.backgroundImage = "url('" + url + "')";
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  }

  function applyPageContent(pageId, page, data) {
    var all = data.pageContent && data.pageContent.data && data.pageContent.data.pageSections;
    var list = (all && all[pageId]) || [];
    list.forEach(function (entry) {
      if (!entry || !entry.key) return;
      var el = section(page, entry.key);
      if (!el) return;

      if (sectionHidden(entry)) { el.style.display = 'none'; return; }

      if (entry.title) setText(el, '[data-title]', entry.title);

      var content = entry.content || {};
      /* [data-fill] nhận chữ thuần; [data-fill-html] dành cho ô soạn thảo
         (type:'textarea' trong registry) — CMS lưu HTML cho những ô đó. Tách
         hai loại thay vì đoán theo nội dung để không tự dựng HTML từ ô chữ. */
      el.querySelectorAll('[data-fill]').forEach(function (slot) {
        var v = content[slot.getAttribute('data-fill')];
        if (v != null && String(v).trim() !== '') slot.textContent = v;
      });
      el.querySelectorAll('[data-fill-html]').forEach(function (slot) {
        var v = content[slot.getAttribute('data-fill-html')];
        if (v != null && String(v).trim() !== '') slot.innerHTML = v;
      });

      if (entry.backgroundImage) setBackground(el.querySelector('[data-bg]') || el, entry.backgroundImage);
    });

    reorderSections(page, list);
  }

  /* CMS cho kéo thả sắp xếp khối, nên trang phải đổi thứ tự theo. Chỉ sắp lại
     những khối CÙNG một cha — vd. banner trang chủ và cột tin bên cạnh nằm trong
     một hàng flex riêng, đổi chỗ chúng với khối ngoài hàng đó thì vỡ bố cục. */
  function reorderSections(page, list) {
    var groups = new Map();
    list.forEach(function (entry) {
      if (!entry || !entry.key) return;
      var el = section(page, entry.key);
      if (!el || !el.parentNode) return;
      if (!groups.has(el.parentNode)) groups.set(el.parentNode, []);
      groups.get(el.parentNode).push(el);
    });
    groups.forEach(function (els, parent) {
      if (els.length < 2) return;
      /* Chỉ HOÁN VỊ các khối trong đúng những vị trí chúng đang chiếm: đánh dấu
         từng vị trí bằng một comment rồi đặt lại theo thứ tự CMS. Làm kiểu chèn
         tương đối sẽ kéo cả các phần tử không phải section nằm xen giữa. */
      var slots = Array.prototype.filter.call(parent.children, function (c) {
        return els.indexOf(c) > -1;
      }).map(function (node) {
        var mark = document.createComment('vbsf-section-slot');
        parent.insertBefore(mark, node);
        return mark;
      });
      els.forEach(function (el, i) { if (slots[i]) parent.insertBefore(el, slots[i]); });
      slots.forEach(function (mark) { parent.removeChild(mark); });
    });
  }

  async function hydrate(pageId, page) {
    var data = await load();
    if (!data) return;
    try { hydrateBrand(data); hydrateFooter(data); applyPageContent(pageId, page, data); }
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
    /* hydrate() chỉ chạy một lần, lúc trang được nạp vào DOM lần đầu; sau đó
       trang nằm sẵn nên RENDER không chạy lại. Trạng thái đăng nhập thì đổi
       giữa chừng được (xem trang đăng ký trước, đăng nhập sau, rồi quay lại),
       nên phải áp lại ở đây — nơi chạy mỗi lần điều hướng.
       Đặt TRƯỚC guard dataset bên dưới vì điều hướng bằng hash không có dataset. */
    if (dest === 'giai-dau-dang-ky' && page) {
      page.__regManual = false;   // chọn "nhập thủ công" chỉ có hiệu lực trong lần đăng ký đó
      /* Điều hướng bằng hash không mang dataset; giữ lại documentId của lần bấm
         "Đăng ký" gần nhất thay vì xoá đi và phải dò lại theo tên giải. */
      if (dataset && dataset.doc) page.__regDoc = dataset.doc;
      var regData = await load();
      if (regData) applyRegistrationPage(page, regData);
    }

    var data = await load();
    if (!data || !page) return;
    try {
      /* Trang chi tiết: chạy KỂ CẢ khi không có dataset.

         Hai đường vào không mang dataset: điều hướng bằng hash (link dán ra
         ngoài, bấm back) và chính cú bấm vừa rồi — nó gán location.hash nên
         hashchange gọi lại afterNav() với dataset null. Trước đây cả hai bị
         guard chặn, nên vào bằng hash là thấy nguyên bài viết/bảng tỷ số mẫu
         trong pages/*.html, không có gì báo đó là dữ liệu giả.

         Nhớ documentId của lần bấm gần nhất (như __regDoc ở trang đăng ký) để
         lần gọi thứ hai không coi là "không có bản ghi" và xoá trắng bài vừa
         mở. Không có documentId nào thì các hàm fill* tự hiện "không tìm
         thấy". */
      var detailFill = DETAIL_FILL[dest];
      if (detailFill) {
        if (dataset && dataset.doc) page.__detailDoc = dataset.doc;
        detailFill(page, data, page.__detailDoc || '');
      }
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
    initLang: initLang,
    lang: currentLang,
    setLang: setLang,
    submitPaymentClaim: function (payload) { return submitForm('payment-claims/submit', payload); },
    hydrate: hydrate,
    afterNav: afterNav,
    fees: fees,
    fmtDate: fmtDate,
    strapiUrl: STRAPI_URL,
  };
})();
