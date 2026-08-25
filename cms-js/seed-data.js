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
    news:[],
    library_docs:[],
    library_media:[],
    members_org:[
      {id:uid(),code:'VBSF-TC-2019-001',name:'CLB Sài Gòn',orgType:'Câu lạc bộ',taxCode:'',province:'TP.HCM',address:'Quận 1, TP.HCM',repName:'Nguyễn Văn Hòa',repTitle:'Chủ nhiệm CLB',repPhone:'0901112233',repEmail:'clbsaigon@vbsf.org.vn',phone:'0901112233',password:'123456',package:'Gói Tiêu chuẩn',joinDate:'2019-03-10',expiry:'2026-12-31',status:'active'},
      {id:uid(),code:'VBSF-TC-2020-002',name:'CLB Thủ Đô',orgType:'Câu lạc bộ',taxCode:'',province:'Hà Nội',address:'Cầu Giấy, Hà Nội',repName:'Trần Thị Mai',repTitle:'Chủ nhiệm CLB',repPhone:'0912223344',repEmail:'clbthudo@vbsf.org.vn',phone:'0912223344',password:'123456',package:'Gói Tiêu chuẩn',joinDate:'2020-05-18',expiry:'2026-11-30',status:'active'},
      {id:uid(),code:'VBSF-TC-2021-003',name:'CLB Sông Hàn',orgType:'Câu lạc bộ',taxCode:'',province:'Đà Nẵng',address:'Hải Châu, Đà Nẵng',repName:'Lê Văn Đức',repTitle:'Chủ nhiệm CLB',repPhone:'0923334455',repEmail:'clbsonghan@vbsf.org.vn',phone:'0923334455',password:'123456',package:'Gói Cơ bản',joinDate:'2021-07-02',expiry:'2026-10-15',status:'active'},
      {id:uid(),code:'VBSF-TC-2022-004',name:'Meow Billiards',orgType:'Doanh nghiệp',taxCode:'0312345678',province:'Bình Dương',address:'Thủ Dầu Một, Bình Dương',repName:'Phạm Anh Tuấn',repTitle:'Giám đốc',repPhone:'0934445566',repEmail:'meowbilliards@vbsf.org.vn',phone:'0934445566',password:'123456',package:'Gói Nâng cao',joinDate:'2022-01-20',expiry:'',status:'pending'},
      {id:uid(),code:'VBSF-TC-2023-005',name:'CLB Cảng',orgType:'Câu lạc bộ',taxCode:'',province:'Hải Phòng',address:'Hồng Bàng, Hải Phòng',repName:'Đỗ Thành Long',repTitle:'Chủ nhiệm CLB',repPhone:'0945556677',repEmail:'clbcang@vbsf.org.vn',phone:'0945556677',password:'123456',package:'Gói Cơ bản',joinDate:'2023-09-12',expiry:'2025-12-31',status:'expired'}
    ],
    partners:[]
  };
}
function uid(){return 'id_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}

