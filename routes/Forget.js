const express = require("express");
const router = express.Router();
const { Admin } = require("../models");

let otpStore = {};

router.post("/sendotp", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const admin = await Admin.findOne({ Mail_ID: email }).lean();
    if (!admin) {
      return res.status(404).json({ message: "Email not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    otpStore[email] = { otp, expiresAt };
    console.log(`📩 OTP for ${email}: ${otp}`);

    res.json({ message: "OTP generated successfully" });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/verifyotp", (req, res) => {
  const { email, otp } = req.body;

  if (!otpStore[email]) {
    return res.status(400).json({ message: "No OTP generated for this email" });
  }

  const { otp: storedOtp, expiresAt } = otpStore[email];

  if (new Date() > expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ message: "OTP expired" });
  }

  if (storedOtp !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  delete otpStore[email];
  res.json({ message: "OTP verified successfully" });
});

router.put("/resetpassword", async (req, res) => {
  const { email, password, repassword } = req.body;

  if (!email || !password || !repassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password !== repassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const admin = await Admin.findOne({ Mail_ID: email });
    if (!admin) {
      return res.status(404).json({ message: "Email not found" });
    }

    admin.Password_ = password;
    await admin.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/resendotp", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const admin = await Admin.findOne({ Mail_ID: email }).lean();
    if (!admin) {
      return res.status(404).json({ message: "Email not found" });
    }

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
    await Admin.updateOne({ Admin_ID: "AID001" }, { $set: { UPI: upi } });
    res.json({ message: "UPI Updated Successfully!" });
  } catch (error) {
    console.log("UPI Update Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/get-upi", async (req, res) => {
  try {
    const admin = await Admin.findOne().sort({ Admin_ID: 1 }).lean();
    res.json({ upi: admin?.UPI ?? null });
  } catch (err) {
    console.error("Get UPI Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
