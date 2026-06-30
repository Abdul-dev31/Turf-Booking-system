const crypto = require("crypto");
const { Counter, Slot, SlotPrice } = require("../models");

async function getNextId(counterName, prefix, pad = 4) {
  const counter = await Counter.findByIdAndUpdate(
    counterName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}${String(counter.seq).padStart(pad, "0")}`;
}

function generateSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

function getDayName(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function isWeekendPricing(dateStr, startHour) {
  const dayName = getDayName(dateStr);
  return dayName === "Saturday" || dayName === "Sunday" || (dayName === "Friday" && startHour >= 18);
}

async function getSlotPrice(slotId, dateStr, startHour) {
  const dayType = isWeekendPricing(dateStr, startHour) ? "Weekend" : "Weekday";
  const row = await SlotPrice.findOne({ SlotId: slotId, DayType: dayType }).lean();
  return row ? Number(row.Price) : 0;
}

async function calculateBookingTotal(slotIds, bookingDate) {
  const slots = await Slot.find({ SlotId: { $in: slotIds } }).lean();
  let total = 0;

  for (const slot of slots) {
    total += await getSlotPrice(slot.SlotId, bookingDate, slot.StartHour);
  }

  return total;
}

async function getPricesForDate(dateStr) {
  const slots = await Slot.find().sort({ StartHour: 1 }).lean();
  const dayName = getDayName(dateStr);

  const prices = await Promise.all(
    slots.map(async (slot) => {
      const hr = slot.StartHour;
      const isWeekend = dayName === "Saturday" || dayName === "Sunday";
      const isFridayEvening = dayName === "Friday" && hr >= 18;

      let dayType = "Weekday";
      if (isWeekend || isFridayEvening) dayType = "Weekend";

      const priceRow = await SlotPrice.findOne({ SlotId: slot.SlotId, DayType: dayType }).lean();

      return {
        SlotId: slot.SlotId,
        Timing: slot.Timing,
        StartHour: slot.StartHour,
        Price: Number(priceRow?.Price || 0),
      };
    })
  );

  return { prices, dayName };
}

function normalizeDate(date) {
  if (!date) return null;
  if (typeof date === "string") return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

module.exports = {
  getNextId,
  generateSessionId,
  getDayName,
  isWeekendPricing,
  getSlotPrice,
  calculateBookingTotal,
  getPricesForDate,
  normalizeDate,
};
