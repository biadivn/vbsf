/* =========================================================
   SEED DATA (matches current prototype website content)
   ========================================================= */
function seedData(){
  return {
    settings:{
      orgName:'Liên đoàn Billiards & Snooker Việt Nam', orgShort:'VBSF',
      foundedYear:'200x', memberCount:'1.500+', clubCount:'120+', provinceCount:'30+',
      about:'Liên đoàn Billiards & Snooker Việt Nam (VBSF) là tổ chức xã hội – nghề nghiệp đại diện cho phong trào billiards & snooker trên cả nước. Liên đoàn giữ vai trò quản lý chuyên môn, tổ chức hệ thống thi đấu quốc gia, phát triển vận động viên và kết nối với các tổ chức billiards quốc tế.',
      heroTitle:'Giải Vô địch Billiards & Snooker Quốc gia 2026',
      heroSubtitle:'Khởi tranh 12/06 · Nhà thi đấu Phú Thọ, TP.HCM',
      feeFirstTime:'200.000đ', feeAnnualFull:'500.000đ', feeAnnualHalf:'250.000đ', feeRenewal:'500.000đ',
      bankName:'Vietcombank', bankAccount:'00xx xxx xxx', bankHolder:'LĐ Billiards & Snooker VN'
    },
    contact:{
      address:'Số ..., Quận ..., Hà Nội, Việt Nam', email:'info@billiards.org.vn', phone:'024 xxxx xxxx',
      hours:'Thứ 2 – Thứ 6 · 08:00 – 17:00', facebook:'', youtube:'', tiktok:''
    },
    news:[
      {id:uid(),title:'VBSF công bố hệ thống thi đấu quốc gia năm 2026',category:'Hoạt động VBSF',date:'2026-06-02',author:'Ban Truyền thông VBSF',featured:false,excerpt:'VBSF chính thức công bố hệ thống thi đấu quốc gia năm 2026 với cấu trúc ba cấp độ.',content:'Liên đoàn Billiards & Snooker Việt Nam (VBSF) vừa chính thức công bố hệ thống thi đấu quốc gia năm 2026, với cấu trúc giải đấu xuyên suốt và cơ chế tích điểm xếp hạng áp dụng cho tất cả các nội dung.'},
      {id:uid(),title:'Khởi tranh vòng loại khu vực phía Nam',category:'Giải đấu',date:'2026-06-02',author:'Ban Truyền thông VBSF',featured:false,excerpt:'Hơn 120 cơ thủ tranh tài tại vòng loại khu vực.',content:''},
      {id:uid(),title:'VBSF công bố khung chuẩn trọng tài cấp quốc gia',category:'Đào tạo',date:'2026-05-28',author:'Ban Truyền thông VBSF',featured:true,excerpt:'Chương trình đào tạo và cấp chứng nhận trọng tài.',content:''},
      {id:uid(),title:'Cơ thủ Việt Nam giành vé dự giải vô địch châu Á',category:'Quốc tế',date:'2026-05-20',author:'Ban Truyền thông VBSF',featured:true,excerpt:'Thành tích ấn tượng tại vòng loại Đông Nam Á.',content:''},
      {id:uid(),title:'Giải Carom 3 băng các CLB toàn quốc khởi động',category:'Trong nước',date:'2026-05-16',author:'Ban Truyền thông VBSF',featured:false,excerpt:'Mùa giải mới quy tụ các CLB mạnh cả nước.',content:''},
      {id:uid(),title:'Ký kết hợp tác phát triển hệ thống xếp hạng',category:'Hoạt động VBSF',date:'2026-05-10',author:'Ban Truyền thông VBSF',featured:false,excerpt:'Hướng tới chuẩn hóa dữ liệu và minh bạch xếp hạng.',content:''},
      {id:uid(),title:'Lịch thi đấu hệ thống quốc gia quý III/2026',category:'Giải đấu',date:'2026-05-15',author:'Ban Truyền thông VBSF',featured:true,excerpt:'',content:''},
      {id:uid(),title:'Tổng kết mùa giải Pool 2025',category:'Giải đấu',date:'2026-04-28',author:'Ban Truyền thông VBSF',featured:false,excerpt:'Nhìn lại những dấu ấn của mùa giải vừa qua.',content:''}
    ],
    library_docs:[
      {id:uid(),title:'Quy chế hệ thống thi đấu quốc gia 2026',fileType:'PDF',tag:'Quy chế',size:'1,2 MB',date:'2026-05-12'},
      {id:uid(),title:'Luật thi đấu Pool (8 / 9 / 10 bi)',fileType:'PDF',tag:'Luật',size:'2,4 MB',date:'2026-03-01'},
      {id:uid(),title:'Luật thi đấu Carom (1 băng & 3 băng)',fileType:'PDF',tag:'Luật',size:'1,8 MB',date:'2026-03-01'},
      {id:uid(),title:'Luật thi đấu Snooker',fileType:'PDF',tag:'Luật',size:'2,1 MB',date:'2026-03-01'},
      {id:uid(),title:'Đơn đăng ký hội viên (biểu mẫu)',fileType:'DOCX',tag:'Biểu mẫu',size:'240 KB',date:'2026-01-10'},
      {id:uid(),title:'Thông báo lịch thi đấu quý III/2026',fileType:'PDF',tag:'Thông báo',size:'560 KB',date:'2026-05-20'}
    ],
    library_media:[
      {id:uid(),title:'Giải VĐQG Pool 2025',mediaType:'photo',count:48,date:'2025-12-20'},
      {id:uid(),title:'Lễ ký kết hợp tác',mediaType:'photo',count:12,date:'2026-05-10'},
      {id:uid(),title:'Chung kết Carom 3 băng 2025',mediaType:'video',count:1,date:'2025-12-12'},
      {id:uid(),title:'Hướng dẫn luật Snooker',mediaType:'video',count:1,date:'2026-03-05'}
    ],
    members_org:[
      {id:uid(),code:'VBSF-TC-2019-001',name:'CLB Sài Gòn',orgType:'Câu lạc bộ',taxCode:'',province:'TP.HCM',address:'Quận 1, TP.HCM',repName:'Nguyễn Văn Hòa',repTitle:'Chủ nhiệm CLB',repPhone:'0901112233',repEmail:'clbsaigon@vbsf.org.vn',phone:'0901112233',password:'123456',package:'Gói Tiêu chuẩn',joinDate:'2019-03-10',expiry:'2026-12-31',status:'active'},
      {id:uid(),code:'VBSF-TC-2020-002',name:'CLB Thủ Đô',orgType:'Câu lạc bộ',taxCode:'',province:'Hà Nội',address:'Cầu Giấy, Hà Nội',repName:'Trần Thị Mai',repTitle:'Chủ nhiệm CLB',repPhone:'0912223344',repEmail:'clbthudo@vbsf.org.vn',phone:'0912223344',password:'123456',package:'Gói Tiêu chuẩn',joinDate:'2020-05-18',expiry:'2026-11-30',status:'active'},
      {id:uid(),code:'VBSF-TC-2021-003',name:'CLB Sông Hàn',orgType:'Câu lạc bộ',taxCode:'',province:'Đà Nẵng',address:'Hải Châu, Đà Nẵng',repName:'Lê Văn Đức',repTitle:'Chủ nhiệm CLB',repPhone:'0923334455',repEmail:'clbsonghan@vbsf.org.vn',phone:'0923334455',password:'123456',package:'Gói Cơ bản',joinDate:'2021-07-02',expiry:'2026-10-15',status:'active'},
      {id:uid(),code:'VBSF-TC-2022-004',name:'Meow Billiards',orgType:'Doanh nghiệp',taxCode:'0312345678',province:'Bình Dương',address:'Thủ Dầu Một, Bình Dương',repName:'Phạm Anh Tuấn',repTitle:'Giám đốc',repPhone:'0934445566',repEmail:'meowbilliards@vbsf.org.vn',phone:'0934445566',password:'123456',package:'Gói Nâng cao',joinDate:'2022-01-20',expiry:'',status:'pending'},
      {id:uid(),code:'VBSF-TC-2023-005',name:'CLB Cảng',orgType:'Câu lạc bộ',taxCode:'',province:'Hải Phòng',address:'Hồng Bàng, Hải Phòng',repName:'Đỗ Thành Long',repTitle:'Chủ nhiệm CLB',repPhone:'0945556677',repEmail:'clbcang@vbsf.org.vn',phone:'0945556677',password:'123456',package:'Gói Cơ bản',joinDate:'2023-09-12',expiry:'2025-12-31',status:'expired'}
    ],
    partners:[
      {id:uid(),name:'Tên đối tác',tier:'Đối tác chiến lược',description:'Đối tác công nghệ & hệ thống xếp hạng'},
      {id:uid(),name:'Tên đối tác',tier:'Đối tác chiến lược',description:'Đối tác hệ thống câu lạc bộ'},
      {id:uid(),name:'Nhà tài trợ Kim cương 1',tier:'Nhà tài trợ Kim cương',description:''},
      {id:uid(),name:'Nhà tài trợ Kim cương 2',tier:'Nhà tài trợ Kim cương',description:''},
      {id:uid(),name:'Nhà tài trợ Vàng 1',tier:'Nhà tài trợ Vàng',description:''},
      {id:uid(),name:'Nhà tài trợ Vàng 2',tier:'Nhà tài trợ Vàng',description:''},
      {id:uid(),name:'Đối tác đồng hành 1',tier:'Đối tác đồng hành',description:''},
      {id:uid(),name:'Đối tác đồng hành 2',tier:'Đối tác đồng hành',description:''}
    ]
  };
}
function uid(){return 'id_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}

