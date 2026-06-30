const express = require("express");
const router = express.Router();
const {
  Booking,
  BookingSlot,
  User,
  Slot,
  BlockedSlot,
} = require("../models");
const { normalizeDate } = require("../utils/helpers");

async function getBookingUsersForSlotDate(slotId, date) {
  const dateStr = normalizeDate(date);
  const bookingSlots = await BookingSlot.find({
    SlotId: slotId,
    BookingDate: dateStr,
  }).lean();

  const results = [];
  for (const bs of bookingSlots) {
    const booking = await Booking.findOne({ BookingId: bs.BookingId }).lean();
    const user = booking?.User_ID
      ? await User.findOne({ User_ID: booking.User_ID }).lean()
      : null;
    const slot = await Slot.findOne({ SlotId: bs.SlotId }).lean();

    results.push({
      BookingId: bs.BookingId,
      userId: booking?.User_ID,
      mobileNumber: user?.Mobile_Number || booking?.MobileNumber,
      timing: slot?.Timing,
    });
  }

  return results;
}

router.get("/admin/slots", async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: "date is required" });
  }

  try {
    const dateStr = normalizeDate(date);
    const map = {};

    const bookedSlots = await BookingSlot.find({ BookingDate: dateStr }).lean();
    for (const bs of bookedSlots) {
      const booking = await Booking.findOne({ BookingId: bs.BookingId }).lean();
      const user = booking?.User_ID
        ? await User.findOne({ User_ID: booking.User_ID }).lean()
        : null;
      const key = `${bs.SlotId}_${dateStr}`;
      map[key] = {
        isLocked: false,
        isBooked: true,
        userName: booking?.Name || user?.Name || "Customer",
        mobileNumber: user?.Mobile_Number || booking?.MobileNumber,
      };
    }

    const lockedSlots = await BlockedSlot.find({
      BlockDate: dateStr,
      IsActive: true,
    }).lean();

    for (const lock of lockedSlots) {
      const key = `${lock.SlotId}_${dateStr}`;
      map[key] = {
        isLocked: true,
        isBooked: false,
        userName: null,
        mobileNumber: null,
        lockReason: lock.LockReason,
        lockedBy: lock.LockedBy,
      };
    }

    res.json(map);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch admin slots" });
  }
});

router.post("/admin/lock-slot", async (req, res) => {
  const { slotId, date, lockReason, lockedBy } = req.body;

  if (!slotId || !date) {
    return res.status(400).json({ error: "slotId and date are required" });
  }

  try {
    const dateStr = normalizeDate(date);
    const bookings = await getBookingUsersForSlotDate(slotId, dateStr);
    if (bookings.length > 0) {
      return res.status(409).json({
        error: "Slot is already booked by a customer",
        bookings,
      });
    }

    await BlockedSlot.updateOne(
      { SlotId: slotId, BlockDate: dateStr },
      {
        $set: {
          SlotId: slotId,
          BlockDate: dateStr,
          IsActive: true,
          LockedAt: new Date(),
          LockedBy: lockedBy || null,
          LockReason: lockReason || null,
          UnlockedAt: null,
          UnlockedBy: null,
          UnlockReason: null,
        },
      },
      { upsert: true }
    );

    res.json({ success: true, message: "Slot locked (disabled)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to lock slot" });
  }
});

