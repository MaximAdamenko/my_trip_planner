import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/routeAuth.js";
import weatherRoutes from "./routes/weather.js";
import routeGen from "./routes/routeGen.js";
import routeLLM from "./routes/routeLLM.js";
import tripRoutes from "./routes/trips.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.get("/api/test", (req, res) => res.json({ ok: true, message: "API is working" }));
app.use("/api/auth", authRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/routes", routeGen);
app.use("/api/llm", routeLLM);
app.use("/api/trips", tripRoutes);

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const port = process.env.PORT || 3001;
    app.listen(port, () => console.log(`API on http://localhost:${port}`));
  } catch (e) {
    console.error("Failed to start server:", e.message);
    process.exit(1);
  }
};
start();
