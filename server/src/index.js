require("dotenv").config();
const mongoose = require("mongoose");
const app = require("./app");
const port = process.env.PORT || 5000;

if (!process.env.MONGODB_URI) {
  console.error("Set MONGODB_URI in server/.env");
  process.exit(1);
}
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() =>
    app.listen(port, () =>
      console.log(`API running on http://localhost:${port}`),
    ),
  )
  .catch((e) => {
    console.error("MongoDB connection failed:", e.message);
    process.exit(1);
  });
