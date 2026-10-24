/* =========================================================
   NHẬP NỘI DUNG TIẾNG ANH — CÔNG TẮC NGÔN NGỮ TRONG MÀN HÌNH CHI TIẾT

   Mỗi bản ghi có cột `i18n` dạng { en: { "<field>": "..." } }. Site phủ các
   field đó lên bản ghi khi người xem chọn English; field nào bỏ trống thì giữ
   bản tiếng Việt (xem site-js/i18n.js).

   Bản trước đặt nút dịch trên TỪNG DÒNG danh sách rồi mở một modal riêng. Nay
   công tắc Tiếng Việt / English nằm ngay trong màn hình chi tiết: bấm là màn
   hình đó chuyển sang ngôn ngữ được chọn. Nhờ vậy chỗ sửa nội dung và chỗ dịch
   nội dung là một, và chỉ còn MỘT cách làm dùng chung cho mọi module — modal
   bản ghi, trình soạn tin, trình sửa giải đấu, form Thông tin tổ chức/Liên hệ,
   thẻ Thông tin trang và panel section.

   Khi đang ở English, form chỉ hiện những field DỊCH ĐƯỢC, mỗi field kèm bản
   tiếng Việt ngay trên ô nhập để khỏi phải mở hai tab đối chiếu — và không có
   cách nào lỡ tay sửa nhầm bản gốc.
   ========================================================= */

/* Ngôn ngữ đang nhập của màn hình chi tiết đang mở. Mở màn hình nào cũng bắt
   đầu ở tiếng Việt: vào sửa nội dung là việc thường ngày, dịch là việc thỉnh
   thoảng. */
let detailLang = 'vi';

function resetDetailLang() { detailLang = 'vi'; }

/** Công tắc Tiếng Việt / English. `note` hiện thêm khi đang ở English. */
function renderDetailLangSwitch(note) {
  const hint = detailLang === 'en'
    ? `<span class="hint" style="margin:0"><i class="ti ti-info-circle"></i> ${escapeHtml(
        note || 'Ô để trống thì trang tiếng Anh dùng bản tiếng Việt.')}</span>`
    : '';
  return `<div class="detail-lang" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    <div class="langsw-cms">
      <button type="button" class="${detailLang === 'vi' ? 'on' : ''}" data-detail-lang="vi">Tiếng Việt</button>
      <button type="button" class="${detailLang === 'en' ? 'on' : ''}" data-detail-lang="en">English</button>
    </div>
    ${hint}
  </div>`;
}

/** Bấm công tắc -> đổi ngôn ngữ rồi vẽ lại màn hình bằng `rerender`. */
function attachDetailLangSwitch(rerender) {
  document.querySelectorAll('[data-detail-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-detail-lang');
      if (next === detailLang) return;
      detailLang = next;
      rerender();
    });
  });
}

/* renderField() đặt id ô nhập là `f_<key>`. Form tiếng Anh có thể nằm cùng
   trang với form tiếng Việt (vd. Thông tin tổ chức), nên nếu dùng nguyên key
   thì hai ô trùng id và document.getElementById() trả về ô kia — lưu bản dịch
   là chép nguyên giá trị tiếng Việt sang. Thêm tiền tố để tách hẳn. */
const I18N_PREFIX = 'i18nen_';

/** Bản sao field với key đã thêm tiền tố, chỉ dùng để dựng và đọc ô nhập. */
function i18nInputField(f) {
  /* Bỏ placeholder: placeholder của form tiếng Việt là chữ tiếng Việt (vd. "Ban
     Truyền thông VBSF"), hiện trong ô tiếng Anh trông như ô đã có sẵn giá trị.
     Bản tiếng Việt đã nằm ngay trên ô rồi nên cũng không cần gợi ý nữa.
     Bỏ required: thiếu bản dịch là chuyện bình thường, site tự lùi về bản gốc. */
  return Object.assign({}, f, { key: I18N_PREFIX + f.key, required: false, placeholder: '' });
}

