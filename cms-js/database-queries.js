/* =========================================================
   DATABASE QUERIES
   Giải đấu và Hội viên không được nhập tay trong seedData —
   hai danh mục này được truy vấn từ CSDL qua fetchFromDatabase().
   ========================================================= */
const DB_LATENCY_MS = 500;
const DB_TABLES = {
  tournaments:[
    {name:'Giải Vô địch Quốc gia Pool 2026',category:'Pool 9 bi',status:'ongoing',date:'2026-06-12',location:'Nhà thi đấu Phú Thọ, TP.HCM',participants:128,note:'Vòng tứ kết',champion:''},
    {name:'Cúp Carom 3 băng Hà Nội Mở rộng',category:'Carom 3 băng',status:'upcoming',date:'2026-06-28',location:'CLB Meow Billiards, Hà Nội',participants:64,note:'Mở đăng ký',champion:''},
    {name:'Giải Snooker Toàn quốc 2026',category:'Snooker',status:'upcoming',date:'2026-07-15',location:'Cung Thể thao Đà Nẵng',participants:48,note:'Mở đăng ký',champion:''},
    {name:'Giải các CLB mạnh toàn quốc',category:'Pool 10 bi',status:'upcoming',date:'2026-08-02',location:'TP. Thủ Dầu Một, Bình Dương',participants:'',note:'Sắp mở',champion:''},
    {name:'Giải Carom 3 băng Cúp Mùa Xuân 2026',category:'Carom 3 băng',status:'completed',date:'2026-04-18',location:'',participants:'',note:'',champion:'Trần Quốc Bảo'},
    {name:'Giải Pool 9 bi các tỉnh phía Bắc 2026',category:'Pool 9 bi',status:'completed',date:'2026-03-30',location:'',participants:'',note:'',champion:'Nguyễn Phúc Long'},
    {name:'Giải Snooker Cúp CLB toàn quốc 2025',category:'Snooker',status:'completed',date:'2025-12-12',location:'',participants:'',note:'',champion:'Lê Minh Khôi'}
  ],
  members:[
    {rank:1,name:'Nguyễn Phúc Long',code:'VBSF-2026-00098',phone:'0901234567',password:'123456',club:'CLB Sài Gòn',province:'TP.HCM',category:'Pool 9 bi',status:'active',points:2485,matches:45,trend:'up',trendValue:1},
    {rank:2,name:'Trần Quốc Bảo',code:'VBSF-2026-00071',phone:'0912345678',password:'123456',club:'CLB Thủ Đô',province:'Hà Nội',category:'Pool 9 bi',status:'active',points:2410,matches:44,trend:'down',trendValue:1},
    {rank:3,name:'Lê Minh Khôi',code:'VBSF-2026-00112',phone:'0923456789',password:'123456',club:'CLB Sông Hàn',province:'Đà Nẵng',category:'Pool 9 bi',status:'active',points:2388,matches:43,trend:'eq',trendValue:0},
    {rank:4,name:'Phạm Anh Tú',code:'VBSF-2026-00123',phone:'0934567890',password:'123456',club:'Meow Billiards',province:'Bình Dương',category:'Pool 9 bi',status:'pending',points:2301,matches:42,trend:'up',trendValue:2},
    {rank:5,name:'Đỗ Thành Nam',code:'VBSF-2025-00410',phone:'0945678901',password:'123456',club:'CLB Cảng',province:'Hải Phòng',category:'Pool 9 bi',status:'expired',points:2256,matches:38,trend:'down',trendValue:1},
    {rank:6,name:'Vũ Hoàng Sơn',code:'VBSF-2026-00201',phone:'0956789012',password:'123456',club:'',province:'Hà Nội',category:'Pool 9 bi',status:'active',points:2198,matches:40,trend:'up',trendValue:1},
    {rank:7,name:'Ngô Gia Huy',code:'VBSF-2026-00202',phone:'0967890123',password:'123456',club:'',province:'Cần Thơ',category:'Pool 9 bi',status:'active',points:2154,matches:35,trend:'eq',trendValue:0},
    {rank:8,name:'Bùi Đức Anh',code:'VBSF-2026-00203',phone:'0978901234',password:'123456',club:'',province:'TP.HCM',category:'Pool 9 bi',status:'active',points:2097,matches:33,trend:'up',trendValue:3},
    {rank:9,name:'Lý Trường Giang',code:'VBSF-2026-00204',phone:'0989012345',password:'123456',club:'',province:'Đà Nẵng',category:'Pool 9 bi',status:'active',points:2041,matches:31,trend:'down',trendValue:2},
    {rank:10,name:'Hoàng Minh Quân',code:'VBSF-2026-00205',phone:'0990123456',password:'123456',club:'',province:'Nghệ An',category:'Pool 9 bi',status:'active',points:1988,matches:29,trend:'up',trendValue:1},
    {rank:11,name:'Đặng Văn Hậu',code:'VBSF-2026-00206',phone:'0901987654',password:'123456',club:'',province:'Bình Định',category:'Pool 9 bi',status:'active',points:1945,matches:28,trend:'eq',trendValue:0},
    {rank:12,name:'Trịnh Bá Phước',code:'VBSF-2026-00207',phone:'0912987654',password:'123456',club:'',province:'Hà Nội',category:'Pool 9 bi',status:'active',points:1902,matches:27,trend:'down',trendValue:1}
  ]
};
/** Mô phỏng một truy vấn CSDL (SELECT * FROM <table>) qua mạng. */
function fetchFromDatabase(table){
  return new Promise(resolve=>{
    setTimeout(()=>{
      resolve(DB_TABLES[table].map(row=>({...row, id:uid()})));
    }, DB_LATENCY_MS);
  });
}

