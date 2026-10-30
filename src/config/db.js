const mongoose = require("mongoose");

async function connectToDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log("MongoDB connected");
  return mongoose.connection;
}

module.exports = connectToDB;
