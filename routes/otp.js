const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");
// Optional SendGrid fallback (recommended for reliable delivery on hosted platforms)
let sendgrid = null;
if (process.env.SENDGRID_API_KEY) {
  try {
    sendgrid = require("@sendgrid/mail");
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
  } catch (err) {
    console.warn("SendGrid package not available or failed to initialize:", err.message);
    sendgrid = null;
  }
}
const { User, Session, Otp } = require("../models");
const { generateSessionId, getNextId } = require("../utils/helpers");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isMobile = (value) => /^\d{10}$/.test(String(value || "").trim());
const normalizeLoginId = (value) => String(value || "").trim().toLowerCase();

const getLoginIdFromRequest = (req) => {
  const raw = req.body.email || req.body.mobile || req.query.email || req.query.mobile;
  return normalizeLoginId(raw);
};

router.get("/session-user", async (req, res) => {
  const sessionId = req.headers["x-session-id"];

  if (!sessionId) {
    return res.json({ loggedIn: false });
  }

  try {
    const session = await Session.findOne({ session_id: sessionId }).lean();
    if (!session) {
      return res.json({ loggedIn: false });
    }

    if (new Date() > new Date(session.expires)) {
      await Session.deleteOne({ session_id: sessionId });
      return res.json({ loggedIn: false });
    }

    const user = await User.findOne({ User_ID: session.User_id }).lean();

    res.json({
      loggedIn: true,
      userId: session.User_id,
      mobile: user?.Mobile_Number,
      email: isEmail(user?.Mobile_Number) ? user.Mobile_Number : null,
      name: user?.Name,
    });
  } catch (err) {
    res.json({ loggedIn: false });
  }
});

router.post("/logout", async (req, res) => {
  const sessionId = req.headers["x-session-id"];

  if (!sessionId) {
    return res.json({ success: true });
  }

  try {
    await Session.deleteOne({ session_id: sessionId });
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

async function storeAndSendOtp(loginId, res) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await Otp.deleteMany({ Mobile_Number: loginId });
  await Otp.create({
    Mobile_Number: loginId,
    OTP: otp,
    CreatedAt: new Date(),
    ExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const sendResponse = isEmail(loginId)
    ? await sendOTPViaEmail(loginId, otp)
    : await sendOTPViaSMS(loginId, otp);

  if (!sendResponse.success) {
    return res.status(200).json({
      success: true,
      message: "OTP generated (delivery failed - check console)",
      mobile: isMobile(loginId) ? loginId : undefined,
      email: isEmail(loginId) ? loginId : undefined,
      otp,
      deliveryError: sendResponse.error,
    });
  }

  return res.json({
    success: true,
    message: "OTP sent successfully",
    mobile: isMobile(loginId) ? loginId : undefined,
    email: isEmail(loginId) ? loginId : undefined,
    otp,
  });
}

router.post("/generate-otp", async (req, res) => {
  const loginId = getLoginIdFromRequest(req);
  if (!isEmail(loginId) && !isMobile(loginId)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email ID",
    });
  }

  try {
    await storeAndSendOtp(loginId, res);
  } catch (err) {
    console.error("❌ Generate OTP Error:", err.message);
    res.status(500).json({ success: false, message: "Error generating OTP" });
  }
});

router.post("/send-otp", async (req, res) => {
  const loginId = getLoginIdFromRequest(req);
  if (!isEmail(loginId) && !isMobile(loginId)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email ID",
    });
  }

  try {
    await storeAndSendOtp(loginId, res);
  } catch (err) {
    console.error("❌ Send OTP Error:", err.message);
    res.status(500).json({ success: false, message: "Error sending OTP" });
  }
});

router.post("/resend-otp", async (req, res) => {
  const loginId = getLoginIdFromRequest(req);
  if (!isEmail(loginId) && !isMobile(loginId)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email ID",
    });
  }

  try {
    await storeAndSendOtp(loginId, res);
  } catch (err) {
    console.error("❌ Resend OTP Error:", err.message);
    res.status(500).json({ success: false, message: "Error resending OTP" });
  }
});

