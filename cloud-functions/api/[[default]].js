import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import AIService from "./services/aiService.js";
import RewriteService from "./services/rewriteService.js";
import { createAiRoutes } from "./routes/ai.routes.js";
import healthRoutes from "./routes/health.routes.js";

const app = express();

console.log("🚀 EdgeOne Pages Cloud Functions 启动中...");

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
let initError = null;

try {
  aiService = new AIService();
  rewriteService = new RewriteService();
  console.log("✅ AI Services 初始化成功");
  console.log("📋 process.env 里的变量名:", Object.keys(process.env));
  if (process.env.ZHIPU_API_KEY) {
    console.log("✅ ZHIPU_API_KEY 存在（前10字符）:", process.env.ZHIPU_API_KEY.substring(0, 10) + "...");
  } else {
    console.log("❌ ZHIPU_API_KEY 不存在！");
  }
} catch (error) {
  initError = error.message;
  console.error("❌ AI Services 初始化失败:", error.message);
  console.error("❌ 错误堆栈:", error.stack);
}

// 健康检查路由（先挂载，不受 aiService 影响）
app.use("/health", healthRoutes);

// AI 相关路由（先检查是否初始化成功）
if (aiService && rewriteService) {
  app.use("/ai", createAiRoutes(aiService, rewriteService));
} else {
  app.use("/ai", (req, res) => {
    res.status(500).json({
      success: false,
      error: "AI 服务初始化失败",
      initError,
      envCheck: {
        hasKey: !!process.env.ZHIPU_API_KEY,
        keyLength: process.env.ZHIPU_API_KEY ? process.env.ZHIPU_API_KEY.length : 0
      }
    });
  });
}

console.log("✅ Express 应用已准备就绪");

export default app;