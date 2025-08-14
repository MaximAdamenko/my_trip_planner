import mongoose from "mongoose";

const PointSchema = new mongoose.Schema(
  { lat: Number, lon: Number },
  { _id: false }
);

const TripSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Untitled" },
    description: { type: String, default: "" },
    // store [ [lat, lon], ... ]
    points: {
      type: [[Number]],
      required: true,
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length >= 2 && arr.every(p => Array.isArray(p) && p.length === 2);
        },
        message: "points must be [[lat,lon], ...] with length >= 2",
      },
    },
    meta: {
      days: Number,
      type: { type: String }, // "hike" | "bike"
      totalKm: Number,
      breaks: [Number],
    },
    center: {
      lat: Number,
      lon: Number,
      name: String,
    },
    // OPTIONAL owner: present if a valid JWT was sent, otherwise null
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.model("Trip", TripSchema);
