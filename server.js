import { config } from "dotenv";
import fs from "fs";
import express from "express";
import cors from "cors";
import AIService from "./services/aiService.js";

const envPath = "./.env";
if (fs.existsSync(envPath)) {
  const result = config({ path: envPath });
  if (result.error) {
    console.error("加载 .env 文件失败:", result.error);
  } else {
    console.log(".env 文件加载成功");
    console.log(
      "ZHIPU_API_KEY:",
      process.env.ZHIPU_API_KEY ? "已设置" : "未设置",
    );
  }
} else {
  console.warn(".env 文件不存在");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let aiService = null;
try {
  aiService = new AIService();
  console.log("AIService 初始化成功");
} catch (error) {
  console.error("AIService 初始化失败:", error.message);
  process.exit(1);
}

app.post("/api/ai/generate-outline", async (req, res) => {
  console.log("收到请求:", req.body);
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

app.post("/api/ai/generate-content", async (req, res) => {
  try {
    const { outline, sectionIndex, contextInfo } = req.body;

    if (!outline || !Array.isArray(outline)) {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的文章大纲" });
    }

    if (typeof sectionIndex !== "number" || sectionIndex < 0) {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的段落索引" });
    }

    const response = await aiService.generateContent(
      outline,
      sectionIndex,
      contextInfo || {},
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// 非流式简化版本 - 增强版
app.post("/api/ai/generate-content-simple", async (req, res) => {
  try {
    const { outline, sectionIndex, contextInfo } = req.body;

    if (!outline || !Array.isArray(outline)) {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的文章大纲" });
    }

    if (typeof sectionIndex !== "number" || sectionIndex < 0) {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的段落索引" });
    }

    console.log("正在生成内容，第", sectionIndex + 1, "节");

    // 构建完整的上下文信息
    const {
      articleTopic = "",
      completedSections = [], // 前面已完成的章节（包含标题和内容摘要）
      usedKeyPoints = [], // 已经提到过的关键信息（避免重复）
      taskType = "first_generate", // first_generate / polish / expand / shorten
    } = contextInfo || {};

    const currentSection = outline[sectionIndex];

    // 构建已完成章节信息
    let completedContent = "";
    if (completedSections.length > 0) {
      completedContent = completedSections
        .map(
          (sec, i) =>
            `第${i + 1}章【${sec.title}】：${sec.contentSummary || "内容摘要未生成"}`,
        )
        .join("\n\n");
    }

    // 构建禁止重复的关键点
    let forbiddenPoints = "";
    if (usedKeyPoints.length > 0) {
      forbiddenPoints = usedKeyPoints
        .map((point, i) => `${i + 1}. ${point}`)
        .join("\n");
    }

    // 根据任务类型设置不同的system prompt
    let systemPrompt = "";
    let userPrompt = "";

    if (taskType === "first_generate") {
      systemPrompt = `你是一位专业的文章写作助手，擅长根据上下文创作出连贯、有逻辑的内容。

【写作原则】
1. 上下文连贯性：自然承接上一章内容，为下一章做好铺垫
2. 避免重复：绝对不要重复【禁止重复的关键点】中列出的内容
3. 逻辑递进：内容要有层次感，从浅入深展开
4. 语言风格：保持统一、专业的文风
5. 只返回正文，不要任何标题、解释、说明

⚠️ 重要约束：
- 不要以#、##、###等markdown标题开头
- 不要重复当前章节的标题
- 不要添加任何解释说明文字
- 直接开始撰写正文的第一句话`;

      userPrompt = `【文章基本信息】
主题：${articleTopic || "未指定"}

【完整大纲】
${outline.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}

【已完成章节内容摘要】
${completedContent || "无（这是第一章）"}

【禁止重复的关键点】
${forbiddenPoints || "无"}

【当前任务】
正在撰写第${sectionIndex + 1}章
章节标题：${currentSection.title}
子主题：${currentSection.children?.join("、") || "无"}

请根据以上信息，撰写一段详细的正文内容（约300-500字）。
内容要求：
1. 自然承接上一章（如果有的话）
2. 不要重复【禁止重复的关键点】中提到的任何内容
3. 内容要具体、有细节，避免空泛
4. 为下一章做好逻辑铺垫

直接返回正文内容，不要任何标题或解释！`;
    } else if (taskType === "polish") {
      systemPrompt = `你是一位专业的文案润色助手。

【润色原则】
1. 保持原意：绝对不要改变原文的核心观点和内容
2. 优化表达：让语言更流畅、更专业、更生动
3. 避免重复：不要重复【禁止重复的关键点】中列出的内容
4. 风格统一：保持整体文风一致

⚠️ 只返回润色后的内容，不要任何解释说明！`;

      userPrompt = `【文章基本信息】
主题：${articleTopic || "未指定"}

【禁止重复的关键点】
${forbiddenPoints || "无"}

【原文内容】
${contextInfo.originalContent || ""}

请润色优化以上内容，使其更流畅、专业、有文采。
直接返回润色后的内容！`;
    } else if (taskType === "expand") {
      systemPrompt = `你是一位专业的文案扩写助手。

【扩写原则】
1. 保持结构：保留原文的段落结构和核心观点
2. 丰富内容：在原文基础上增加细节、案例、数据
3. 避免重复：不要重复【禁止重复的关键点】中列出的内容
4. 适度扩展：增加约30%-50%的内容量，不要过于冗长

⚠️ 只返回扩写后的内容，不要任何解释说明！`;

      userPrompt = `【文章基本信息】
主题：${articleTopic || "未指定"}

【禁止重复的关键点】
${forbiddenPoints || "无"}

【原文内容】
${contextInfo.originalContent || ""}

请在保持原意的基础上，适度扩展丰富以上内容。
可以增加具体案例、数据、细节说明等。
直接返回扩写后的内容！`;
    } else if (taskType === "shorten") {
      systemPrompt = `你是一位专业的文案缩写助手。

【缩写原则】
1. 保留核心：绝对保留原文的核心观点和关键信息
2. 精简冗余：删掉啰嗦、重复的表述
3. 逻辑清晰：保持原文的逻辑结构
4. 避免重复：不要重复【禁止重复的关键点】中列出的内容

⚠️ 只返回缩写后的内容，不要任何解释说明！`;

      userPrompt = `【文章基本信息】
主题：${articleTopic || "未指定"}

【禁止重复的关键点】
${forbiddenPoints || "无"}

【原文内容】
${contextInfo.originalContent || ""}

请精简缩写以上内容，保留核心观点，删除冗余表述。
直接返回缩写后的内容！`;
    }

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    // 使用非流式请求
    const response = await aiService.client.chatCompletions({
      model: aiService.model,
      messages,
      temperature: 0.7, // 稍降低温度，更稳定
      max_tokens: 1500, // 增加token上限
      stream: false,
    });

    const message = response.data.choices[0]?.message;
    const content = message?.content || message?.reasoning_content || "";

    console.log("内容生成成功");
    res.json({ success: true, data: content });
  } catch (error) {
    console.error("生成内容失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/ai/rewrite", async (req, res) => {
  try {
    const { content, operation } = req.body;

    if (!content || typeof content !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的内容" });
    }

    const validOperations = ["polish", "expand", "shorten"];
    if (!operation || !validOperations.includes(operation)) {
      return res.status(400).json({
        success: false,
        error: "请提供有效的操作类型（polish/expand/shorten）",
      });
    }

    const result = await aiService.rewriteContent(content, operation);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 一次性获取所有5个维度的质检API
app.post("/api/ai/quality-check-full", async (req, res) => {
  try {
    const { topic, outline, fullMarkdown } = req.body;

    if (!topic || typeof topic !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的文章主题" });
    }

    const result = await aiService.fullQualityCheck(
      topic,
      outline,
      fullMarkdown,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("质检失败:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 单维度质检API（保留用于兼容）
app.post("/api/ai/quality-check-single", async (req, res) => {
  try {
    const { topic, outline, fullMarkdown, dimension, prompt } = req.body;

    if (!topic || typeof topic !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的文章主题" });
    }

    if (!dimension || typeof dimension !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "请提供有效的质检维度" });
    }

    const result = await aiService.singleDimensionCheck(
      topic,
      outline,
      fullMarkdown,
      dimension,
      prompt,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("质检失败:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: { status: "ok", timestamp: new Date().toISOString() },
  });
});

const server = app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

// 添加错误处理，防止服务意外退出
server.on("error", (error) => {
  console.error("服务器错误:", error);
});

process.on("uncaughtException", (error) => {
  console.error("未捕获的异常:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的 Promise 拒绝:", reason);
});