/** Những field của một module có bản dịch. */
function i18nFieldsOf(key) {
  const c = COLLECTIONS[key];
  return c ? (c.fields || []).filter((f) => f.i18n) : [];
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
  return all.filter((f) => want.includes(f.key));
}

/* Thông tin trang: dịch tên và metadata SEO, KHÔNG dịch slug — đường dẫn là
   một, đổi theo ngôn ngữ thì link cũ gãy mà chẳng được gì. */
const I18N_PAGE_META_KEYS = ['title', 'metaTitle', 'metaDescription'];

function i18nFieldsOfPageMeta() {
  return PAGE_META_FIELDS.filter((f) => I18N_PAGE_META_KEYS.includes(f.key));
}

/** Bản tiếng Việt để hiện cạnh ô nhập — chữ thuần, cắt bớt cho vừa khung. */
function i18nSourceText(field, record) {
  const raw = record ? record[field.key] : '';
  if (field.type === 'image') return raw ? 'Đang dùng ảnh tiếng Việt' : 'Chưa có ảnh';
  if (raw == null || raw === '') return '';
  const text = field.type === 'richtext' ? stripHtml(String(raw)) : String(raw);
  return text.length > 400 ? text.slice(0, 400) + '…' : text;
}

/**
 * Thân form nhập bản tiếng Anh: mỗi dòng là "bản tiếng Việt — ô nhập".
 * `record` là bản ghi tiếng Việt (chứa cả cột i18n).
 */
function renderI18nFields(fields, record) {
  const en = (record && record.i18n && record.i18n.en) || {};
  modalImageValues = {};
  fields.forEach((f) => {
    if (f.type === 'image') modalImageValues[I18N_PREFIX + f.key] = en[f.key] || null;
  });

  return fields.map((f) => {
    const source = i18nSourceText(f, record);
    const inputField = i18nInputField(f);
    const value = en[f.key] || '';
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
}

/** Gắn sự kiện cho các ô vừa dựng (ảnh, soạn thảo). */
function attachI18nFields() {
  attachRTEEvents();
  attachModalImageEvents();
}

/** Đọc các ô bản dịch; ô ảnh mới chọn thì tải lên Strapi trước. */
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

/**
 * Lưu bản dịch đang nhập trên màn hình.
 *   kind 'collection' -> bản ghi trong DB[key]
 *   kind 'singleton'  -> settings / contact
 *   kind 'pagemeta'   -> DB.pageMeta[key]
 * Trả về true nếu lưu được.
 */
async function saveI18nValues(kind, key, id, fields) {
  const record = kind === 'collection'
    ? (DB[key] || []).find((r) => r.id === id)
    : kind === 'pagemeta' ? (DB.pageMeta && DB.pageMeta[key])
    : DB[key];
  if (!record) return false;

  const en = await readI18nInputs(fields);
  /* Giữ nguyên những khoá ngôn ngữ khác (sau này có thêm tiếng Trung, Nhật...)
     và những field từng dịch mà lần này không mở ra. */
  const prev = record.i18n && typeof record.i18n === 'object' ? record.i18n : {};
  const merged = Object.assign({}, prev, { en: Object.assign({}, prev.en || {}, en) });

  if (kind === 'pagemeta') {
    /* pageMeta nằm trong page-content (một cục JSON), lưu cả cục như mọi thay
       đổi khác của module "Trang website". */
    record.i18n = merged;
    await saveDB();
    await savePageContentToApi();
    return true;
  }

  /* Chỉ gửi đúng cột i18n. Gửi kèm cả bản ghi thì lọt theo id/documentId/
     createdAt... mà Strapi chối cả request ("Invalid key id"); cả collection
     lẫn single type đều nhận cập nhật từng phần. */
  const ok = kind === 'singleton'
    ? await saveSingletonToApi(key, { i18n: merged })
    : await saveRecordTranslationToApi(key, id, merged);
  if (!ok) return false;

  record.i18n = merged;
  return true;
}
