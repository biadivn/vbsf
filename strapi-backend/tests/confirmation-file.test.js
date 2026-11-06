'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePdfUpload, MAX_BYTES } = require('../src/utils/confirmation-file');

const pdfUri = (body) => 'data:application/pdf;base64,' + Buffer.from(body, 'latin1').toString('base64');

test('nhận PDF hợp lệ và chuẩn hoá tên tệp', () => {
  const r = parsePdfUpload({ name: '../xac"nhan', data: pdfUri('%PDF-1.4 abc') });
  assert.equal(r.error, undefined);
  assert.equal(r.name, 'xacnhan.pdf');
  assert.equal(r.buffer.length, 12);
});

test('từ chối khi thiếu tệp, sai kiểu hoặc sai nội dung', () => {
  assert.ok(parsePdfUpload(undefined).error);
  assert.ok(parsePdfUpload({ name: 'a.pdf', data: 'data:image/png;base64,AAAA' }).error);
  assert.ok(parsePdfUpload({ name: 'a.pdf', data: pdfUri('MZ not a pdf') }).error);
});

test('từ chối tệp quá 5MB', () => {
  const big = '%PDF-' + 'a'.repeat(MAX_BYTES);
  assert.ok(parsePdfUpload({ name: 'a.pdf', data: pdfUri(big) }).error);
});
