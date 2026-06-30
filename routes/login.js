const express = require("express");
const router = express.Router();
const { User } = require("../models");
const { getNextId } = require("../utils/helpers");

router.post("/login", async (req, res) => {
  try {
    let { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ message: "Mobile number missing" });
    }

    mobile = mobile.toString().replace(/^\+91/, "").trim();

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ message: "Invalid mobile number format" });
    }

    let user = await User.findOne({ Mobile_Number: mobile }).lean();

    if (user) {
      return res.json({
        success: true,
        message: "Existing user",
        user,
      });
    }

    const User_ID = await getNextId("userId", "UID", 4);
    user = await User.create({ User_ID, Mobile_Number: mobile });

    return res.json({
      success: true,
      message: "New user created",
      user: user.toObject(),
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
