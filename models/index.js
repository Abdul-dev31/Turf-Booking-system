const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    User_ID: { type: String, required: true, unique: true },
    Mobile_Number: { type: String, required: true, unique: true },
    Name: { type: String, default: null },
  },
  { collection: "users" }
);

const sessionSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, unique: true },
    User_id: { type: String, required: true },
    expires: { type: Date, required: true },
  },
  { collection: "sessions" }
);

const otpSchema = new mongoose.Schema(
  {
    Mobile_Number: { type: String, required: true },
    OTP: { type: String, required: true },
    CreatedAt: { type: Date, default: Date.now },
    ExpiresAt: { type: Date, required: true },
  },
  { collection: "otps" }
);
otpSchema.index({ Mobile_Number: 1 });

const adminSchema = new mongoose.Schema(
  {
    Admin_ID: { type: String, required: true, unique: true },
    Mail_ID: { type: String, required: true, unique: true },
    Password_: { type: String, required: true },
    UPI: { type: String, default: null },
  },
  { collection: "admins" }
);

const slotSchema = new mongoose.Schema(
  {
    SlotId: { type: String, required: true, unique: true },
    Timing: { type: String, required: true },
    StartHour: { type: Number, required: true },
  },
  { collection: "slots" }
);

const slotPriceSchema = new mongoose.Schema(
  {
    SlotId: { type: String, required: true },
    DayType: { type: String, enum: ["Weekday", "Weekend"], required: true },
    Price: { type: Number, required: true },
  },
  { collection: "slot_prices" }
);
slotPriceSchema.index({ SlotId: 1, DayType: 1 }, { unique: true });

const bookingSchema = new mongoose.Schema(
  {
    BookingId: { type: String, required: true, unique: true },
    User_ID: { type: String, default: null },
    Admin_ID: { type: String, default: null },
    Name: { type: String, default: null },
    MobileNumber: { type: String, default: null },
    BookingDate: { type: String, required: true },
  },
  { collection: "bookings" }
);

const bookingSlotSchema = new mongoose.Schema(
  {
    BookingId: { type: String, required: true },
    SlotId: { type: String, required: true },
    BookingDate: { type: String, required: true },
  },
  { collection: "booking_slots" }
);
bookingSlotSchema.index({ BookingDate: 1, SlotId: 1 }, { unique: true });

const paymentSchema = new mongoose.Schema(
  {
    PaymentId: { type: String, required: true, unique: true },
    BookingId: { type: String, required: true, unique: true },
    TotalAmount: { type: Number, default: 0 },
    AmountPaid: { type: Number, default: 0 },
    BalanceAmount: { type: Number, default: 0 },
    Status: { type: String, default: "Pending" },
    UPI_ID: { type: String, default: null },
    PaymentType: { type: String, default: null },
    TransactionId: { type: String, default: null },
    PaymentDate: { type: Date, default: null },
  },
  { collection: "payments" }
);

const blockedSlotSchema = new mongoose.Schema(
  {
    SlotId: { type: String, required: true },
    BlockDate: { type: String, required: true },
    IsActive: { type: Boolean, default: true },
    LockedAt: { type: Date, default: Date.now },
    LockedBy: { type: String, default: null },
    LockReason: { type: String, default: null },
    UnlockedAt: { type: Date, default: null },
    UnlockedBy: { type: String, default: null },
    UnlockReason: { type: String, default: null },
  },
  { collection: "blocked_slots" }
);
blockedSlotSchema.index({ SlotId: 1, BlockDate: 1 }, { unique: true });

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: "counters" }
);

module.exports = {
  User: mongoose.model("User", userSchema),
  Session: mongoose.model("Session", sessionSchema),
  Otp: mongoose.model("Otp", otpSchema),
  Admin: mongoose.model("Admin", adminSchema),
  Slot: mongoose.model("Slot", slotSchema),
  SlotPrice: mongoose.model("SlotPrice", slotPriceSchema),
  Booking: mongoose.model("Booking", bookingSchema),
  BookingSlot: mongoose.model("BookingSlot", bookingSlotSchema),
  Payment: mongoose.model("Payment", paymentSchema),
  BlockedSlot: mongoose.model("BlockedSlot", blockedSlotSchema),
  Counter: mongoose.model("Counter", counterSchema),
};
