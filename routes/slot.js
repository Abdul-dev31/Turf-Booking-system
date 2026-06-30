const express = require("express");
const router = express.Router();
const { Slot, BookingSlot, Booking, BlockedSlot } = require("../models");
const { normalizeDate } = require("../utils/helpers");

async function getBookedSlotIdsForDate(bookingDate) {
  const rows = await BookingSlot.find({ BookingDate: bookingDate }).lean();
  return rows.map((row) => row.SlotId);
}

async function getLockedSlotIdsForDate(bookingDate) {
  const rows = await BlockedSlot.find({
    BlockDate: bookingDate,
    IsActive: true,
  }).lean();
  return rows.map((row) => row.SlotId);
}

router.get("/slots", async (req, res) => {
  try {
    const { date } = req.query;
    const slots = await Slot.find().sort({ StartHour: 1 }).lean();

    if (!date) {
      return res.json(slots);
    }

    const dateStr = normalizeDate(date);
    const [bookedSlotIds, lockedSlotIds] = await Promise.all([
      getBookedSlotIdsForDate(dateStr),
      getLockedSlotIdsForDate(dateStr),
    ]);

    const bookedSet = new Set(bookedSlotIds);
    const lockedSet = new Set(lockedSlotIds);

    const result = slots.map((slot) => {
      const status = bookedSet.has(slot.SlotId)
        ? "booked"
        : lockedSet.has(slot.SlotId)
          ? "locked"
          : "available";

      return {
        ...slot,
        status,
        isAvailable: status === "available",
      };
    });

    res.json({ date: dateStr, slots: result });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

router.get("/booked-slots", async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = normalizeDate(from);
    const toDate = normalizeDate(to);

    const booked = await BookingSlot.find({
      BookingDate: { $gte: fromDate, $lte: toDate },
    }).lean();

    const locked = await BlockedSlot.find({
      BlockDate: { $gte: fromDate, $lte: toDate },
      IsActive: true,
    }).lean();

    const blocked = [
      ...booked.map((b) => ({
        date: b.BookingDate,
        SlotId: b.SlotId,
        source: "BOOKED",
      })),
      ...locked.map((b) => ({
        date: b.BlockDate,
        SlotId: b.SlotId,
        source: "LOCKED",
      })),
    ];

    res.json({ blocked });
  } catch (err) {
    console.log("booked-slots error:", err.message);
    res.status(500).json({ error: "Failed to load blocked slots" });
  }
});

module.exports = router;
