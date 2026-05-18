import { config } from "dotenv";
import AIService from "../../services/aiService.js";
import RewriteService from "../../services/rewriteService.js";

// 加载环境变量
config();

// 初始化 AI 服务
let aiService = null;
let rewriteService = null;
try {
  aiService = new AIService();
  rewriteService = new RewriteService();
} catch (error) {
  console.error("AI Services 初始化失败:", error.message);
}

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    const body = await request.json();

    let result;

    // 路由处理
    if (path === "/api/ai/health" || path === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        message: "AI Writing Assistant API is running",
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    } else if (path === "/api/ai/generate-outline") {
      result = await aiService.generateOutline(body.topic);
    } else if (path === "/api/ai/generate-content") {
      result = await aiService.generateContent(
        body.topic,
        body.chapterTitle,
        body.context
      );
    } else if (path === "/api/ai/continue-writing") {
      result = await aiService.continueWriting(body.content);
    } else if (path === "/api/ai/rewrite") {
      result = await rewriteService.rewrite(body.content, body.type);
    } else if (path === "/api/ai/expand") {
      result = await rewriteService.expand(body.content);
    } else if (path === "/api/ai/summarize") {
      result = await rewriteService.summarize(body.content);
    } else if (path === "/api/ai/optimize") {
      result = await rewriteService.optimize(body.content);
    } else if (path === "/api/ai/improve") {
      result = await rewriteService.improveWriting(body.content);
    } else if (path === "/api/ai/proofread") {
      result = await rewriteService.proofread(body.content);
    } else if (path === "/api/ai/quality-check-simple") {
      result = await rewriteService.simpleQualityCheck(body.content);
    } else if (path === "/api/ai/quality-check-full") {
      result = await rewriteService.fullQualityCheck(
        body.topic,
        body.outline,
        body.fullMarkdown
      );
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: "路由未找到"
      }), {
        headers: { "Content-Type": "application/json" },
        status: 404
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/ai/health" || path === "/health") {
    return new Response(JSON.stringify({
      status: "ok",
      message: "AI Writing Assistant API is running",
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  }

  return new Response(JSON.stringify({
    success: false,
    error: "请使用 POST 方法"
  }), {
    headers: { "Content-Type": "application/json" },
    status: 405
  });
}
