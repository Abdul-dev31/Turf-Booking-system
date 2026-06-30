const express = require("express");
const router = express.Router();
const { Slot, SlotPrice } = require("../models");
const { getPricesForDate } = require("../utils/helpers");

router.get("/slot-prices", async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "date query required" });

  try {
    const { prices, dayName } = await getPricesForDate(date);
    res.json({ prices, dayName });
  } catch (err) {
    console.error("slot-prices error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.post("/update-prices", async (req, res) => {
  try {
    const { weekdayMorning, weekdayEvening, weekendMorning, weekendEvening } = req.body;
    const slots = await Slot.find().lean();

    for (const slot of slots) {
      const isMorning = slot.StartHour >= 6 && slot.StartHour <= 17;

      await SlotPrice.updateOne(
        { SlotId: slot.SlotId, DayType: "Weekday" },
        { $set: { Price: isMorning ? weekdayMorning : weekdayEvening } },
        { upsert: true }
      );
      await SlotPrice.updateOne(
        { SlotId: slot.SlotId, DayType: "Weekend" },
        { $set: { Price: isMorning ? weekendMorning : weekendEvening } },
        { upsert: true }
      );
    }

    res.json({ message: "Prices Updated Successfully!" });
  } catch (err) {
    console.error("update-prices error:", err);
    res.status(500).json({ message: "Error updating prices" });
  }
});

router.get("/get-prices", async (req, res) => {
  try {
    const slots = await Slot.find().lean();
    const morningSlot = slots.find((s) => s.StartHour >= 6 && s.StartHour <= 17);
    const eveningSlot = slots.find((s) => s.StartHour < 6 || s.StartHour >= 18);

    const wm = morningSlot
      ? await SlotPrice.findOne({ SlotId: morningSlot.SlotId, DayType: "Weekday" }).lean()
      : null;
    const we = eveningSlot
      ? await SlotPrice.findOne({ SlotId: eveningSlot.SlotId, DayType: "Weekday" }).lean()
      : null;
    const wkm = morningSlot
      ? await SlotPrice.findOne({ SlotId: morningSlot.SlotId, DayType: "Weekend" }).lean()
      : null;
    const wke = eveningSlot
      ? await SlotPrice.findOne({ SlotId: eveningSlot.SlotId, DayType: "Weekend" }).lean()
      : null;

    res.json({
      weekdayMorning: wm?.Price ?? 0,
      weekdayEvening: we?.Price ?? 0,
      weekendMorning: wkm?.Price ?? 0,
      weekendEvening: wke?.Price ?? 0,
    });
  } catch (err) {
    console.error("get-prices error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
