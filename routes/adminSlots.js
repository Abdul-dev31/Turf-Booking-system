module.exports = require("./adminSlotRoutes");

if (false) {
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const { dbConfig } = require("../Config/dbconfig");

/*
 ADMIN LOCK SLOT - Disables slot by adding to BookingSlot with ADMIN booking ID
*/
router.post("/lock-slot", async (req, res) => {
  try {
    const { slotId, date } = req.body;

    if (!slotId || !date) {
      return res.status(400).json({ error: "slotId and date are required" });
    }

    const pool = await sql.connect(dbConfig);
    
    // Use compact booking ID: A-MMDD (e.g., A-0220 for Feb 20)
    // Limited to 10 chars like other booking IDs
    const dateObj = new Date(date);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const adminBookingId = `A-${month}${day}`;
    
    console.log("[Lock] Generated BookingId:", adminBookingId, "for date:", date);

    // First,create or verify ADMIN booking exists for this date
    await pool.request()
      .input("bookingId", sql.VarChar, adminBookingId)
      .input("date", sql.Date, date)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Booking WHERE BookingId = @bookingId)
        BEGIN
          INSERT INTO Booking (BookingId, BookingDate)
          VALUES (@bookingId, @date)
        END
      `);
    
    // Verify the booking was created
    const verifyBooking = await pool.request()
      .input("bookingId", sql.VarChar, adminBookingId)
      .query(`SELECT BookingId, BookingDate FROM Booking WHERE BookingId = @bookingId`);
    console.log("[Lock] Verified Booking exists:", verifyBooking.recordset);

    // Check if slot is already locked or booked for this date
    const checkResult = await pool.request()
      .input("slotId", sql.VarChar, slotId)
      .input("date", sql.Date, date)
      .query(`
        SELECT BS.SlotId, B.BookingId, B.BookingDate
        FROM BookingSlot BS
        JOIN Booking B ON BS.BookingId = B.BookingId
        WHERE BS.SlotId = @slotId AND B.BookingDate = @date
      `);
    
    console.log("[Lock] Checking slot:", slotId, "on date:", date, "- Found:", checkResult.recordset.length);

    if (checkResult.recordset.length > 0) {
      const existing = checkResult.recordset[0];
      if (existing.BookingId.startsWith('A-')) {
        return res.json({ success: true, message: "Slot already locked" });
      } else {
        return res.status(400).json({ error: "Slot is already booked by a customer" });
      }
    }

    // Lock the slot by inserting with ADMIN booking ID
    await pool.request()
      .input("bookingId", sql.VarChar, adminBookingId)
      .input("slotId", sql.VarChar, slotId)
      .query(`
        INSERT INTO BookingSlot (BookingId, SlotId)
        VALUES (@bookingId, @slotId)
      `);
    
    // Verify the slot was inserted
    const verifySlot = await pool.request()
      .input("bookingId", sql.VarChar, adminBookingId)
      .input("slotId", sql.VarChar, slotId)
      .query(`SELECT * FROM BookingSlot WHERE BookingId = @bookingId AND SlotId = @slotId`);
    console.log("[Lock] Verified BookingSlot exists:", verifySlot.recordset);
    
    console.log("[Lock] Successfully locked slot:", slotId, "for date:", date);

    res.json({ success: true, message: "Slot locked successfully" });
  } catch (err) {
    console.error("Lock slot error:", err);
    res.status(500).json({ error: "Failed to lock slot: " + err.message });
  }
});

/*
 ADMIN UNLOCK SLOT - Enables slot by removing from BookingSlot
*/
router.post("/unlock-slot", async (req, res) => {
  try {
    const { slotId, date } = req.body;

    if (!slotId || !date) {
      return res.status(400).json({ error: "slotId and date are required" });
    }

    const pool = await sql.connect(dbConfig);
    
    // Use same compact booking ID format: A-MMDD
    const dateObj = new Date(date);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const adminBookingId = `A-${month}${day}`;
    
    console.log("[Unlock] Generated BookingId:", adminBookingId, "for date:", date);
    
    // Check what's in BookingSlot before delete
    const beforeDelete = await pool.request()
      .input("bookingId", sql.VarChar, adminBookingId)
      .input("slotId", sql.VarChar, slotId)
      .query(`SELECT * FROM BookingSlot WHERE BookingId = @bookingId AND SlotId = @slotId`);
    console.log("[Unlock] BookingSlot before delete:", beforeDelete.recordset);

    // Delete the locked slot for this ADMIN booking
    const result = await pool.request()
      .input("bookingId", sql.VarChar, adminBookingId)
      .input("slotId", sql.VarChar, slotId)
      .query(`
        DELETE FROM BookingSlot
        WHERE BookingId = @bookingId
        AND SlotId = @slotId
      `);
    
    console.log("[Unlock] Deleted rows:", result.rowsAffected[0], "for slot:", slotId, "date:", date);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Slot was not locked by admin on this date" });
    }

    res.json({ success: true, message: "Slot unlocked successfully" });
  } catch (err) {
    console.error("Unlock slot error:", err);
    res.status(500).json({ error: "Failed to unlock slot: " + err.message });
  }
});

module.exports = router;
}
