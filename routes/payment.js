const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { Payment } = require("../models");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

router.get("/info/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const payment = await Payment.findOne({ BookingId: bookingId }).lean();

    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    res.json(payment);
  } catch (err) {
    console.error("❌ Error fetching payment info:", err);
    res.status(500).json({ error: "Failed to fetch payment info" });
  }
});

router.post("/create-order", async (req, res) => {
  try {
    const { bookingId, paymentType } = req.body;

    if (!bookingId || !paymentType) {
      return res.status(400).json({ error: "bookingId and paymentType are required" });
    }

    const payment = await Payment.findOne({ BookingId: bookingId }).lean();
    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    const { TotalAmount, BalanceAmount } = payment;

    let amountToPay;
    if (paymentType === "Full") {
      amountToPay = BalanceAmount;
    } else if (paymentType === "Advance") {
      amountToPay = Math.round(TotalAmount * 0.2);
    } else {
      return res.status(400).json({ error: 'Invalid paymentType. Must be "Full" or "Advance"' });
    }

    const options = {
      amount: Math.round(amountToPay * 100),
      currency: "INR",
      receipt: bookingId,
      notes: { bookingId, paymentType },
    };

    const order = await razorpay.orders.create(options);

    await Payment.updateOne(
      { BookingId: bookingId },
      { $set: { PaymentType: paymentType } }
    );

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      amountToPay,
    });
  } catch (err) {
    console.error("❌ Error creating Razorpay order:", err);
    res.status(500).json({ error: "Failed to create payment order", details: err.message });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
      amountPaid,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId || !amountPaid) {
      return res.status(400).json({ error: "Missing required payment verification fields" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const payment = await Payment.findOne({ BookingId: bookingId });
    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    const paid = Number(amountPaid);
    payment.AmountPaid = Number(payment.AmountPaid) + paid;
    payment.BalanceAmount = Math.max(0, Number(payment.TotalAmount) - payment.AmountPaid);
    payment.TransactionId = razorpay_payment_id;
    payment.PaymentDate = new Date();
    payment.Status = payment.BalanceAmount <= 0 ? "Paid" : "Partial";

    await payment.save();

    res.json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (err) {
    console.error("❌ Error verifying payment:", err);
    res.status(500).json({ error: "Payment verification failed", details: err.message });
  }
});

module.exports = router;
