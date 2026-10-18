/* =========================================================
   NHẬP BẢN TIẾNG ANH CHO NỘI DUNG

   Mỗi bản ghi có cột `i18n` dạng { en: { "<field>": "..." } }. Site phủ các
   field đó lên bản ghi khi người xem chọn English, field nào bỏ trống thì giữ
   bản tiếng Việt (xem site-js/i18n.js).

   Vì sao là một màn hình RIÊNG chứ không phải công tắc VI/EN ngay trên form:
   người dịch cần nhìn thấy bản tiếng Việt trong lúc gõ. Ở đây mỗi dòng là
   "bản gốc bên trái — ô nhập bên phải", nên không phải mở hai tab để đối chiếu,
   và cũng không có cách nào lỡ tay sửa nhầm bản tiếng Việt.

   Dùng chung khung modal với form thường (#modalOverlay). i18nModal khác null
   nghĩa là đang mở màn hình này — init.js nhìn biến đó để biết nút Lưu gọi hàm
   nào.
   ========================================================= */
let i18nModal = null;

/* renderField() đặt id ô nhập là `f_<key>`. Màn hình này mở ĐÈ lên form đang
   hiển thị (rõ nhất là Thông tin tổ chức), nên nếu dùng nguyên key thì hai ô
   trùng id và document.getElementById() trả về ô của form phía dưới — lưu bản
   dịch là chép nguyên giá trị tiếng Việt sang. Thêm tiền tố để tách hẳn ra. */
const I18N_PREFIX = 'i18nen_';

/** Bản sao field với key đã thêm tiền tố, chỉ dùng để dựng và đọc ô nhập. */
function i18nInputField(f) {
  return Object.assign({}, f, { key: I18N_PREFIX + f.key, required: false });
}

/** Những field của một module có bản dịch. */
function i18nFieldsOf(key) {
  const c = COLLECTIONS[key];
  return c ? (c.fields || []).filter(f => f.i18n) : [];
}

function collectionHasI18n(key) {
  return i18nFieldsOf(key).length > 0;
}

/* Hai singleton khai field ở page-sections-registry.js chứ không ở COLLECTIONS. */
const I18N_SINGLETON_FIELDS = {
  settings: ['orgName', 'orgShort'],
  contact: ['address', 'hours'],
};

function i18nFieldsOfSingleton(key) {
  const all = key === 'settings' ? SETTINGS_FIELDS : CONTACT_FIELDS;
  const want = I18N_SINGLETON_FIELDS[key] || [];
  return all.filter(f => want.includes(f.key));
}

/** Bản tiếng Việt để hiện cạnh ô nhập — chữ thuần, cắt bớt cho vừa một dòng. */
function i18nSourceText(field, record) {
  const raw = record ? record[field.key] : '';
  if (field.type === 'image') return raw ? 'Đang dùng ảnh tiếng Việt' : 'Chưa có ảnh';
  if (raw == null || raw === '') return '';
  const text = field.type === 'richtext' ? stripHtml(String(raw)) : String(raw);
  return text.length > 400 ? text.slice(0, 400) + '…' : text;
}

/**
 * Mở màn hình nhập bản tiếng Anh.
 * kind: 'collection' (bản ghi trong DB[key]) hoặc 'singleton' (settings/contact).
 */
