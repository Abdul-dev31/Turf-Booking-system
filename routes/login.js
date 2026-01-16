const express = require("express");
const router = express.Router();
const { poolPromise } = require("../Config/dbconfig");

// Login / Register using mobile number
router.post("/login", async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({ message: "Invalid mobile number" });
    }

    const pool = await poolPromise;

    // 1️⃣ Check if user already exists
    const checkUser = await pool.request()
      .input("mobile", mobile)
      .query("SELECT * FROM Usertable WHERE Mobile_Number = @mobile");

    if (checkUser.recordset.length > 0) {
      // Existing user → return details
      return res.json({
        message: "Existing user",
        user: checkUser.recordset[0]
      });
    }

    // 2️⃣ Insert new user → Trigger will generate User_ID
    await pool.request()
      .input("mobile", mobile)
      .query(`INSERT INTO Usertable (Mobile_Number) VALUES (@mobile)`);

    // Fetch newly created user
    const newUser = await pool.request()
      .input("mobile", mobile)
      .query("SELECT * FROM Usertable WHERE Mobile_Number = @mobile");

    return res.json({
      message: "New user created",
      user: newUser.recordset[0]
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/by-mobile/:mobile", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("mobile", sql.VarChar, req.params.mobile)
      .query(`
        SELECT User_ID
        FROM Usertable
        WHERE Mobile_Number = @mobile
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false });
    }

    res.json({ success: true, userId: result.recordset[0].User_ID });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


module.exports = router;
