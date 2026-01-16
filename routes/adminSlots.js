const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { dbConfig } = require("../Config/dbconfig");

/*
 ADMIN LOCK SLOT
*/
router.post("/lock-slot", async (req, res) => {
  try {
    const { slotId, date } = req.body;

    const pool = await sql.connect(dbConfig);

    await pool.request()
      .input("slotId", sql.VarChar, slotId)
      .input("date", sql.Date, date)
      .query(`
        INSERT INTO BookingSlot (BookingId, SlotId, BookingDate)
        VALUES ('ADMIN', @slotId, @date)
      `);

    res.json({ success: true, message: "Slot locked" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
 ADMIN UNLOCK SLOT
*/
router.post("/unlock-slot", async (req, res) => {
  try {
    const { slotId, date } = req.body;

    const pool = await sql.connect(dbConfig);

    await pool.request()
      .input("slotId", sql.VarChar, slotId)
      .input("date", sql.Date, date)
      .query(`
        DELETE FROM BookingSlot
        WHERE BookingId = 'ADMIN'
        AND SlotId = @slotId
        AND BookingDate = @date
      `);

    res.json({ success: true, message: "Slot unlocked" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
