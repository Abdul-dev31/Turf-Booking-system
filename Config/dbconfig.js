// config/dbconfig.js
const sql = require("mssql");

const dbConfig = {
  user: "turfUserrr",
  password: "Turf@123",
  server: "ABDUL\\SQLEXPRESS",       // ✅ only the hostname
  database: "turf_org",
  options: {
    
    encrypt: false,
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log("✅ Connected to SQL Server");
    return pool;
  })
  .catch(err => console.log("❌ Database Connection Failed:", err.message));

async function connectDB() {
  console.log("🟡 Trying to connect to SQL Server...");
  try {
    await sql.connect(dbConfig);
    console.log("✅ SQL Server connected successfully!");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
}

module.exports = { sql, poolPromise, connectDB, dbConfig };