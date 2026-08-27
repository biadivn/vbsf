'use strict';
/* Tiện ích dùng chung cho đăng nhập/đăng ký của SITE PUBLIC (hội viên cá nhân &
   hội viên tổ chức). Token là JWT riêng, KHÔNG dùng chung với JWT của CMS
   (users-permissions) để hai hệ không lẫn quyền vào nhau. */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const TOKEN_TTL = '7d';

/* Field không được trả ra ngoài: mật khẩu (kể cả bản hash) và dữ liệu định danh
   cá nhân. `me` được trả đầy đủ hơn vì đó là hồ sơ của chính người đăng nhập. */
const SECRET_FIELDS = ['password'];
const PRIVATE_MEMBER_FIELDS = ['cccd', 'phone', 'email', 'dob', 'address'];
const PRIVATE_ORG_FIELDS = ['taxCode', 'phone', 'repPhone', 'repEmail'];

function secret() {
  const value = process.env.PUBLIC_AUTH_JWT_SECRET || process.env.JWT_SECRET;
  if (!value) throw new Error('Thiếu PUBLIC_AUTH_JWT_SECRET (hoặc JWT_SECRET) trong .env');
  return value;
}

function signToken(payload) {
  return jwt.sign(payload, secret(), { expiresIn: TOKEN_TTL });
}

/** Đọc Bearer token; trả payload đã verify hoặc null. */
function readToken(ctx) {
  const header = ctx.request.header.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), secret());
  } catch (err) {
    return null;
  }
}

function omit(entry, fields) {
  if (!entry) return entry;
  const out = { ...entry };
  fields.forEach((f) => delete out[f]);
  return out;
}

/** Bản ghi trả cho chính chủ tài khoản — đủ thông tin hồ sơ, trừ mật khẩu. */
function selfView(entry) {
  return omit(entry, SECRET_FIELDS);
}

/** Bản ghi trả cho người xem ẩn danh trên site public. */
function publicView(entry, kind) {
  return omit(entry, SECRET_FIELDS.concat(kind === 'org' ? PRIVATE_ORG_FIELDS : PRIVATE_MEMBER_FIELDS));
}

async function comparePassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(plain), String(hash));
}

/** Chuẩn hoá SĐT về dạng chỉ chữ số để so khớp không phụ thuộc khoảng trắng. */
function normalizePhone(phone) {
  return String(phone == null ? '' : phone).replace(/[^\d]/g, '');
}

/** Sinh mã hội viên kế tiếp theo tiền tố (VBSF-2026-00123 / VBSF-TC-2026-006). */
async function nextCode(strapi, uid, prefix, pad) {
  const rows = await strapi.db.query(uid).findMany({ select: ['code'] });
  let max = 0;
  rows.forEach((r) => {
    if (!r.code || r.code.indexOf(prefix) !== 0) return;
    const n = parseInt(String(r.code).slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return prefix + String(max + 1).padStart(pad, '0');
}

module.exports = {
  TOKEN_TTL,
  PRIVATE_MEMBER_FIELDS,
  PRIVATE_ORG_FIELDS,
  signToken,
  readToken,
  selfView,
  publicView,
  comparePassword,
  normalizePhone,
  nextCode,
};
