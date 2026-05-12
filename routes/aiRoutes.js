import express from "express";
import AIService from "../services/aiService.js";

const router = express.Router();
const aiService = new AIService();

/**
 * 生成大纲 API
 */
router.post("/generate-outline", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的文章主题" });
    }

    console.log("正在生成大纲，主题:", topic);
    const outline = await aiService.generateOutline(topic);
    console.log("大纲生成成功:", outline.length, "个章节");

    res.json({ success: true, data: outline });
  } catch (error) {
    console.error("生成大纲失败:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 生成子章节 API
 */
router.post("/generate-subsections", async (req, res) => {
  try {
    const { topic, existingTitles = [] } = req.body;

    if (!topic || typeof topic !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的章节主题" });
    }

    console.log("正在生成子章节，主题:", topic);
    const subSections = await aiService.generateSubsections(
      topic,
      existingTitles,
    );
    console.log("子章节生成成功:", subSections.length, "个小节");

    res.json({ success: true, data: subSections });
  } catch (error) {
    console.error("生成子章节失败:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 生成内容 API (SSE)
 */
router.post("/generate-content", async (req, res) => {
  try {
    const { topic, chapterTitle, subsectionTitle, context } = req.body;

    if (!topic || !chapterTitle || !subsectionTitle) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数：topic, chapterTitle, subsectionTitle",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    await aiService.generateContentStream(
      topic,
      chapterTitle,
      subsectionTitle,
      context,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      },
    );

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("生成内容失败:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * 优化内容 API (SSE)
 */
router.post("/optimize-content", async (req, res) => {
  try {
    const { content, type } = req.body;

    if (!content || !type) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数：content, type",
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    await aiService.optimizeContentStream(content, type, (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("优化内容失败:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * 质检 API
 */
router.post("/quality-check-full", async (req, res) => {
  try {
    const { topic, outline, fullMarkdown } = req.body;

    if (!topic || !outline || !fullMarkdown) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数：topic, outline, fullMarkdown",
      });
    }

    console.log("正在进行智能质检，主题:", topic);
    const result = await aiService.fullQualityCheck(
      topic,
      outline,
      fullMarkdown,
    );
    console.log("质检完成");

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("质检失败:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
