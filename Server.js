// server.js
const express = require("express");
const sql = require("mssql");
const cors = require("cors");
const bodyParser = require("body-parser");
const {connectDB, dbConfig} = require("./Config/dbconfig")
const app = express();
require("dotenv").config();
app.use(bodyParser.json());
app.use(express.json());




// ✅ Login API
app.post("/adminlogin", async (req, res) => {
  const { Mail_ID, Password_ } = req.body;

  if (!Mail_ID || !Password_) {
    return res.status(400).json({ message: "Missing Email or Password" });
  }

  try {
    // Connect to database
    const pool = await sql.connect(dbConfig);

    // Debug: Check what we're searching for
    console.log("🔍 Searching for - Mail_ID:", Mail_ID, "Password_:", Password_);

    // Check credentials
    const result = await sql.query`
      SELECT * FROM adminlogin WHERE Mail_ID = ${Mail_ID} AND Password_ = ${Password_}
    `;

    console.log("📊 Query result:", result.recordset);
    console.log("📊 Records found:", result.recordset?.length || 0);

    // Also check what records exist in the table
    const allRecords = await sql.query`SELECT Mail_ID, Password_ FROM adminlogin`;
    console.log("📋 All admins in DB:", allRecords.recordset);

    if (result.recordset && result.recordset.length > 0) {
      res.json({ success: true, message: "Login Successful" });
    } else {
      res.status(401).json({ success: false, message: "Invalid Email or Password" });
    }

  } catch (err) {
    console.error("❌ Database Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});


app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
}));


//forget
const forgotRoutes = require("./routes/Forget");
app.use("/api", forgotRoutes);

const priceRoute = require("./routes/price");
app.use("/api", priceRoute);

const loginRoute = require("./routes/login");
app.use("/api", loginRoute);

const otpRoute = require("./routes/otp"); 
app.use("/api", otpRoute); 

const bookingRouter = require("./routes/booking");
app.use("/api", bookingRouter);

const paymentRoutes = require("./routes/payment");
app.use("/api/payment", paymentRoutes);

const slotRoutes = require("./routes/slot");
app.use("/api", slotRoutes);

const adminRoutes = require("./routes/adminRoutes");
app.use("/api", adminRoutes);

const adminSlotRoutes = require("./routes/adminSlotRoutes");
app.use("/api", adminSlotRoutes);

const adminSlots = require("./routes/adminSlots");
app.use("/api/admin", adminSlots);



// ✅ Start the server
const PORT = 5000;
app.listen(PORT, async () => {console.log(`Server running on port ${PORT}`);
    connectDB();
  });
