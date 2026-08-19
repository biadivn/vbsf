/* =========================================================
   SCHEMA DEFINITIONS
   ========================================================= */
const VN_PROVINCES = ['Hà Nội','TP.HCM','Đà Nẵng','Hải Phòng','Cần Thơ','An Giang','Bà Rịa - Vũng Tàu','Bạc Liêu','Bắc Giang','Bắc Kạn','Bắc Ninh','Bến Tre','Bình Định','Bình Dương','Bình Phước','Bình Thuận','Cà Mau','Cao Bằng','Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai','Đồng Tháp','Gia Lai','Hà Giang','Hà Nam','Hà Tĩnh','Hải Dương','Hậu Giang','Hòa Bình','Hưng Yên','Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu','Lâm Đồng','Lạng Sơn','Lào Cai','Long An','Nam Định','Nghệ An','Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình','Quảng Nam','Quảng Ngãi','Quảng Ninh','Quảng Trị','Sóc Trăng','Sơn La','Tây Ninh','Thái Bình','Thái Nguyên','Thanh Hóa','Thừa Thiên Huế','Tiền Giang','Trà Vinh','Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái'];

const COLLECTIONS = {
  news: {
    label:'Tin tức', icon:'ti-news', single:'bài viết',
    fields:[
      {key:'image', label:'Ảnh banner', type:'image', span2:true},
      {key:'title', label:'Tiêu đề', type:'text', required:true, span2:true},
      {key:'category', label:'Chuyên mục', type:'select', options:['Hoạt động VBSF','Giải đấu','Đào tạo','Trong nước','Quốc tế']},
      {key:'date', label:'Ngày đăng', type:'date'},
      {key:'author', label:'Tác giả', type:'text', placeholder:'Ban Truyền thông VBSF'},
      {key:'featured', label:'Hiển thị ở mục "Tin nổi bật" (trang chủ)', type:'checkbox'},
      {key:'excerpt', label:'Tóm tắt', type:'textarea', span2:true},
      {key:'content', label:'Nội dung chi tiết', type:'richtext', span2:true},
      {key:'metaTitle', label:'SEO — Meta title', type:'text', span2:true, placeholder:'Để trống sẽ dùng Tiêu đề'},
      {key:'metaDescription', label:'SEO — Meta description', type:'textarea', span2:true, rows:2, placeholder:'Để trống sẽ dùng Tóm tắt'}
    ],
    columns:[
      {key:'image', label:'', render:r=> r.image ? `<img src="${r.image}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;display:block">` : `<div style="width:36px;height:36px;border-radius:6px;background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--hint)"><i class="ti ti-photo"></i></div>`},
      {key:'title', label:'Tiêu đề', render:r=>`${r.title||'(chưa có tiêu đề)'}${r.featured?' <i class="ti ti-star-filled featured-flag" title="Tin nổi bật"></i>':''}`},
      {key:'category', label:'Chuyên mục', badge:true},
      {key:'date', label:'Ngày đăng', muted:true}
    ]
  },
  tournaments: {
    label:'Giải đấu', icon:'ti-trophy', single:'giải đấu', viewDetail:true, noSync:true,
    fields:[
      {key:'name', label:'Tên giải đấu', type:'text', required:true, span2:true},
      {key:'category', label:'Nội dung thi đấu', type:'select', options:['Pool 8 bi','Pool 9 bi','Pool 10 bi','Carom 1 băng','Carom 3 băng','Snooker']},
      {key:'status', label:'Trạng thái', type:'select', options:['upcoming','ongoing','completed'], optionLabels:{upcoming:'Sắp diễn ra',ongoing:'Đang diễn ra',completed:'Đã kết thúc'}},
      {key:'date', label:'Ngày thi đấu', type:'date'},
      {key:'participants', label:'Số cơ thủ', type:'number'},
      {key:'location', label:'Địa điểm', type:'text', span2:true},
      {key:'note', label:'Trạng thái đăng ký', type:'text', placeholder:'VD: Mở đăng ký / Sắp mở'},
      {key:'regDeadline', label:'Hạn đăng ký', type:'date'},
      {key:'liveRound', label:'Vòng đấu hiện tại (khi đang diễn ra)', type:'text', placeholder:'VD: Vòng tứ kết'},
      {key:'champion', label:'Nhà vô địch (nếu đã kết thúc)', type:'text'},
      {key:'entryFee', label:'Lệ phí tham gia', type:'text', placeholder:'VD: 200.000đ / cơ thủ'},
      {key:'rules', label:'Thể lệ & luật thi đấu', type:'textarea', span2:true, rows:6, placeholder:'Mỗi dòng là một điều luật...'},
      {key:'metaTitle', label:'SEO — Meta title', type:'text', span2:true, placeholder:'Để trống sẽ dùng Tên giải đấu'},
      {key:'metaDescription', label:'SEO — Meta description', type:'textarea', span2:true, rows:2}
    ],
    columns:[
      {key:'name', label:'Tên giải'},
      {key:'category', label:'Nội dung', badge:true},
      {key:'date', label:'Ngày', muted:true},
      {key:'status', label:'Trạng thái', status:true, statusMap:{upcoming:{t:'Sắp diễn ra',c:'blue'},ongoing:{t:'Đang diễn ra',c:'red'},completed:{t:'Đã kết thúc',c:'gray'}}}
    ]
  },
  library_docs: {
    label:'Văn bản & Luật', icon:'ti-file-text', single:'tài liệu',
    fields:[
      {key:'title', label:'Tên tài liệu', type:'text', required:true, span2:true},
      {key:'fileType', label:'Định dạng', type:'select', options:['PDF','DOCX','XLSX']},
      {key:'tag', label:'Phân loại', type:'select', options:['Quy chế','Luật','Biểu mẫu','Thông báo']},
      {key:'size', label:'Dung lượng', type:'text', placeholder:'VD: 1,2 MB'},
      {key:'date', label:'Ngày ban hành', type:'date'}
    ],
    columns:[
      {key:'title', label:'Tên tài liệu'},
      {key:'fileType', label:'Định dạng', muted:true},
      {key:'tag', label:'Phân loại', badge:true},
      {key:'date', label:'Ngày', muted:true}
    ]
  },
  library_media: {
    label:'Thư viện Media', icon:'ti-photo', single:'album',
    fields:[
      {key:'title', label:'Tên album', type:'text', required:true, span2:true},
      {key:'mediaType', label:'Loại', type:'select', options:['photo','video'], optionLabels:{photo:'Hình ảnh',video:'Video'}},
      {key:'count', label:'Số lượng ảnh/video', type:'number'},
      {key:'date', label:'Ngày đăng', type:'date'}
    ],
    columns:[
      {key:'title', label:'Tên album'},
      {key:'mediaType', label:'Loại', badge:true, mapLabels:{photo:'Hình ảnh',video:'Video'}},
      {key:'count', label:'Số lượng', muted:true},
      {key:'date', label:'Ngày', muted:true}
    ]
  },
  members: {
    label:'Hội viên & Xếp hạng', icon:'ti-users', single:'hội viên', filterField:'category',
    fields:[
      {key:'code', label:'Mã hội viên', type:'text', placeholder:'VBSF-2026-XXXXX', span2:true, disabled:true},
      {key:'name', label:'Họ và tên', type:'text', required:true},
      {key:'cccd', label:'Số CCCD', type:'text', required:true, placeholder:'079095001234', span2:true},
      {key:'phone', label:'Số điện thoại (đăng nhập)', type:'text', required:true, placeholder:'09xx xxx xxx'},
      {key:'password', label:'Mật khẩu', type:'password', placeholder:'Để trống nếu không đổi'},
      {key:'category', label:'Nội dung thi đấu', type:'select', options:['Pool 8 bi','Pool 9 bi','Pool 10 bi','Carom 1 băng','Carom 3 băng','Snooker','English Billiards']},
      {key:'group', label:'Nhóm xếp hạng', type:'select', options:['Nam','Nữ','VĐV trẻ']},
      {key:'club', label:'Câu lạc bộ / Đơn vị', type:'text'},
      {key:'province', label:'Tỉnh / Thành', type:'select', options:VN_PROVINCES},
      {key:'status', label:'Trạng thái', type:'select', options:['active','pending','expired'], optionLabels:{active:'Đang hiệu lực',pending:'Chờ thanh toán',expired:'Hết hạn'}},
      {key:'expiry', label:'Ngày hết hạn', type:'date'},
      {key:'rank', label:'Hạng xếp hạng', type:'number'},
      {key:'points', label:'Điểm', type:'number'},
      {key:'matches', label:'Số trận', type:'number'},
      {key:'trend', label:'Xu hướng', type:'select', options:['up','down','eq'], optionLabels:{up:'Tăng hạng',down:'Giảm hạng',eq:'Giữ nguyên'}},
      {key:'trendValue', label:'Số bậc thay đổi', type:'number'}
    ],
    columns:[
      {key:'name', label:'Hội viên'},
      {key:'code', label:'Mã HV', muted:true},
      {key:'cccd', label:'CCCD', muted:true},
      {key:'category', label:'Nội dung', badge:true},
      {key:'group', label:'Nhóm', render:r=>r.group?`<span class="badge">${escapeHtml(r.group)}</span>`:'<span class="cell-muted">—</span>'},
      {key:'rank', label:'Hạng', render:r=>`<b>${r.rank ?? '—'}</b>`},
      {key:'points', label:'Điểm', render:r=>`<b>${r.points ?? '—'}</b>`},
      {key:'expiry', label:'Hết hạn', muted:true},
      {key:'status', label:'Trạng thái', status:true, statusMap:{active:{t:'Đang hiệu lực',c:'green'},pending:{t:'Chờ thanh toán',c:'gold'},expired:{t:'Hết hạn',c:'gray'}}}
    ]
  },
  members_org: {
    label:'Hội viên tổ chức', icon:'ti-building', single:'hội viên tổ chức', filterField:'orgType',
    fields:[
      {key:'code', label:'Mã hội viên tổ chức', type:'text', placeholder:'VBSF-TC-2026-XXX', span2:true, disabled:true},
      {key:'name', label:'Tên tổ chức / CLB', type:'text', required:true, span2:true},
      {key:'orgType', label:'Loại hình', type:'select', options:['Câu lạc bộ','Doanh nghiệp','Trường học','Tổ chức khác']},
      {key:'taxCode', label:'Mã số thuế', type:'text'},
      {key:'province', label:'Tỉnh / Thành', type:'select', options:VN_PROVINCES},
      {key:'address', label:'Địa chỉ', type:'text', span2:true},
      {key:'repName', label:'Người đại diện', type:'text'},
      {key:'repTitle', label:'Chức vụ', type:'text', placeholder:'VD: Chủ nhiệm CLB'},
      {key:'repPhone', label:'SĐT người đại diện', type:'text'},
      {key:'repEmail', label:'Email liên hệ', type:'text'},
      {key:'phone', label:'Số điện thoại (đăng nhập)', type:'text', required:true, placeholder:'09xx xxx xxx'},
      {key:'password', label:'Mật khẩu', type:'password', placeholder:'Để trống nếu không đổi'},
      {key:'package', label:'Gói hội viên', type:'select', options:['Gói Cơ bản','Gói Tiêu chuẩn','Gói Nâng cao']},
      {key:'joinDate', label:'Ngày gia nhập', type:'date'},
      {key:'expiry', label:'Ngày hết hạn', type:'date'},
      {key:'status', label:'Trạng thái', type:'select', options:['active','pending','expired'], optionLabels:{active:'Đang hiệu lực',pending:'Chờ thanh toán',expired:'Hết hạn'}}
    ],
    columns:[
      {key:'name', label:'Tổ chức'},
      {key:'code', label:'Mã HV', muted:true},
      {key:'orgType', label:'Loại hình', badge:true},
      {key:'province', label:'Tỉnh / Thành', muted:true},
      {key:'repName', label:'Người đại diện', muted:true},
      {key:'status', label:'Trạng thái', status:true, statusMap:{active:{t:'Đang hiệu lực',c:'green'},pending:{t:'Chờ thanh toán',c:'gold'},expired:{t:'Hết hạn',c:'gray'}}}
    ]
  },
  partners: {
    label:'Đối tác & Tài trợ', icon:'ti-building', single:'đối tác',
    fields:[
      {key:'image', label:'Hình minh họa', type:'image', span2:true},
      {key:'name', label:'Tên đối tác', type:'text', required:true, span2:true},
      {key:'tier', label:'Hạng mục', type:'select', options:['Đối tác chiến lược','Nhà tài trợ Kim cương','Nhà tài trợ Vàng','Đối tác đồng hành'], span2:true},
      {key:'description', label:'Mô tả ngắn', type:'richtext', span2:true}
    ],
    columns:[
      {key:'image', label:'', render:r=> r.image ? `<img src="${r.image}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;display:block">` : `<div style="width:36px;height:36px;border-radius:6px;background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--hint)"><i class="ti ti-building"></i></div>`},
      {key:'name', label:'Tên đối tác'},
      {key:'tier', label:'Hạng mục', badge:true},
      {key:'description', label:'Mô tả', render:r=>{ const t = stripHtml(r.description||''); return `<span class="cell-muted">${escapeHtml(t.slice(0,60))}${t.length>60?'…':''}</span>`; }}
    ]
  }
};