router.post("/admin/unlock-slot", async (req, res) => {
  const { slotId, date, unlockReason, reason, unlockedBy } = req.body;
  const finalReason = unlockReason || reason;

  if (!slotId || !date) {
    return res.status(400).json({ error: "slotId and date are required" });
  }

  if (!finalReason || String(finalReason).trim().length === 0) {
    return res.status(400).json({ error: "unlockReason is required" });
  }

  try {
    const dateStr = normalizeDate(date);
    const result = await BlockedSlot.updateOne(
      { SlotId: slotId, BlockDate: dateStr, IsActive: true },
      {
        $set: {
          IsActive: false,
          UnlockedAt: new Date(),
          UnlockedBy: unlockedBy || null,
          UnlockReason: String(finalReason).trim(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Slot is not locked for that date" });
    }

    res.json({ success: true, message: "Slot unlocked (enabled)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unlock slot" });
  }
});

router.post("/admin/lock-slots", async (req, res) => {
  const { date, slotIds, lockReason, lockedBy } = req.body;

  if (!date || !Array.isArray(slotIds) || slotIds.length === 0) {
    return res.status(400).json({ error: "date and slotIds[] are required" });
  }

  try {
    const dateStr = normalizeDate(date);
    const conflicts = [];
    let lockedCount = 0;

    for (const slotId of slotIds) {
      const bookings = await getBookingUsersForSlotDate(slotId, dateStr);
      if (bookings.length > 0) {
        conflicts.push({ slotId, bookings });
        continue;
      }

      await BlockedSlot.updateOne(
        { SlotId: slotId, BlockDate: dateStr },
        {
          $set: {
            SlotId: slotId,
            BlockDate: dateStr,
            IsActive: true,
            LockedAt: new Date(),
            LockedBy: lockedBy || null,
            LockReason: lockReason || null,
            UnlockedAt: null,
            UnlockedBy: null,
            UnlockReason: null,
          },
        },
        { upsert: true }
      );
      lockedCount += 1;
    }

    if (conflicts.length > 0) {
      return res.status(409).json({
        error: "Some slots are already booked",
        lockedCount,
        conflicts,
      });
    }

    res.json({ message: "Slots locked (disabled)", lockedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to lock" });
  }
});

router.post("/admin/unlock-slots", async (req, res) => {
  const { date, slotIds, unlockReason, reason, unlockedBy } = req.body;
  const finalReason = unlockReason || reason;

  if (!date || !Array.isArray(slotIds) || slotIds.length === 0) {
    return res.status(400).json({ error: "date and slotIds[] are required" });
  }

  if (!finalReason || String(finalReason).trim().length === 0) {
    return res.status(400).json({ error: "unlockReason is required" });
  }

  try {
    const dateStr = normalizeDate(date);
    let unlockedCount = 0;

    for (const slotId of slotIds) {
      const result = await BlockedSlot.updateOne(
        { SlotId: slotId, BlockDate: dateStr, IsActive: true },
        {
          $set: {
            IsActive: false,
            UnlockedAt: new Date(),
            UnlockedBy: unlockedBy || null,
            UnlockReason: String(finalReason).trim(),
          },
        }
      );
      if (result.modifiedCount > 0) unlockedCount += 1;
    }

    res.json({ message: "Slots unlocked (enabled)", unlockedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unlock" });
  }
});

router.get("/admin/slot-bookings", async (req, res) => {
  const { slotId, date } = req.query;

  if (!slotId || !date) {
    return res.status(400).json({ error: "slotId and date are required" });
  }

  try {
    const bookings = await getBookingUsersForSlotDate(String(slotId), String(date));
    res.json({ slotId, date, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch slot bookings" });
  }
});

router.get("/admin/lock-status", async (req, res) => {
  const { slotId, date } = req.query;

  if (!slotId || !date) {
    return res.status(400).json({ error: "slotId and date are required" });
  }

  try {
    const dateStr = normalizeDate(date);
    const row = await BlockedSlot.findOne({
      SlotId: String(slotId),
      BlockDate: dateStr,
    }).lean();

    res.json({
      slotId,
      date: dateStr,
      isLocked: !!(row && row.IsActive === true),
      lock: row || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch lock status" });
  }
});

router.get("/admin/locked-slots", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: "from and to are required" });
  }

  try {
    const fromDate = normalizeDate(from);
    const toDate = normalizeDate(to);

    const locked = await BlockedSlot.find({
      IsActive: true,
      BlockDate: { $gte: fromDate, $lte: toDate },
    })
      .sort({ BlockDate: 1, SlotId: 1 })
      .lean();

    res.json({ locked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch locked slots" });
  }
});

module.exports = router;
