/* =========================================================
   SEED DATA (matches current prototype website content)
   ========================================================= */
function seedData(){
  return {
    settings:{
      orgName:'Liên đoàn Billiards & Snooker Việt Nam', orgShort:'VBSF',
      foundedYear:'200x', memberCount:'1.500+', clubCount:'120+', provinceCount:'30+',
      about:'Liên đoàn Billiards & Snooker Việt Nam (VBSF) là tổ chức xã hội – nghề nghiệp đại diện cho phong trào billiards & snooker trên cả nước. Liên đoàn giữ vai trò quản lý chuyên môn, tổ chức hệ thống thi đấu quốc gia, phát triển vận động viên và kết nối với các tổ chức billiards quốc tế.',
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
    members_org:[],
    partners:[]
  };
}
function uid(){return 'id_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}

