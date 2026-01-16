// routes/forgot.js
const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../Config/dbconfig");

// 🧠 Temporary in-memory OTP store (email → otp + expiry)
let otpStore = {}; 

// ✅ 1️⃣ Send OTP
router.post("/sendotp", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("Mail_ID", sql.VarChar, email)
      .query("SELECT * FROM adminlogin WHERE Mail_ID = @Mail_ID");

    if (result.recordset.length === 0)
      return res.status(404).json({ message: "Email not found" });

    // ✅ Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    // Save in memory
    otpStore[email] = { otp, expiresAt };

    console.log(`📩 OTP for ${email}: ${otp}`); // for testing

    res.json({ message: "OTP generated successfully" });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ 2️⃣ Verify OTP (optional for /adminotp page)
router.post("/verifyotp", (req, res) => {
  const { email, otp } = req.body;

  if (!otpStore[email])
    return res.status(400).json({ message: "No OTP generated for this email" });

  const { otp: storedOtp, expiresAt } = otpStore[email];

  if (new Date() > expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ message: "OTP expired" });
  }

  if (storedOtp !== otp)
    return res.status(400).json({ message: "Invalid OTP" });

  delete otpStore[email]; // remove on success
  res.json({ message: "OTP verified successfully" });
});

// ✅ 3️⃣ Reset Password (update in adminlogin)
router.put("/resetpassword", async (req, res) => {
  const { email, password, repassword } = req.body;

  // Basic validations
  if (!email || !password || !repassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password !== repassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const pool = await poolPromise;

    // Check if email exists
    const check = await pool
      .request()
      .input("Mail_ID", sql.VarChar, email)
      .query("SELECT * FROM adminlogin WHERE Mail_ID = @Mail_ID");

    if (check.recordset.length === 0) {
      return res.status(404).json({ message: "Email not found" });
    }

    // Update password
    await pool
      .request()
      .input("Mail_ID", sql.VarChar, email)
      .input("Password_", sql.VarChar, password)
      .query("UPDATE adminlogin SET Password_ = @Password_ WHERE Mail_ID = @Mail_ID");

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});
// 🔄 1. RESEND OTP
router.post("/resendotp", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("Mail_ID", sql.VarChar, email)
      .query("SELECT * FROM adminlogin WHERE Mail_ID = @Mail_ID");

    if (result.recordset.length === 0)
      return res.status(404).json({ message: "Email not found" });

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    otpStore[email] = { otp, expiresAt };

    console.log(`🔁 RESEND OTP for ${email}: ${otp}`);

    res.json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});


router.post("/update-upi", async (req, res) => {
  const { upi } = req.body;

  if (!upi) {
    return res.status(400).json({ message: "UPI cannot be empty" });
  }

  try {
    const pool = await poolPromise;

    const query = `
      UPDATE AdminLogin
      SET UPI = @upi
      WHERE Admin_ID = 'AID001'
    `;

    const request = pool.request();
    request.input("upi", sql.VarChar, upi);

    await request.query(query);

    res.json({ message: "UPI Updated Successfully!" });

  } catch (error) {
    console.log("UPI Update Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});
// ✅ 3️⃣ Reset Password (update in adminlogin)
router.put("/resetpassword", async (req, res) => {
  const { email, password, repassword } = req.body;

  // Basic validations
  if (!email || !password || !repassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password !== repassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const pool = await poolPromise;

    // Check if email exists
    const check = await pool
      .request()
      .input("Mail_ID", sql.VarChar, email)
      .query("SELECT * FROM adminlogin WHERE Mail_ID = @Mail_ID");

    if (check.recordset.length === 0) {
      return res.status(404).json({ message: "Email not found" });
    }

    // Update password
    await pool
      .request()
      .input("Mail_ID", sql.VarChar, email)
      .input("Password_", sql.VarChar, password)
      .query("UPDATE adminlogin SET Password_ = @Password_ WHERE Mail_ID = @Mail_ID");

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/get-upi", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT TOP 1 UPI FROM adminlogin ORDER BY Admin_ID
    `);

    res.json({ upi: result.recordset[0].UPI });
  } catch (err) {
    console.error("Get UPI Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});
module.exports = router;
