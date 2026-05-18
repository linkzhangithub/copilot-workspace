import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import AIService from "../services/aiService.js";
import RewriteService from "../services/rewriteService.js";
import { createAiRoutes } from "../routes/ai.routes.js";
import healthRoutes from "../routes/health.routes.js";

const app = express();

// 打印环境变量检查
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

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
});
app.use("/api", limiter);

// 初始化 AI 服务
let aiService = null;
let rewriteService = null;
try {
  aiService = new AIService();
  rewriteService = new RewriteService();
  console.log("✅ AI Services 初始化成功");
} catch (error) {
  console.error("❌ AI Services 初始化失败:", error.message);
}

// 挂载路由
app.use("/api/ai", createAiRoutes(aiService, rewriteService));
app.use("/health", healthRoutes);

console.log("✅ Express 应用已准备就绪");

export default app;
