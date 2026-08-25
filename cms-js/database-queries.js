/* =========================================================
   DATABASE QUERIES
   Trước đây "Giải đấu" và "Hội viên" được mô phỏng qua fetchFromDatabase()
   (dữ liệu demo cứng trong DB_TABLES) — nay cả hai đã nối thẳng vào Strapi
   (xem strapi-data.js), nên DB_TABLES để trống. Giữ lại loadDB()'s hook vào
   fetchFromDatabase() phòng khi có collection khác cần mô phỏng tương tự.
   ========================================================= */
const DB_LATENCY_MS = 500;
const DB_TABLES = {};
/** Mô phỏng một truy vấn CSDL (SELECT * FROM <table>) qua mạng. */
function fetchFromDatabase(table){
  return new Promise(resolve=>{
    setTimeout(()=>{
      resolve((DB_TABLES[table]||[]).map(row=>({...row, id:uid()})));
    }, DB_LATENCY_MS);
  });
}
