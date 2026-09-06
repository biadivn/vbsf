/* =========================================================
   SEED DATA (matches current prototype website content)
   ========================================================= */
function seedData(){
  return {
    settings:{
      orgName:'Liên đoàn Billiards & Snooker Việt Nam', orgShort:'VBSF',
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

