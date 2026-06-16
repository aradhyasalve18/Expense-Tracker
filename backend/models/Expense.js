const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name:    { type: String, required: true, trim: true },
    amount:  { type: Number, required: true, min: 0.01 },
    category: {
      type: String,
      required: true,
      enum: ["Food","Transport","Shopping","Entertainment","Health","Utilities","Other"],
      default: "Other",
    },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);
