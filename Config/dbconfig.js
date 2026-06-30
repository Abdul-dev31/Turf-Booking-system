const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://ar687908_db_user:akuNPSusLFVoxFXU@cluster0.p54af07.mongodb.net/turf_booking?retryWrites=true&w=majority&appName=Cluster0";

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;

  console.log("🟡 Connecting to MongoDB...");
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log("✅ MongoDB connected successfully!");
    return mongoose.connection;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    throw err;
  }
}

function getDb() {
  return mongoose.connection.db;
}

module.exports = { connectDB, getDb, mongoose, MONGODB_URI };
