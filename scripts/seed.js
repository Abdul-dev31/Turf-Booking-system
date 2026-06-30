require("dotenv").config();
const { connectDB } = require("../Config/dbconfig");
const {
  Admin,
  Slot,
  SlotPrice,
  Counter,
} = require("../models");

const SLOTS = [
  { SlotId: "SID001", Timing: "6am - 7am", StartHour: 6 },
  { SlotId: "SID002", Timing: "7am - 8am", StartHour: 7 },
  { SlotId: "SID003", Timing: "8am - 9am", StartHour: 8 },
  { SlotId: "SID004", Timing: "9am - 10am", StartHour: 9 },
  { SlotId: "SID005", Timing: "10am - 11am", StartHour: 10 },
  { SlotId: "SID006", Timing: "11am - 12pm", StartHour: 11 },
  { SlotId: "SID007", Timing: "12pm - 1pm", StartHour: 12 },
  { SlotId: "SID008", Timing: "1pm -2pm", StartHour: 13 },
  { SlotId: "SID009", Timing: "2pm-3pm", StartHour: 14 },
  { SlotId: "SID010", Timing: "3pm - 4pm", StartHour: 15 },
  { SlotId: "SID011", Timing: "4pm - 5pm", StartHour: 16 },
  { SlotId: "SID012", Timing: "5pm - 6pm", StartHour: 17 },
  { SlotId: "SID013", Timing: "6pm - 7pm", StartHour: 18 },
  { SlotId: "SID014", Timing: "7pm - 8pm", StartHour: 19 },
  { SlotId: "SID015", Timing: "8pm - 9pm", StartHour: 20 },
  { SlotId: "SID016", Timing: "9pm - 10pm", StartHour: 21 },
  { SlotId: "SID017", Timing: "10pm - 11pm", StartHour: 22 },
  { SlotId: "SID018", Timing: "11pm - 12am", StartHour: 23 },
  { SlotId: "SID019", Timing: "12am - 1am", StartHour: 0 },
  { SlotId: "SID020", Timing: "1am - 2am", StartHour: 1 },
  { SlotId: "SID021", Timing: "2am - 3am", StartHour: 2 },
  { SlotId: "SID022", Timing: "3am - 4am", StartHour: 3 },
  { SlotId: "SID023", Timing: "4am - 5am", StartHour: 4 },
  { SlotId: "SID024", Timing: "5am - 6am", StartHour: 5 },
];

const DEFAULT_PRICES = {
  weekdayMorning: 500,
  weekdayEvening: 700,
  weekendMorning: 800,
  weekendEvening: 900,
};

async function seed() {
  await connectDB();
  console.log("🌱 Seeding turf_booking database...");

  for (const slot of SLOTS) {
    await Slot.updateOne({ SlotId: slot.SlotId }, { $set: slot }, { upsert: true });
  }
  console.log(`✅ ${SLOTS.length} slots seeded`);

  for (const slot of SLOTS) {
    const isMorning = slot.StartHour >= 6 && slot.StartHour <= 17;
    await SlotPrice.updateOne(
      { SlotId: slot.SlotId, DayType: "Weekday" },
      { $set: { Price: isMorning ? DEFAULT_PRICES.weekdayMorning : DEFAULT_PRICES.weekdayEvening } },
      { upsert: true }
    );
    await SlotPrice.updateOne(
      { SlotId: slot.SlotId, DayType: "Weekend" },
      { $set: { Price: isMorning ? DEFAULT_PRICES.weekendMorning : DEFAULT_PRICES.weekendEvening } },
      { upsert: true }
    );
  }
  console.log("✅ Slot prices seeded");

  await Admin.updateOne(
    { Admin_ID: "AID001" },
    {
      $set: {
        Admin_ID: "AID001",
        Mail_ID: "admin@turf.com",
        Password_: "admin123",
        UPI: "admin@upi",
      },
    },
    { upsert: true }
  );
  console.log("✅ Default admin seeded (admin@turf.com / admin123)");

  await Counter.updateOne({ _id: "userId" }, { $setOnInsert: { seq: 0 } }, { upsert: true });
  await Counter.updateOne({ _id: "bookingId" }, { $setOnInsert: { seq: 0 } }, { upsert: true });
  await Counter.updateOne({ _id: "paymentId" }, { $setOnInsert: { seq: 0 } }, { upsert: true });
  console.log("✅ Counters initialized");

  console.log("🎉 Database seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
