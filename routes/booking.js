const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { dbConfig } = require('../Config/dbconfig');

// GET /api/slots - Get all available slots
router.get('/slots', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query('SELECT SlotId, Timing, StartHour FROM Slot ORDER BY StartHour');
    
    console.log('[Slots] Found:', result.recordset.length);
    res.json(result. recordset);
  } catch (err) {
    console.error('❌ Error fetching slots:', err);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// GET /api/booked-slots - Get booked slots in date range
router.get('/booked-slots', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required' });
    }

    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('fromDate', sql.Date, from)
      .input('toDate', sql.Date, to)
      .query(`
        SELECT 
          BS.BookingDate as date,
          BS.SlotId as slotId,
          S.Timing as timing,
          S. Timing as timingKey
        FROM BookingSlot BS
        JOIN Slot S ON BS.SlotId = S.SlotId
        WHERE BS.BookingDate BETWEEN @fromDate AND @toDate
      `);

    const blocked = result.recordset.map(row => ({
      date:  row.date. toISOString().slice(0, 10),
      slotId: row.slotId,
      timing: row. timing,
      timingKey: row.timingKey
    }));

    console.log('[Booked Slots]', from, 'to', to, '- Found:', blocked.length);
    res.json({ blocked });
  } catch (err) {
    console.error('❌ Error fetching booked slots:', err);
    res.status(500).json({ error: 'Failed to fetch booked slots' });
  }
});
// ...  existing code ...

// GET /api/booking/details/:bookingId - Get booking details for payment page
router.get('/booking/details/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log('[Booking Details] Request for:', bookingId);

    const pool = await sql.connect(dbConfig);

    // Get booking with slots
    const result = await pool.request()
      .input('bookingId', sql.VarChar(10), bookingId)
      .query(`
        SELECT 
          B.BookingId,
          B.BookingDate,
          B.User_ID,
          BS.SlotId,
          S.Timing,
          S. StartHour,
          CASE 
            WHEN DATENAME(WEEKDAY, B. BookingDate) IN ('Saturday', 'Sunday')
                 OR (DATENAME(WEEKDAY, B.BookingDate) = 'Friday' AND S.StartHour >= 18)
            THEN SPW.Price
            ELSE SPWD.Price
          END as Price
        FROM Booking B
        JOIN BookingSlot BS ON B.BookingId = BS.BookingId
        JOIN Slot S ON BS.SlotId = S.SlotId
        LEFT JOIN SlotPrice SPWD ON SPWD.SlotId = S.SlotId AND SPWD.DayType = 'Weekday'
        LEFT JOIN SlotPrice SPW ON SPW.SlotId = S. SlotId AND SPW.DayType = 'Weekend'
        WHERE B.BookingId = @bookingId
        ORDER BY S.StartHour
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const bookingDate = result.recordset[0]. BookingDate;
    const userId = result.recordset[0]. User_ID;

    const slots = result.recordset.map(row => ({
      SlotId:  row.SlotId,
      Timing: row.Timing,
      StartHour: row.StartHour,
      Price: row.Price
    }));

    console.log('[Booking Details] Found:', { bookingId, bookingDate, slots:  slots.length });

    res.json({
      bookingId,
      bookingDate,
      userId,
      slots
    });

  } catch (err) {
    console.error('❌ Error fetching booking details:', err);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});
// POST /api/booking/create - Create new booking
router.post('/booking/create', async (req, res) => {
  const { userId, bookingDate, slotIds } = req.body;

  console.log('[Booking Create] Request:', { userId, bookingDate, slotIds });

  if (!userId || !bookingDate || !slotIds || slotIds.length === 0) {
    return res.status(400).json({ error: 'userId, bookingDate, and slotIds are required' });
  }

  let pool;
  let transaction;

  try {
    pool = await sql.connect(dbConfig);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('[Booking Create] Transaction started');

    // 1. Insert into Booking table (trigger auto-generates BookingId)
    const bookingRequest = new sql.Request(transaction);
    const bookingResult = await bookingRequest
      .input('userId', sql. VarChar(20), userId)
      .input('bookingDate', sql.Date, bookingDate)
      .query(`
        INSERT INTO Booking (User_ID, BookingDate)
        VALUES (@userId, @bookingDate);
        
        SELECT TOP 1 BookingId 
        FROM Booking 
        WHERE User_ID = @userId 
        ORDER BY BookingId DESC;
      `);

    const bookingId = bookingResult.recordset[0].BookingId;
    console.log('[Booking Create] ✅ Generated BookingId:', bookingId);

    // 2. Insert slots into BookingSlot (trigger auto-fills BookingDate)
    for (const slotId of slotIds) {
      try {
        const slotRequest = new sql.Request(transaction);
        await slotRequest
          .input('bookingId', sql.VarChar(10), bookingId)
          .input('slotId', sql.VarChar(10), slotId)
          .query(`
            INSERT INTO BookingSlot (BookingId, SlotId)
            VALUES (@bookingId, @slotId);
          `);
        console.log('[Booking Create] ✅ Added slot:', slotId);
      } catch (slotErr) {
        // Handle duplicate slot booking (UNIQUE constraint violation)
        if (slotErr.number === 2627 || slotErr.number === 2601) {
          console.log('[Booking Create] ❌ Slot already booked:', slotId);
          await transaction.rollback();
          return res.status(409).json({ 
            error: 'One or more slots are already booked for this date',
            slotId: slotId
          });
        }
        throw slotErr;
      }
    }

    // 3. Get total amount (calculated by trigger)
    const paymentRequest = new sql.Request(transaction);
    const paymentResult = await paymentRequest
      . input('bookingId', sql. VarChar(10), bookingId)
      .query(`
        SELECT TotalAmount 
        FROM Payment 
        WHERE BookingId = @bookingId;
      `);

    const totalAmount = paymentResult.recordset[0]?.TotalAmount || 0;
    console.log('[Booking Create] ✅ Total Amount:', totalAmount);

    await transaction.commit();
    console.log('[Booking Create] ✅ Transaction committed');

    res.json({
      success: true,
      bookingId,
      totalAmount
    });

  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
        console.log('[Booking Create] ❌ Transaction rolled back');
      } catch (rollbackErr) {
        console.error('❌ Error rolling back transaction:', rollbackErr);
      }
    }
    console.error('❌ Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking', details: err.message });
  }
});
router.get("/admin/bookings", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      SELECT 
        B.BookingId       AS BookingID,
        U.Mobile_Number  AS CustomerMobile,
        BS.BookingDate   AS BookingDate,
        S.Timing         AS SlotTime,
        P.TotalAmount    AS TotalAmount,
        P.BalanceAmount  AS BalanceAmount,
        P.Status         AS PaymentStatus
      FROM Booking B
      JOIN Usertable U   ON U.User_ID = B.User_ID
      JOIN BookingSlot BS ON BS.BookingId = B.BookingId
      JOIN Slot S        ON S.SlotId = BS.SlotId
      JOIN Payment P     ON P.BookingId = B.BookingId
      ORDER BY BS.BookingDate DESC, S.StartHour
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Admin Booking Error:", err);
    res.status(500).json({ message: "Failed to load admin bookings" });
  }
});


module.exports = router;