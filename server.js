import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import AIService from "./services/aiService.js";
import RewriteService from "./services/rewriteService.js";
import { createAiRoutes } from "./routes/ai.routes.js";
import healthRoutes from "./routes/health.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
const envPath = "./.env";
if (fs.existsSync(envPath)) {
  const result = config({ path: envPath });
  if (result.error) {
    console.error("加载 .env 文件失败:", result.error);
  } else {
    // 仅在开发环境打印配置信息
    if (process.env.NODE_ENV !== "production") {
      console.log(".env 文件加载成功");
    }
  }
} else {
  console.warn(".env 文件不存在");
}

const app = express();
const PORT = process.env.PORT || 3000;

const isProduction = process.env.NODE_ENV === "production";

// CORS 配置
const corsOptions = {
  origin: !isProduction
    ? [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
      ]
    : true,
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(
  express.json({
    type: ["application/json", "application/*+json"],
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 速率限制配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟窗口
  max: 50, // 每个IP最多50次请求
  standardHeaders: true, // 返回 RateLimit-* 头部
  legacyHeaders: false,
  message: {
    success: false,
    error: "请求过于频繁，请稍后再试",
  },
  // 跳过健康检查端点
  skip: (req) => req.path === "/health",
});

// 应用速率限制到所有 /api 路由
app.use("/api", limiter);

// 初始化 AI 服务
let aiService = null;
let rewriteService = null;
try {
  aiService = new AIService();
  rewriteService = new RewriteService();
  if (!isProduction) {
    console.log("AI Services 初始化成功");
  }
} catch (error) {
  console.error("AI Services 初始化失败:", error.message);
  process.exit(1);
}

// 挂载路由
app.use("/api/ai", createAiRoutes(aiService, rewriteService));
app.use(healthRoutes);

// 生产环境：提供前端静态文件
if (isProduction) {
  const distPath = path.join(__dirname, "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // SPA 路由支持：所有非 API 请求返回 index.html
    app.get("*", (req, res, next) => {
      if (!req.path.startsWith("/api")) {
        res.sendFile(path.join(distPath, "index.html"));
      } else {
        next();
      }
    });

    console.log("✅ 前端静态文件服务已启用");
  } else {
    console.warn("⚠️  dist 目录不存在，请先运行 npm run build");
  }
}

// 启动服务器（仅在本地运行时启动，EdgeOne 部署时不需要
if (
  process.env.NODE_ENV !== "edgeone" &&
  process.env.NODE_ENV !== "production"
) {
  const server = app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });

  // 错误处理
  server.on("error", (error) => {
    console.error("服务器错误:", error.message);
  });

  // 未捕获异常 - 记录错误但不立即退出，让进程管理器决定重启策略
  process.on("uncaughtException", (error) => {
    console.error("未捕获的异常:", error.stack || error);
    // 优雅关闭：停止接收新请求
    server.close(() => {
      console.log("服务器已关闭");
      // 延迟退出，给正在处理的请求一些时间
      setTimeout(() => process.exit(1), 1000);
    });
    // 强制退出超时（5秒）
    setTimeout(() => process.exit(1), 5000).unref();
  });
}

// 未处理的 Promise 拒绝 - 记录错误但不退出进程
process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的 Promise 拒绝:", reason);
  // 不退出进程，只记录错误
  // 这样单个请求失败不会影响整个服务
});

// 导出 Express 应用（供 Node Functions 使用）
export default app;
