import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import AIService from "./services/aiService.js";
import RewriteService from "./services/rewriteService.js";
import { createAiRoutes } from "./routes/ai.routes.js";
import healthRoutes from "./routes/health.routes.js";

const app = express();

console.log("🚀 EdgeOne Pages Node Functions 启动中...");

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200,
}));
app.use(express.json({
  type: ["application/json", "application/*+json"],
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});
app.use(limiter);

let aiService = null;
let rewriteService = null;
try {
  aiService = new AIService();
  rewriteService = new RewriteService();
  console.log("✅ AI Services 初始化成功");
} catch (error) {
  console.error("❌ AI Services 初始化失败:", error.message);
}

app.use("/api/ai", createAiRoutes(aiService, rewriteService));
app.use("/api/health", healthRoutes);

console.log("✅ Express 应用已准备就绪");

export default app;