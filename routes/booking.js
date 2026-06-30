const express = require("express");
const router = express.Router();
const {
  Booking,
  BookingSlot,
  Payment,
  Slot,
  SlotPrice,
  BlockedSlot,
  User,
} = require("../models");
const {
  getNextId,
  calculateBookingTotal,
  getPricesForDate,
  normalizeDate,
} = require("../utils/helpers");

async function getLockedSlotsForDate(bookingDate, slotIds) {
  if (!Array.isArray(slotIds) || slotIds.length === 0) return [];

  return BlockedSlot.find({
    BlockDate: bookingDate,
    IsActive: true,
    SlotId: { $in: slotIds },
  }).lean();
}

router.get("/booking/details/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ BookingId: bookingId }).lean();
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const bookingSlots = await BookingSlot.find({ BookingId: bookingId }).lean();
    const slotIds = bookingSlots.map((bs) => bs.SlotId);
    const slots = await Slot.find({ SlotId: { $in: slotIds } })
      .sort({ StartHour: 1 })
      .lean();

    const { prices } = await getPricesForDate(booking.BookingDate);
    const priceMap = Object.fromEntries(prices.map((p) => [p.SlotId, p.Price]));

    const slotDetails = slots.map((s) => ({
      SlotId: s.SlotId,
      Timing: s.Timing,
      StartHour: s.StartHour,
      Price: priceMap[s.SlotId] || 0,
    }));

    res.json({
      bookingId,
      bookingDate: booking.BookingDate,
      userId: booking.User_ID,
      slots: slotDetails,
    });
  } catch (err) {
    console.error("❌ Error fetching booking details:", err);
    res.status(500).json({ error: "Failed to fetch booking details" });
  }
});

router.post("/booking/create", async (req, res) => {
  const { userId, adminId, name, mobileNumber, bookingDate, slotIds } = req.body;

  if ((!userId && !adminId) || !bookingDate || !slotIds || slotIds.length === 0) {
    return res.status(400).json({
      error: "UserId or AdminId, bookingDate and slotIds are required",
    });
  }

  const dateStr = normalizeDate(bookingDate);

  try {
    const lockedSlots = await getLockedSlotsForDate(dateStr, slotIds);
    if (lockedSlots.length > 0) {
      return res.status(409).json({
        error: "One or more selected slots are locked for this date",
        lockedSlots: lockedSlots.map((row) => row.SlotId),
      });
    }

    const existing = await BookingSlot.find({
      BookingDate: dateStr,
      SlotId: { $in: slotIds },
    }).lean();

    if (existing.length > 0) {
      return res.status(409).json({
        error: "Slot already booked for this date",
        slotId: existing[0].SlotId,
      });
    }

    let resolvedUserId = userId;
    if (userId && /^\d{10}$/.test(String(userId))) {
      const user = await User.findOne({ Mobile_Number: userId }).lean();
      if (user) resolvedUserId = user.User_ID;
    }

    const bookingId = await getNextId("bookingId", "B", 4);
    const totalAmount = await calculateBookingTotal(slotIds, dateStr);

    await Booking.create({
      BookingId: bookingId,
      User_ID: resolvedUserId || null,
      Admin_ID: adminId || null,
      Name: name || null,
      MobileNumber: mobileNumber || null,
      BookingDate: dateStr,
    });

    for (const slotId of slotIds) {
      await BookingSlot.create({
        BookingId: bookingId,
        SlotId: slotId,
        BookingDate: dateStr,
      });
    }

    const paymentId = await getNextId("paymentId", "P", 4);
    await Payment.create({
      PaymentId: paymentId,
      BookingId: bookingId,
      TotalAmount: totalAmount,
      AmountPaid: 0,
      BalanceAmount: totalAmount,
      Status: totalAmount > 0 ? "Pending" : "Paid",
    });

    res.json({
      success: true,
      bookingId,
      totalAmount,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        error: "Slot already booked for this date",
      });
    }

    console.error("❌ Error creating booking:", err);
    res.status(500).json({
      error: "Failed to create booking",
      details: err.message,
    });
  }
});

router.get("/admin/bookings", async (req, res) => {
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

      for (const slot of slots) {
        results.push({
          BookingID: b.BookingId,
          CustomerMobile: user?.Mobile_Number || b.MobileNumber,
          BookingDate: b.BookingDate,
          SlotTime: slot.Timing,
          TotalAmount: payment?.TotalAmount ?? 0,
          BalanceAmount: payment?.BalanceAmount ?? 0,
          PaymentStatus: payment?.Status ?? "Pending",
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error("Admin Booking Error:", err);
    res.status(500).json({ message: "Failed to load admin bookings" });
  }
});

module.exports = router;