router.get("/get-otp", async (req, res) => {
  const loginId = getLoginIdFromRequest(req);
  if (!loginId) {
    return res.status(400).json({ error: "email required" });
  }

  try {
    const record = await Otp.findOne({
      Mobile_Number: loginId,
      ExpiresAt: { $gt: new Date() },
    })
      .sort({ CreatedAt: -1 })
      .lean();

    if (!record) {
      return res.json({ otp: null });
    }

    res.json({ otp: record.OTP });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch OTP" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const loginId = getLoginIdFromRequest(req);
  const { otp } = req.body;

  if (!loginId || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email ID and OTP are required",
    });
  }

  try {
    const record = await Otp.findOne({
      Mobile_Number: loginId,
      OTP: otp.toString(),
      ExpiresAt: { $gt: new Date() },
    }).lean();

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    await Otp.deleteMany({ Mobile_Number: loginId });

    let user = await User.findOne({ Mobile_Number: loginId });
    if (!user) {
      const User_ID = await getNextId("userId", "UID", 4);
      user = await User.create({ User_ID, Mobile_Number: loginId });
    }

    const sessionId = generateSessionId();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await Session.create({
      session_id: sessionId,
      User_id: user.User_ID,
      expires,
    });

    res.json({
      success: true,
      message: "OTP verified successfully",
      mobile: isMobile(loginId) ? loginId : undefined,
      email: isEmail(loginId) ? loginId : undefined,
      userId: user.User_ID,
      sessionId,
      session_id: sessionId,
    });
  } catch (err) {
    console.error("❌ Verify OTP Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
    });
  }
});

const sendOTPViaSMS = async (mobile, otp) => {
  try {
    const url = "https://www.fast2sms.com/dev/bulkV2";
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      console.error("❌ Fast2SMS API Key not found in .env");
      return { success: false, error: "API Key missing" };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message: `Your OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`,
        language: "english",
        flash: 0,
        numbers: mobile,
      }),
    });

    const data = await response.json();

    if (data.return === 1 || data.status === "Success") {
      return { success: true, data };
    }

    return { success: false, error: data.message || "Unknown error" };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const sendOTPViaEmail = async (email, otp) => {
  // If SendGrid is configured, use it (more reliable on hosted platforms)
  if (sendgrid) {
    try {
      const from = process.env.SENDGRID_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
      await sendgrid.send({
        to: email,
        from,
        subject: "Your Turf Booking OTP",
        text: `Your OTP is ${otp}. Valid for 10 minutes. Do not share it with anyone.`,
      });
      return { success: true };
    } catch (err) {
      console.error("SendGrid send error:", err && err.message ? err.message : err);
      // fall through to SMTP attempt as a backup
    }
  }

  // Fallback to nodemailer SMTP transport
  try {
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const rawPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const pass = rawPass ? rawPass.replace(/\s/g, "") : "";

    if (!user || !pass) {
      console.log(`📧 OTP for ${email}: ${otp}`);
      return { success: false, error: "Email SMTP not configured" };
    }

    const transporter = nodemailer.createTransport(
      process.env.SMTP_HOST
        ? {
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE || "false") === "true",
            auth: { user, pass },
          }
        : {
            service: process.env.SMTP_SERVICE || "gmail",
            auth: { user, pass },
          }
    );

    console.log("Verifying SMTP...");
    await transporter.verify();
    console.log("SMTP Verified");

    await transporter.sendMail({
      from: process.env.SMTP_FROM || user,
      to: email,
      subject: "Your Turf Booking OTP",
      text: `Your OTP is ${otp}. Valid for 10 minutes. Do not share it with anyone.`,
    });

    console.log("Email sent successfully");
    return { success: true };
  } catch (err) {
    console.error("SMTP Error:", err);
    console.log(`📧 OTP for ${email}: ${otp}`);
    return { success: false, error: err.message };
  }
};

module.exports = router;
