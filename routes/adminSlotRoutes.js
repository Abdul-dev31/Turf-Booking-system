const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { dbConfig } = require("../Config/dbconfig");

/* LOCK SLOT */
router.post("/admin/lock-slot", async (req, res) => {
  const { slotId, date } = req.body;

  try {
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input("slotId", sql.VarChar(10), slotId)
      .input("date", sql.Date, date)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM AdminBlockedSlot 
          WHERE SlotId=@slotId AND BlockDate=@date
        )
        INSERT INTO AdminBlockedSlot (SlotId, BlockDate, IsLocked)
        VALUES (@slotId, @date, 1)
      `);

    res.json({ success: true, message: "Slot locked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to lock slot" });
  }
});

/* UNLOCK SLOT */
router.post("/admin/unlock-slot", async (req, res) => {
  const { slotId, date } = req.body;

  try {
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input("slotId", sql.VarChar(10), slotId)
      .input("date", sql.Date, date)
      .query(`
        DELETE FROM AdminBlockedSlot
        WHERE SlotId=@slotId AND BlockDate=@date
      `);

    res.json({ success: true, message: "Slot unlocked" });
  } catch (err) {
    res.status(500).json({ error: "Failed to unlock slot" });
  }
});
router.post("/admin/lock-slots", async (req, res) => {
  const { date, slotIds } = req.body;

  try {
    const pool = await sql.connect(dbConfig);

    for (const slotId of slotIds) {
      await pool.request()
        .input("slotId", sql.VarChar, slotId)
        .input("date", sql.Date, date)
        .query(`
          IF NOT EXISTS(
            SELECT 1 FROM AdminLockedSlot WHERE SlotId=@slotId AND LockDate=@date
          )
          INSERT INTO AdminLockedSlot (SlotId, LockDate)
          VALUES (@slotId, @date)
        `);
    }

    res.json({ message: "Slots locked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to lock" });
  }
});
router.post("/admin/unlock-slots", async (req, res) => {
  const { date, slotIds } = req.body;

  try {
    const pool = await sql.connect(dbConfig);

    for (const slotId of slotIds) {
      await pool.request()
        .input("slotId", sql.VarChar, slotId)
        .input("date", sql.Date, date)
        .query(`
          DELETE FROM AdminLockedSlot
          WHERE SlotId=@slotId AND LockDate=@date
        `);
    }

    res.json({ message: "Slots unlocked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unlock" });
  }
});


module.exports = router;
