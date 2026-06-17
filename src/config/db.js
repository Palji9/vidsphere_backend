// ─────────────────────────────────────────────────────────────────────────
// db.js
// Sets up the connection to our MongoDB Atlas database using Mongoose.
// This file is imported once in server.js when the app starts.
// ─────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

// connectDB() is an async function because connecting to a database
// takes time (it's a network request to MongoDB Atlas servers).
const connectDB = async () => {
  try {
    // mongoose.connect() returns a promise that resolves once connected.
    // process.env.MONGODB_URI comes from our .env file (see .env.example).
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    // If connection fails (wrong URI, no internet, wrong password, etc.)
    // we log the error and stop the whole server — there's no point running
    // an app that can't talk to its database.
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1); // Exit code 1 = error
  }
};

export default connectDB;
