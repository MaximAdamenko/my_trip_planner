import mongoose from "mongoose";

const PointSchema = new mongoose.Schema(
  { lat: Number, lon: Number },
  { _id: false }
);

const TripSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["hike", "bike"], required: true },
    days: { type: Number, required: true },
    totalKm: { type: Number, required: true },
    center: { lat: Number, lon: Number },
    points: { type: [PointSchema], required: true }, // [{lat,lon}, ...]
  },
  { timestamps: true }
);

export default mongoose.model("Trip", TripSchema);
