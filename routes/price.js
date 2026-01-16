// routes/price.js
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { poolPromise } = require("../Config/dbconfig");

// GET Price for each slot for a specific date: /api/slot-prices?date=YYYY-MM-DD
router.get("/slot-prices", async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "date query required" });

  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input("date", sql.Date, date)
      .query(`
        SELECT 
          s.SlotId,
          s.Timing,
          s.StartHour,
          DATENAME(weekday, @date) AS DayName,

          -- weekday morning
          (SELECT TOP 1 Price FROM SlotPrice WHERE SlotId = s.SlotId AND DayType='Weekday' AND s.StartHour BETWEEN 6 AND 17) AS WeekdayMorning,

          -- weekday evening
          (SELECT TOP 1 Price FROM SlotPrice WHERE SlotId = s.SlotId AND DayType='Weekday' AND (s.StartHour < 6 OR s.StartHour >= 18)) AS WeekdayEvening,

          -- weekend morning
          (SELECT TOP 1 Price FROM SlotPrice WHERE SlotId = s.SlotId AND DayType='Weekend' AND s.StartHour BETWEEN 6 AND 17) AS WeekendMorning,

          -- weekend evening
          (SELECT TOP 1 Price FROM SlotPrice WHERE SlotId = s.SlotId AND DayType='Weekend' AND (s.StartHour < 6 OR s.StartHour >= 18)) AS WeekendEvening
        FROM Slot s
        ORDER BY s.StartHour
      `);

    const dayName = result.recordset[0]?.DayName || "";

    const prices = result.recordset.map(r => {
      const hr = r.StartHour;

      let price = 0;

      const isWeekend = (dayName === "Saturday" || dayName === "Sunday");
      const isFridayEvening = (dayName === "Friday" && hr >= 18);

      if (isWeekend) {
        price = (hr >= 6 && hr <= 17) ? r.WeekendMorning : r.WeekendEvening;
      } else if (isFridayEvening) {
        price = r.WeekendEvening; // Friday evening uses weekend-evening price
      } else {
        price = (hr >= 6 && hr <= 17) ? r.WeekdayMorning : r.WeekdayEvening;
      }

      return {
        SlotId: r.SlotId,
        Timing: r.Timing,
        StartHour: r.StartHour,
        Price: Number(price || 0)
      };
    });

    res.json({ prices, dayName });
  } catch (err) {
    console.error("slot-prices error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Optional: admin endpoints you already had (update and get base 4 prices)
// Keep or remove as required.

router.post("/update-prices", async (req, res) => {
  try {
    const { weekdayMorning, weekdayEvening, weekendMorning, weekendEvening } = req.body;
    const pool = await poolPromise;

    // Weekday Morning
    await pool.request()
      .input("price", sql.Decimal(10,2), weekdayMorning)
      .query(`
        UPDATE SP
        SET SP.Price = @price
        FROM SlotPrice SP
        JOIN Slot S ON SP.SlotId = S.SlotId
        WHERE SP.DayType = 'Weekday'
          AND S.StartHour BETWEEN 6 AND 17;
      `);

    // Weekday Evening
    await pool.request()
      .input("price", sql.Decimal(10,2), weekdayEvening)
      .query(`
        UPDATE SP
        SET SP.Price = @price
        FROM SlotPrice SP
        JOIN Slot S ON SP.SlotId = S.SlotId
        WHERE SP.DayType = 'Weekday'
          AND S.StartHour NOT BETWEEN 6 AND 17;
      `);

    // Weekend Morning
    await pool.request()
      .input("price", sql.Decimal(10,2), weekendMorning)
      .query(`
        UPDATE SP
        SET SP.Price = @price
        FROM SlotPrice SP
        JOIN Slot S ON SP.SlotId = S.SlotId
        WHERE SP.DayType = 'Weekend'
          AND S.StartHour BETWEEN 6 AND 17;
      `);

    // Weekend Evening
    await pool.request()
      .input("price", sql.Decimal(10,2), weekendEvening)
      .query(`
        UPDATE SP
        SET SP.Price = @price
        FROM SlotPrice SP
        JOIN Slot S ON SP.SlotId = S.SlotId
        WHERE SP.DayType = 'Weekend'
          AND S.StartHour NOT BETWEEN 6 AND 17;
      `);

    res.json({ message: "Prices Updated Successfully!" });
  } catch (err) {
    console.error("update-prices error:", err);
    res.status(500).json({ message: "Error updating prices" });
  }
});

// Optional: return base 4 price groups (if you still need /get-prices)
router.get("/get-prices", async (req, res) => {
  try {
    const pool = await poolPromise;

    const weekdayMorning = await pool.request().query(`
      SELECT TOP 1 SP.Price FROM SlotPrice SP
      JOIN Slot S ON SP.SlotId = S.SlotId
      WHERE SP.DayType='Weekday' AND S.StartHour BETWEEN 6 AND 17
    `);

    const weekdayEvening = await pool.request().query(`
      SELECT TOP 1 SP.Price FROM SlotPrice SP
      JOIN Slot S ON SP.SlotId = S.SlotId
      WHERE SP.DayType='Weekday' AND S.StartHour NOT BETWEEN 6 AND 17
    `);

    const weekendMorning = await pool.request().query(`
      SELECT TOP 1 SP.Price FROM SlotPrice SP
      JOIN Slot S ON SP.SlotId = S.SlotId
      WHERE SP.DayType='Weekend' AND S.StartHour BETWEEN 6 AND 17
    `);

    const weekendEvening = await pool.request().query(`
      SELECT TOP 1 SP.Price FROM SlotPrice SP
      JOIN Slot S ON SP.SlotId = S.SlotId
      WHERE SP.DayType='Weekend' AND S.StartHour NOT BETWEEN 6 AND 17
    `);

    res.json({
      weekdayMorning: weekdayMorning.recordset[0]?.Price ?? 0,
      weekdayEvening: weekdayEvening.recordset[0]?.Price ?? 0,
      weekendMorning: weekendMorning.recordset[0]?.Price ?? 0,
      weekendEvening: weekendEvening.recordset[0]?.Price ?? 0
    });
  } catch (err) {
    console.error("get-prices error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