function openI18nModal(kind, key, id) {
  pageModal = null; addSectionModal = null;
  editingCollection = null; editingId = null;

  const record = kind === 'singleton' ? (DB[key] || {}) : (DB[key] || []).find(r => r.id === id);
  if (!record) return;
  const fields = kind === 'singleton' ? i18nFieldsOfSingleton(key) : i18nFieldsOf(key);
  if (!fields.length) return;

  const en = (record.i18n && record.i18n.en) || {};
  modalImageValues = {};
  fields.forEach(f => { if (f.type === 'image') modalImageValues[I18N_PREFIX + f.key] = en[f.key] || null; });
  i18nModal = { kind, key, id, fields };

  const label = kind === 'singleton'
    ? (key === 'settings' ? 'Thông tin tổ chức' : 'Liên hệ')
    : COLLECTIONS[key].single;
  document.getElementById('modalTitle').textContent = `Bản tiếng Anh — ${label}`;

  const rows = fields.map(f => {
    const source = i18nSourceText(f, record);
    const value = en[f.key] || '';
    const inputField = i18nInputField(f);
    const input = f.type === 'richtext'
      ? renderRichTextField(inputField, value)
      : renderField(inputField, value);
    return `<div class="fld span2" style="border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:10px">
      <label style="display:flex;align-items:center;gap:8px">${escapeHtml(f.label)}
        <span class="badge" style="font-weight:400">EN</span></label>
      <div style="font-size:12px;color:var(--hint);background:var(--surface);border-radius:8px;padding:8px 10px;margin:2px 0 10px;white-space:pre-wrap">${
        source ? escapeHtml(source) : '<i>Bản tiếng Việt đang để trống</i>'
      }</div>
      ${input}
    </div>`;
  }).join('');

  document.getElementById('modalBody').innerHTML =
    `<div class="hint" style="display:flex;gap:8px;margin-bottom:12px"><i class="ti ti-info-circle"></i>
      Ô nào để trống thì trang tiếng Anh dùng luôn bản tiếng Việt — không bao giờ hiện ô rỗng.</div>` +
    `<div>${rows}</div>`;

  document.getElementById('modalDeleteBtn').style.display = 'none';
  document.getElementById('modalSaveBtn').style.display = '';
  document.querySelector('#modalOverlay .modal').classList.add('wide');
  document.getElementById('modalOverlay').classList.add('on');
  attachRTEEvents();
  attachModalImageEvents();
}

/** Đọc các ô trong màn hình bản dịch; ô ảnh mới chọn thì tải lên trước. */
async function readI18nInputs(fields) {
  const en = {};
  for (const f of fields) {
    const domKey = I18N_PREFIX + f.key;
    let val;
    if (f.type === 'image') {
      val = modalImageValues[domKey] || '';
      /* Ảnh mới chọn đang là data URI — tải lên Strapi rồi lưu ĐƯỜNG DẪN, không
         nhét cả ảnh vào cột i18n: cột đó nằm trong mọi phản hồi API của site. */
      if (val && val.startsWith('data:')) val = await uploadDataUriUrl(val, f.key + '-en');
    } else if (f.type === 'richtext') {
      const el = document.getElementById('rte_' + domKey);
      val = el ? el.innerHTML : '';
      if (stripHtml(val).trim() === '') val = '';     // RTE rỗng vẫn còn <br>
    } else {
      const el = document.getElementById('f_' + domKey);
      val = el ? el.value : '';
    }
    en[f.key] = typeof val === 'string' ? val.trim() : val;
  }
  return en;
}

async function saveI18nModal() {
  if (!i18nModal) return;
  const { kind, key, id, fields } = i18nModal;
  const btn = document.getElementById('modalSaveBtn');
  btn.disabled = true;
  try {
    const en = await readI18nInputs(fields);
    /* Giữ nguyên những khoá ngôn ngữ khác (sau này có thêm tiếng Trung, Nhật...)
       và những field từng dịch mà lần này không mở ra. */
    const record = kind === 'singleton' ? (DB[key] || {}) : (DB[key] || []).find(r => r.id === id) || {};
    const prev = record.i18n && typeof record.i18n === 'object' ? record.i18n : {};
    const merged = Object.assign({}, prev, { en: Object.assign({}, prev.en || {}, en) });

    /* Chỉ gửi đúng cột i18n. Gửi kèm cả DB[key] thì lọt theo id/documentId/
       createdAt... mà Strapi chối cả request ("Invalid key id"); single type
       nhận cập nhật từng phần nên các field khác giữ nguyên. */
    const ok = kind === 'singleton'
      ? await saveSingletonToApi(key, { i18n: merged })
      : await saveRecordTranslationToApi(key, id, merged);
    if (!ok) return;

    if (kind === 'singleton') DB[key] = Object.assign({}, DB[key], { i18n: merged });
    else record.i18n = merged;

    closeI18nModal();
    renderContent();
    showToast('Đã lưu bản tiếng Anh');
  } catch (err) {
    showToast('Không lưu được bản tiếng Anh', true);
  } finally {
    btn.disabled = false;
  }
}

function closeI18nModal() {
  i18nModal = null;
  document.querySelector('#modalOverlay .modal').classList.remove('wide');
  closeModal();
}
