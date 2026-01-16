const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { dbConfig } = require("../Config/dbconfig");


// =================== GET ALL SLOTS ===================
router.get("/slots", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .query("SELECT SlotId, Timing, StartHour FROM Slot ORDER BY StartHour");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});


// =================== GET BOOKED + BLOCKED SLOTS ===================
router.get("/booked-slots", async (req, res) => {
  try {
    const { from, to } = req.query;
    const pool = await sql.connect(dbConfig);

    const result = await pool.request()
      .input("from", sql.Date, from)
      .input("to", sql.Date, to)
      .query(`
        SELECT BookingDate AS date, SlotId FROM BookingSlot
        WHERE BookingDate BETWEEN @from AND @to

        UNION

        SELECT BlockDate AS date, SlotId FROM BlockedSlot
        WHERE BlockDate BETWEEN @from AND @to
      `);

    res.json({ blocked: result.recordset });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to load blocked slots" });
  }
});


// =================== ADMIN LOCK SLOTS ===================
router.post("/admin/lock-slots", async (req, res) => {
  try {
    const { date, slotIds } = req.body;
    const pool = await sql.connect(dbConfig);

    for (const slotId of slotIds) {
      await pool.request()
        .input("slotId", sql.VarChar, slotId)
        .input("date", sql.Date, date)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM BlockedSlot 
            WHERE SlotId=@slotId AND BlockDate=@date
          )
          INSERT INTO BlockedSlot (SlotId, BlockDate)
          VALUES (@slotId, @date)
        `);
    }

    res.json({ message: "Slots locked successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to lock slots" });
  }
});


// =================== ADMIN UNLOCK SLOTS ===================
router.post("/admin/unlock-slots", async (req, res) => {
  try {
    const { date, slotIds } = req.body;
    const pool = await sql.connect(dbConfig);

    for (const slotId of slotIds) {
      await pool.request()
        .input("slotId", sql.VarChar, slotId)
        .input("date", sql.Date, date)
        .query(`
          DELETE FROM BlockedSlot
          WHERE SlotId=@slotId AND BlockDate=@date
        `);
    }

    res.json({ message: "Slots unlocked successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to unlock slots" });
  }
});


// =================== EXPORT ===================
module.exports = router;
