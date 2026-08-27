'use strict';
/* Bộ giả lập tối thiểu của đối tượng `strapi` toàn cục — đủ cho các controller
   và service trong src/ chạy được trong unit test, không cần boot Strapi thật
   (boot mất ~10s và cần CSDL). */

/** Kho dữ liệu trong bộ nhớ, mô phỏng documents() + db.query() của Strapi. */
function createMockStrapi(seed) {
  const tables = {};
  Object.keys(seed || {}).forEach((uid) => {
    tables[uid] = (seed[uid] || []).map((r, i) => ({
      id: i + 1,
      documentId: r.documentId || 'doc' + (i + 1),
      ...r,
    }));
  });

  const rows = (uid) => (tables[uid] = tables[uid] || []);

  /** Hỗ trợ where phẳng, $or và các toán tử $eq/$ne/$containsi như Strapi. */
  function matches(row, where) {
    if (!where) return true;
    if (where.$or) return where.$or.some((w) => matches(row, w));
    return Object.keys(where).every((key) => {
      const cond = where[key];
      if (cond && typeof cond === 'object') {
        if ('$eq' in cond) return row[key] === cond.$eq;
        if ('$ne' in cond) return row[key] !== cond.$ne;
        if ('$containsi' in cond) {
          return String(row[key] || '').toLowerCase().includes(String(cond.$containsi).toLowerCase());
        }
        return false;
      }
      return row[key] === cond;
    });
  }

  const emails = [];
  const uploads = [];

  const strapi = {
    // Dữ liệu thô, để test khẳng định trực tiếp trên CSDL giả.
    _tables: tables,
    _emails: emails,
    _uploads: uploads,
    log: { info() {}, warn() {}, error() {} },

    contentType() {
      return {
        attributes: {
          province: { enum: ['Hà Nội', 'TP.HCM', 'Đà Nẵng'] },
          orgType: { enum: ['Câu lạc bộ', 'Doanh nghiệp', 'Trường học', 'Tổ chức khác'] },
        },
      };
    },

    db: {
      query(uid) {
        return {
          async findOne({ where, select } = {}) {
            const row = rows(uid).find((r) => matches(r, where));
            if (!row) return null;
            if (!select) return { ...row };
            const out = { documentId: row.documentId };
            select.forEach((f) => { out[f] = row[f]; });
            return out;
          },
          async findMany({ where, select } = {}) {
            return rows(uid)
              .filter((r) => matches(r, where))
              .map((r) => {
                if (!select) return { ...r };
                const out = {};
                select.forEach((f) => { out[f] = r[f]; });
                return out;
              });
          },
        };
      },
    },

    documents(uid) {
      return {
        async create({ data }) {
          const row = {
            id: rows(uid).length + 1,
            documentId: 'doc' + (rows(uid).length + 1),
            ...data,
          };
          // Strapi tự hash field kiểu `password`; giả lập bằng tiền tố để test
          // phân biệt được "đã hash" với "lưu thô".
          if (data.password) row.password = 'hashed:' + data.password;
          rows(uid).push(row);
          return { ...row };
        },
        async update({ documentId, data }) {
          const row = rows(uid).find((r) => r.documentId === documentId);
          if (!row) throw new Error('không tìm thấy ' + documentId);
          Object.assign(row, data);
          if (data && data.password) row.password = 'hashed:' + data.password;
          return { ...row };
        },
        async findOne({ documentId }) {
          const row = rows(uid).find((r) => r.documentId === documentId);
          return row ? { ...row } : null;
        },
      };
    },

    plugin(name) {
      if (name === 'email') {
        return { service: () => ({ async send(payload) { emails.push(payload); } }) };
      }
      if (name === 'upload') {
        return {
          service: () => ({
            async upload({ files }) {
              const file = { id: uploads.length + 1, url: '/uploads/' + (files.originalFilename || 'f.png') };
              uploads.push(file);
              return [file];
            },
          }),
        };
      }
      throw new Error('plugin chưa mock: ' + name);
    },
  };

  return strapi;
}

/** ctx giả của Koa: ghi lại status/body và lỗi mà controller trả về. */
function createMockCtx(options) {
  const opts = options || {};
  const ctx = {
    request: {
      body: opts.body || {},
      header: opts.headers || {},
      ip: opts.ip || '127.0.0.1',
      files: opts.files,
    },
    state: opts.state || {},
    status: 200,
    body: undefined,
    headers: {},
    _error: null,
    set(key, value) { ctx.headers[key] = value; },
    badRequest(message) { ctx._error = { status: 400, message }; return ctx._error; },
    unauthorized(message) { ctx._error = { status: 401, message }; return ctx._error; },
    conflict(message) { ctx._error = { status: 409, message }; return ctx._error; },
  };
  return ctx;
}

/* createCoreController thật cần Strapi đang chạy. Bản giả này dựng đúng hình
   dạng cần thiết: object literal của ta có prototype là core controller, nên
   `super.find(ctx)` bên trong vẫn gọi được. */
function stubCoreControllerFactory(coreImplementation) {
  const path = require.resolve('@strapi/strapi');
  require.cache[path] = {
    id: path,
    filename: path,
    loaded: true,
    exports: {
      factories: {
        createCoreController(uid, extend) {
          const obj = extend ? extend({ strapi: global.strapi }) : {};
          Object.setPrototypeOf(obj, coreImplementation);
          return obj;
        },
      },
    },
  };
}

module.exports = { createMockStrapi, createMockCtx, stubCoreControllerFactory };
