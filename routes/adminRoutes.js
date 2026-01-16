const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { dbConfig } = require("../Config/dbconfig");

/*
 GET all user bookings for Admin
*/
router.get("/admin/booking", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      SELECT 
        B.BookingId,
        U.Mobile_Number,
        B.BookingDate,
        STUFF((
            SELECT ', ' + S.Timing
            FROM BookingSlot BS2
            JOIN Slot S ON BS2.SlotId = S.SlotId
            WHERE BS2.BookingId = B.BookingId
            FOR XML PATH('')
        ),1,2,'') AS Slots,
        P.TotalAmount,
        P.BalanceAmount,
        P.Status
      FROM Booking B
      JOIN Usertable U ON B.User_ID = U.User_ID
      JOIN Payment P ON B.BookingId = P.BookingId
      ORDER BY B.BookingDate DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Admin booking fetch error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

module.exports = router;
