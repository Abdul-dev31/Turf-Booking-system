const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { dbConfig } = require("../Config/dbconfig");
const crypto = require("crypto");

function generateSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

const otpStore = {};

// 1️⃣ SEND OTP
router.post("/send-otp", async (req, res) => {
  const { mobile } = req.body;

  console.log('[OTP] Send OTP request for:', mobile);

  if (!mobile || mobile.length !== 10) {
    return res.status(400).json({ success: false, message:  "Invalid mobile number" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  otpStore[mobile] = {
    otp,
    expires: Date.now() + 5 * 60 * 1000
  };

  console.log('[OTP] Generated OTP:', otp, 'for', mobile);

  res.json({
    success: true,
    message:  "OTP sent successfully",
    otp
  });
});

// 2️⃣ RESEND OTP
router.post("/resend-otp", async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return res.status(400).json({ success: false, message: "Mobile number required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  otpStore[mobile] = {
    otp,
    expires: Date.now() + 5 * 60 * 1000
  };

  console.log('[OTP] Resent OTP:', otp, 'for', mobile);

  res.json({ 
    success: true, 
    message: "OTP resent successfully",
    otp
  });
});

// 3️⃣ VERIFY OTP & CREATE SESSION - WORKS WITH TRIGGER
router. post("/verify-otp", async (req, res) => {
  const { mobile, otp } = req.body;

  console.log('[OTP] Verify request:', { mobile, otp });

  if (!mobile || !otp) {
    return res.status(400).json({ success: false, message: "Mobile and OTP required" });
  }

  const storedOtp = otpStore[mobile];

  if (!storedOtp) {
    return res.status(400).json({ success: false, message:  "OTP not found or expired" });
  }

  if (Date.now() > storedOtp.expires) {
    delete otpStore[mobile];
    return res.status(400).json({ success: false, message: "OTP expired" });
  }

  if (storedOtp.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  delete otpStore[mobile];

  let pool;

  try {
    pool = await sql.connect(dbConfig);

    // 1. Check if user exists
    let userResult = await pool.request()
      .input('mobile', sql.VarChar(10), mobile)
      .query('SELECT User_ID FROM Usertable WHERE Mobile_Number = @mobile');

    let userId;

    if (userResult. recordset.length > 0) {
      userId = userResult. recordset[0].User_ID;
      console.log('[OTP] ✅ Existing user:', userId);
    } else {
      await pool.request()
        .input('mobile', sql.VarChar(10), mobile)
        .input('name', sql.VarChar(50), mobile)
        .query('INSERT INTO Usertable (Mobile_Number, Name) VALUES (@mobile, @name)');

      userResult = await pool.request()
        .input('mobile', sql.VarChar(10), mobile)
        .query('SELECT User_ID FROM Usertable WHERE Mobile_Number = @mobile');

      userId = userResult.recordset[0].User_ID;
      console.log('[OTP] ✅ New user created:', userId);
    }

    // 2. Delete old sessions for this user
    await pool.request()
      .input('userId', sql.VarChar(20), userId)
      .query('DELETE FROM Session WHERE User_id = @userId');

    console.log('[OTP] Old sessions deleted for user:', userId);

    // 3. Create session - trigger will generate the actual session_id
    const dummySessionId = generateSessionId();
    const expiresDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log('[OTP] Inserting session (trigger will generate SESxxx ID)...');

    await pool.request()
      .input('sessionId', sql.NVarChar(255), dummySessionId)
      .input('userId', sql.VarChar(20), userId)
      .input('data', sql.NVarChar(sql.MAX), JSON.stringify({ mobile }))
      .input('expires', sql.DateTime, expiresDate)
      .query(`
        INSERT INTO Session (session_id, User_id, data, expires)
        VALUES (@sessionId, @userId, @data, @expires)
      `);

    console.log('[OTP] ✅ Session inserted');

    // 4. Retrieve the ACTUAL session_id created by trigger
    const getSession = await pool.request()
      .input('userId', sql.VarChar(20), userId)
      .query('SELECT TOP 1 session_id, expires FROM Session WHERE User_id = @userId ORDER BY expires DESC');

    if (getSession.recordset.length === 0) {
      throw new Error('Session not found after insert');
    }

    const actualSessionId = getSession. recordset[0].session_id;
    console.log('[OTP] ✅ Actual session_id from trigger:', actualSessionId);

    // 5. Return the ACTUAL session_id (SES012)
    res.json({
      success: true,
      message: "Login successful",
      sessionId: actualSessionId,  // ✅ SES012
      userId: userId,
      mobile: mobile
    });

  } catch (err) {
    console.error('❌ Error in OTP verification:', err.message);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
  }
});

// 4️⃣ CHECK SESSION
router.get("/session-user", async (req, res) => {
  const sessionId = req.headers["x-session-id"];

  console.log('[Session] Check request for:', sessionId);

  if (!sessionId) {
    console.log('[Session] ❌ No session ID provided');
    return res.json({ loggedIn: false });
  }

  let pool;

  try {
    pool = await sql.connect(dbConfig);

    const result = await pool.request()
      .input('sessionId', sql. NVarChar(255), sessionId)
      .query(`
        SELECT S.User_id, S.expires, U.Mobile_Number, U.Name
        FROM Session S
        JOIN Usertable U ON S.User_id = U.User_ID
        WHERE S.session_id = @sessionId
      `);

    console.log('[Session] Query returned', result.recordset.length, 'results');

    if (result.recordset.length === 0) {
      console.log('[Session] ❌ Not found');
      return res.json({ loggedIn: false });
    }

    const session = result.recordset[0];
    const now = new Date();
    const expires = new Date(session.expires);

    if (now > expires) {
      await pool.request()
        .input('sessionId', sql.NVarChar(255), sessionId)
        .query('DELETE FROM Session WHERE session_id = @sessionId');

      console.log('[Session] ❌ Expired and deleted');
      return res.json({ loggedIn: false, message: "Session expired" });
    }

    console.log('[Session] ✅ Valid for user:', session.User_id);

    res.json({
      loggedIn: true,
      userId: session.User_id,
      mobile: session.Mobile_Number,
      name: session.Name
    });

  } catch (err) {
    console.error('❌ Session check error:', err.message);
    res.json({ loggedIn: false });
  }
});

// 5️⃣ LOGOUT
router.post("/logout", async (req, res) => {
  const sessionId = req.headers["x-session-id"];

  console.log('[Logout] Request for session:', sessionId);

  if (!sessionId) {
    return res.json({ success: true, message: "No session to logout" });
  }

  let pool;

  try {
    pool = await sql.connect(dbConfig);
    
    const result = await pool.request()
      .input('sessionId', sql.NVarChar(255), sessionId)
      .query('DELETE FROM Session WHERE session_id = @sessionId');

    console.log('[Logout] ✅ Rows deleted:', result.rowsAffected[0]);

    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error('❌ Logout error:', err.message);
    res.status(500).json({ success: false, message: "Logout failed" });
  }
});

// 🔍 DEBUG
router.get("/debug/sessions", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query('SELECT TOP 20 * FROM Session ORDER BY expires DESC');
    
    res.json({
      count: result.recordset.length,
      sessions: result.recordset
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;