/**
 * AI 路由模块
 * 提供文章大纲生成、正文内容生成和改写功能
 */

import express from "express";
const router = express.Router();
import AIService from "../services/aiService.js";

const aiService = new AIService();

/**
 * @swagger
 * /api/ai/generate-outline:
 *   post:
 *     summary: 生成文章大纲
 *     description: 根据主题生成结构化的文章大纲
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topic:
 *                 type: string
 *                 description: 文章主题
 *     responses:
 *       200:
 *         description: 成功生成大纲
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       children:
 *                         type: array
 *                         items:
 *                           type: string
 */
router.post("/generate-outline", async (req, res) => {
  console.log("收到生成大纲请求:", req.body);
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== "string") {
      console.log("无效的主题:", topic);
      return res.status(400).json({
        success: false,
        error: "请提供有效的文章主题",
      });
    }

    console.log("正在生成大纲，主题:", topic);
    const outline = await aiService.generateOutline(topic);
    console.log("大纲生成成功:", outline.length, "个章节");

    res.json({
      success: true,
      data: outline,
    });
  } catch (error) {
    console.error("生成大纲失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/ai/generate-content:
 *   post:
 *     summary: 生成正文内容（流式）
 *     description: 根据大纲和段落索引生成正文内容，流式返回
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               outline:
 *                 type: array
 *                 description: 文章大纲
 *               sectionIndex:
 *                 type: number
 *                 description: 当前段落索引
 *     responses:
 *       200:
 *         description: 流式响应内容
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.post("/generate-content", async (req, res) => {
  try {
    const { outline, sectionIndex } = req.body;

    if (!outline || !Array.isArray(outline)) {
      return res.status(400).json({
        success: false,
        error: "请提供有效的文章大纲",
      });
    }

    if (typeof sectionIndex !== "number" || sectionIndex < 0) {
      return res.status(400).json({
        success: false,
        error: "请提供有效的段落索引",
      });
    }

    const response = await aiService.generateContent(outline, sectionIndex);

    // 设置流式响应头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // 处理流式数据
    response.data.on("data", (chunk) => {
      const chunkStr = chunk.toString("utf8");
      const lines = chunkStr.split("\n").filter((line) => line.trim());

      lines.forEach((line) => {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            res.end();
          } else {
            try {
              const json = JSON.parse(data);
              const content = json.choices[0]?.delta?.content || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });
    });

    response.data.on("end", () => {
      res.end();
    });

    response.data.on("error", (error) => {
      console.error("流式响应错误:", error);
      res.end();
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/ai/rewrite:
 *   post:
 *     summary: 改写内容
 *     description: 对内容进行润色、扩写或缩写
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: 需要改写的内容
 *               operation:
 *                 type: string
 *                 description: 操作类型（polish/expand/shorten）
 *                 enum: [polish, expand, shorten]
 *     responses:
 *       200:
 *         description: 成功改写
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: string
 */
router.post("/rewrite", async (req, res) => {
  try {
    const { content, operation } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({
        success: false,
        error: "请提供有效的内容",
      });
    }

    const validOperations = ["polish", "expand", "shorten"];
    if (!operation || !validOperations.includes(operation)) {
      return res.status(400).json({
        success: false,
        error: "请提供有效的操作类型（polish/expand/shorten）",
      });
    }

    const result = await aiService.rewriteContent(content, operation);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
