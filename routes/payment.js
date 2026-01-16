const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const sql = require('mssql');
const { dbConfig } = require('../Config/dbconfig');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env. RAZORPAY_KEY_ID,
  key_secret:  process.env.RAZORPAY_KEY_SECRET
});

// GET /api/payment/info/: bookingId - Get payment info
router.get('/info/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log('[Payment Info] Request for:', bookingId);

    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('bookingId', sql.VarChar(10), bookingId)
      .query(`
        SELECT 
          PaymentId,
          BookingId,
          TotalAmount,
          AmountPaid,
          BalanceAmount,
          Status,
          UPI_ID,
          PaymentType
        FROM Payment
        WHERE BookingId = @bookingId;
      `);

    if (result.recordset.length === 0) {
      console.log('[Payment Info] ❌ Not found');
      return res.status(404).json({ error: 'Payment record not found' });
    }

    console.log('[Payment Info] ✅ Found:', result.recordset[0]);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('❌ Error fetching payment info:', err);
    res.status(500).json({ error: 'Failed to fetch payment info' });
  }
});

// POST /api/payment/create-order - Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { bookingId, paymentType } = req.body;
    console.log('[Create Order] Request:', { bookingId, paymentType });

    if (!bookingId || !paymentType) {
      return res. status(400).json({ error: 'bookingId and paymentType are required' });
    }

    // 1. Get payment details
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('bookingId', sql.VarChar(10), bookingId)
      .query(`
        SELECT TotalAmount, BalanceAmount, AmountPaid
        FROM Payment
        WHERE BookingId = @bookingId;
      `);

    if (result.recordset.length === 0) {
      console.log('[Create Order] ❌ Payment record not found');
      return res.status(404).json({ error: 'Payment record not found' });
    }

    const { TotalAmount, BalanceAmount, AmountPaid } = result. recordset[0];
    console.log('[Create Order] Payment Details:', { TotalAmount, BalanceAmount, AmountPaid });

    // 2. Calculate amount to pay
    let amountToPay;
    if (paymentType === 'Full') {
      amountToPay = BalanceAmount; // Pay remaining balance
    } else if (paymentType === 'Advance') {
      amountToPay = Math.round(TotalAmount * 0.2); // 20% advance
    } else {
      return res.status(400).json({ error: 'Invalid paymentType.  Must be "Full" or "Advance"' });
    }

    console.log('[Create Order] Amount to pay:', amountToPay);

    // 3. Create Razorpay order
    const options = {
      amount: Math.round(amountToPay * 100), // Convert to paise
      currency: 'INR',
      receipt: bookingId,
      notes: {
        bookingId,
        paymentType
      }
    };

    const order = await razorpay. orders.create(options);
    console.log('[Create Order] ✅ Razorpay order created:', order. id);

    // 4. Update payment type in database
    await pool.request()
      .input('bookingId', sql.VarChar(10), bookingId)
      .input('paymentType', sql.VarChar(20), paymentType)
      .query(`
        UPDATE Payment
        SET PaymentType = @paymentType
        WHERE BookingId = @bookingId;
      `);

    res.json({
      success: true,
      order:  {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      },
      amountToPay
    });

  } catch (err) {
    console.error('❌ Error creating Razorpay order:', err);
    res.status(500).json({ error: 'Failed to create payment order', details: err.message });
  }
});

// POST /api/payment/verify - Verify Razorpay payment
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
      amountPaid
    } = req.body;

    console.log('[Payment Verify] Request:', { razorpay_order_id, razorpay_payment_id, bookingId, amountPaid });

    if (!razorpay_order_id || !razorpay_payment_id || ! razorpay_signature || !bookingId || !amountPaid) {
      return res.status(400).json({ error: 'Missing required payment verification fields' });
    }

    // 1. Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('[Payment Verify] ❌ Signature mismatch');
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    console.log('[Payment Verify] ✅ Signature verified');

    // 2. Update payment in database
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input('bookingId', sql.VarChar(10), bookingId)
      .input('amountPaid', sql.Decimal(10, 2), amountPaid)
      .input('transactionId', sql.VarChar(20), razorpay_payment_id)
      .query(`
        UPDATE Payment
        SET 
          AmountPaid = AmountPaid + @amountPaid,
          TransactionId = @transactionId,
          PaymentDate = GETDATE()
        WHERE BookingId = @bookingId;
      `);

    console.log('[Payment Verify] ✅ Payment updated in database');

    res.json({
      success: true,
      message: 'Payment verified successfully'
    });

  } catch (err) {
    console.error('❌ Error verifying payment:', err);
    res.status(500).json({ error: 'Payment verification failed', details: err.message });
  }
});

module.exports = router;