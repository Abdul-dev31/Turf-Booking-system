require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const twilio = require("twilio");

const { connectDB } = require("./Config/dbconfig");
const { Admin } = require("./models");

const app = express();

const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://turfbooking1.netlify.app",
];
const envOrigins = [process.env.FRONTEND_URL, process.env.CORS_ALLOWED_ORIGINS]
  .flatMap((value) => (typeof value === "string" ? value.split(",") : []))
  .map((value) => value.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);
const localDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = origin ? origin.trim() : "";
      const allowed = !normalizedOrigin || allowedOrigins.has(normalizedOrigin) || localDevOrigin.test(normalizedOrigin);
      console.log(`CORS check origin=${origin} allowed=${allowed}`);
      if (allowed) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(express.json());

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const handleAdminLogin = async (req, res) => {
  const { Mail_ID, Password_ } = req.body;

  if (!Mail_ID || !Password_) {
    return res.status(400).json({ message: "Missing Email or Password" });
  }

  try {
    const admin = await Admin.findOne({
      Mail_ID,
      Password_,
    }).lean();

    if (admin) {
      res.json({ success: true, message: "Login Successful" });
    } else {
      res.status(401).json({ success: false, message: "Invalid Email or Password" });
    }
  } catch (err) {
    console.error("❌ Database Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

app.post("/adminlogin", handleAdminLogin);
app.post("/api/adminlogin", handleAdminLogin);

app.get("/", (req, res) => {
  res.json({
    message: "Turf Booking API is running (MongoDB)",
    endpoints: {
      adminLogin: "POST /adminlogin",
      sendOTP: "POST /api/send-otp",
      resendOTP: "POST /api/resend-otp",
      verifyOTP: "POST /api/verify-otp",
      sessionUser: "GET /api/session-user",
      logout: "POST /api/logout",
      status: "GET /api/status",
    },
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "Server is running",
    database: "MongoDB",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/twilio-status", (req, res) => {
  const twilioConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE
  );

  res.json({
    twilioConfigured,
    accountType: "Trial (can only send to verified numbers)",
    twilioPhone: process.env.TWILIO_PHONE || "Not configured",
    note: "Verify your phone at: https://www.twilio.com/console/phone-numbers/verified",
  });
});

app.use("/api", require("./routes/Forget"));
app.use("/api", require("./routes/price"));
app.use("/api", require("./routes/login"));
app.use("/api", require("./routes/otp"));
app.use("/api", require("./routes/booking"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api", require("./routes/slot"));
app.use("/api", require("./routes/adminRoutes"));
app.use("/api", require("./routes/adminSlotRoutes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await connectDB();
  } catch (err) {
    console.error("Failed to connect to MongoDB on startup");
  }
});
