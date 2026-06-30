const express = require("express");
const router = express.Router();
const {
  Booking,
  BookingSlot,
  Payment,
  User,
  Slot,
} = require("../models");

router.get("/admin/booking", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ BookingDate: -1 }).lean();
    const results = [];

    for (const b of bookings) {
      const user = b.User_ID
        ? await User.findOne({ User_ID: b.User_ID }).lean()
        : null;
      const bookingSlots = await BookingSlot.find({ BookingId: b.BookingId }).lean();
      const slots = await Slot.find({
        SlotId: { $in: bookingSlots.map((bs) => bs.SlotId) },
      })
        .sort({ StartHour: 1 })
        .lean();
      const payment = await Payment.findOne({ BookingId: b.BookingId }).lean();

      results.push({
        BookingId: b.BookingId,
        Mobile_Number: user?.Mobile_Number || b.MobileNumber,
        BookingDate: b.BookingDate,
        Slots: slots.map((s) => s.Timing).join(", "),
        TotalAmount: payment?.TotalAmount ?? 0,
        BalanceAmount: payment?.BalanceAmount ?? 0,
        Status: payment?.Status ?? "Pending",
      });
    }

    res.json(results);
  } catch (err) {
    console.error("Admin booking fetch error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

module.exports = router;
