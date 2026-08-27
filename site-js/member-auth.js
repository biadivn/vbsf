/* =========================================================
   VBSF PUBLIC SITE — ĐĂNG NHẬP / ĐĂNG KÝ HỘI VIÊN

   Gọi các endpoint thật của Strapi (src/api/member/routes/member-auth.js và
   src/api/member-org/routes/member-org-auth.js). Mật khẩu được so khớp bằng
   bcrypt ở phía máy chủ; site chỉ giữ JWT trả về.

   Token lưu ở localStorage — đủ cho site public đọc hồ sơ của chính mình, và
   là JWT riêng, không dùng chung với phiên đăng nhập CMS.
   ========================================================= */
(function () {
  'use strict';

  var STRAPI_URL =
    location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:1337'
      : '';

  var MEMBER_TOKEN_KEY = 'vbsf_member_token';
  var ORG_TOKEN_KEY = 'vbsf_org_token';

  function readToken(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeToken(key, value) {
    try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch (e) { /* private mode */ }
  }

  /** Ném Error kèm message tiếng Việt do backend trả về để form hiển thị thẳng. */
  async function call(path, options) {
    var res;
    try {
      res = await fetch(STRAPI_URL + '/api/' + path, options);
    } catch (err) {
      throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
    }
    var out = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error((out.error && out.error.message) || 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
    return out;
  }

  function post(path, body, token) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return call(path, { method: 'POST', headers: headers, body: JSON.stringify(body || {}) });
  }

  function get(path, token) {
    return call(path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
  }

  /* Hồ sơ API có disciplines (điểm/hạng theo từng bộ môn); phần hiển thị hồ sơ
     trên site dùng dạng phẳng với bộ môn cao điểm nhất. */
  function flattenMember(m) {
    if (!m) return null;
    var top = (m.disciplines || []).slice().sort(function (a, b) {
      return (b.points || 0) - (a.points || 0);
    })[0] || {};
    return {
      documentId: m.documentId,
      code: m.code, name: m.name, phone: m.phone, cccd: m.cccd, email: m.email || '',
      club: m.club || '', province: m.province || '', category: m.category || top.category || '',
      status: m.status, expiry: m.expiry ? fmtDate(m.expiry) : '',
      avatar: m.avatar && m.avatar.url ? (m.avatar.url.indexOf('http') === 0 ? m.avatar.url : STRAPI_URL + m.avatar.url) : '',
      rank: top.rank, points: top.points, matches: top.matches,
      trend: top.trend, trendValue: top.trendValue,
      disciplines: m.disciplines || [],
    };
  }

  function flattenOrg(o) {
    if (!o) return null;
    return {
      documentId: o.documentId,
      code: o.code, name: o.name, orgType: o.orgType || '', province: o.province || '',
      address: o.address || '', repName: o.repName || '', repTitle: o.repTitle || '',
      repPhone: o.repPhone || '', repEmail: o.repEmail || '', phone: o.phone,
      package: o.package || '', joinYear: o.joinDate ? String(o.joinDate).slice(0, 4) : '',
      status: o.status, expiry: o.expiry ? fmtDate(o.expiry) : '',
    };
  }

  var api = {
    async loginMember(phone, password) {
      var out = await post('member-auth/login', { phone: phone, password: password });
      writeToken(MEMBER_TOKEN_KEY, out.token);
      return flattenMember(out.member);
    },

    async registerMember(payload) {
      var out = await post('member-auth/register', payload);
      writeToken(MEMBER_TOKEN_KEY, out.token);
      return flattenMember(out.member);
    },

    async loginOrg(phone, password) {
      var out = await post('org-auth/login', { phone: phone, password: password });
      writeToken(ORG_TOKEN_KEY, out.token);
      return flattenOrg(out.org);
    },

    async registerOrg(payload) {
      var out = await post('org-auth/register', payload);
      writeToken(ORG_TOKEN_KEY, out.token);
      return flattenOrg(out.org);
    },

    /** Khôi phục phiên sau khi tải lại trang; token hỏng/hết hạn thì xoá. */
    async restoreMember() {
      var token = readToken(MEMBER_TOKEN_KEY);
      if (!token) return null;
      try {
        return flattenMember((await get('member-auth/me', token)).member);
      } catch (err) {
        writeToken(MEMBER_TOKEN_KEY, null);
        return null;
      }
    },

    async restoreOrg() {
      var token = readToken(ORG_TOKEN_KEY);
      if (!token) return null;
      try {
        return flattenOrg((await get('org-auth/me', token)).org);
      } catch (err) {
        writeToken(ORG_TOKEN_KEY, null);
        return null;
      }
    },

    logoutMember() { writeToken(MEMBER_TOKEN_KEY, null); },
    logoutOrg() { writeToken(ORG_TOKEN_KEY, null); },

    /* Quên mật khẩu — backend luôn trả cùng một thông báo dù số có tài khoản
       hay không, nên phía site cũng chỉ hiển thị nguyên văn thông báo đó. */
    async forgotPassword(kind, phone) {
      var out = await post((kind === 'org' ? 'org-auth' : 'member-auth') + '/forgot-password', { phone: phone });
      return out.message;
    },

    async resetPassword(kind, token, password) {
      var out = await post((kind === 'org' ? 'org-auth' : 'member-auth') + '/reset-password', {
        token: token, password: password,
      });
      return out.message;
    },

    /** Đổi ảnh đại diện — chỉ chủ tài khoản, gửi kèm token đang đăng nhập. */
    async uploadAvatar(file) {
      var token = readToken(MEMBER_TOKEN_KEY);
      if (!token) throw new Error('Bạn cần đăng nhập để đổi ảnh đại diện.');
      var form = new FormData();
      form.append('file', file);
      var res;
      try {
        res = await fetch(STRAPI_URL + '/api/member-auth/avatar', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
          body: form,
        });
      } catch (err) {
        throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
      }
      var out = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error((out.error && out.error.message) || 'Không tải được ảnh lên.');
      return flattenMember(out.member);
    },

    /** {found, status} — dùng để tính mức hội phí, không trả danh tính. */
    async cccdStatus(cccd) {
      try {
        return await post('member-auth/cccd-status', { cccd: cccd });
      } catch (err) {
        return { found: false, status: null };
      }
    },
  };

  window.VBSF_AUTH = api;
})();
