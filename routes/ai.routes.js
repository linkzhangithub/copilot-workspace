import express from "express";

const router = express.Router();

/**
 * AI 路由模块
 * 包含所有 AI 相关的 API 端点
 */

export function createAiRoutes(aiService, rewriteService) {
  // 生成大纲
  router.post("/generate-outline", async (req, res) => {
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
      res
        .status(500)
        .json({ success: false, error: "服务器内部错误，请稍后重试" });
    }
  });

  // 生成子章节
  router.post("/generate-subsections", async (req, res) => {
    try {
      const { topic, existingTitles = [] } = req.body;

      if (!topic || typeof topic !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "请提供有效的章节主题" });
      }

      console.log("正在生成子章节，主题:", topic);
      const subsections = await aiService.generateSubsections(
        topic,
        existingTitles,
      );
      console.log("子章节生成成功:", subsections.length, "个子章节");

      res.json({ success: true, data: subsections });
    } catch (error) {
      console.error("生成子章节失败:", error.message);
      res
        .status(500)
        .json({ success: false, error: "服务器内部错误，请稍后重试" });
    }
  });

  // 生成内容 (流式)
  router.post("/generate-content", async (req, res) => {
    try {
      const { outline, path, contextInfo } = req.body;

      if (!outline || !Array.isArray(outline)) {
        return res
          .status(400)
          .json({ success: false, error: "请提供有效的文章大纲" });
      }

      if (!path || !Array.isArray(path)) {
        return res
          .status(400)
          .json({ success: false, error: "请提供有效的路径" });
      }

      console.log("正在生成内容，path:", path, "contextInfo:", contextInfo);

      const sectionIndex = path[0];
      const response = await aiService.generateContent(
        outline,
        sectionIndex,
        contextInfo || {},
      );

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let isEnded = false;

      req.on("close", () => {
        if (!isEnded) {
          console.log("客户端断开连接，path:", path);
          isEnded = true;
          response.data.destroy();
        }
      });

      response.data.on("data", (chunk) => {
        if (isEnded) return;

        const chunkStr = chunk.toString("utf8");
        const lines = chunkStr.split("\n").filter((line) => line.trim());

        lines.forEach((line) => {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              res.write("data: [DONE]\n\n");
              if (!isEnded) {
                isEnded = true;
                res.end();
              }
            } else {
              try {
                const json = JSON.parse(data);
                const content = json.choices[0]?.delta?.content || "";
                if (content) {
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch (e) {
                console.warn("JSON 解析错误:", e.message);
              }
            }
          }
        });
      });

      response.data.on("end", () => {
        console.log("内容生成成功，path:", path);
        if (!isEnded) {
          isEnded = true;
          res.end();
        }
      });

      response.data.on("error", (error) => {
        console.error("流式响应错误:", error);
        if (!isEnded) {
          isEnded = true;
          res.write(
            `data: ${JSON.stringify({ error: "流式响应错误，请稍后重试" })}\n\n`,
          );
          res.end();
        }
      });
    } catch (error) {
      console.error("生成内容失败:", error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, error: "服务器内部错误，请稍后重试" });
      }
    }
  });

  // 通过完整path定位到章节的辅助函数
  const getSectionByPath = (outline, path) => {
    if (!Array.isArray(outline) || !Array.isArray(path) || path.length === 0) {
      throw new Error(
        "Invalid parameters: outline must be an array and path must be a non-empty array",
      );
    }

    let current = outline;
    for (let i = 0; i < path.length; i++) {
      const index = path[i];

      if (typeof index !== "number" || index < 0) {
        throw new Error(
          `Invalid path index at position ${i}: must be a non-negative number`,
        );
      }

      if (!Array.isArray(current) || index >= current.length) {
        throw new Error(
          `Path index out of bounds at position ${i}: ${index} >= ${current.length}`,
        );
      }

      if (i < path.length - 1) {
        if (
          !current[index].children ||
          !Array.isArray(current[index].children)
        ) {
          throw new Error(`No children found at path position ${i}`);
        }
        current = current[index].children;
      } else {
        current = current[index];
      }
    }
    return current;
  };

  // 生成内容 (非流式简化版)
  router.post("/generate-content-simple", async (req, res) => {
    try {
      const { outline, path, contextInfo } = req.body;

      if (!outline || !Array.isArray(outline)) {
        return res
          .status(400)
          .json({ success: false, error: "请提供有效的文章大纲" });
      }

      if (!path || !Array.isArray(path)) {
        return res
          .status(400)
          .json({ success: false, error: "请提供有效的路径" });
      }

      console.log("正在生成内容，path:", path, "contextInfo:", contextInfo);

      const {
        articleTopic = "",
        completedSections = [],
        usedKeyPoints = [],
        taskType = "first_generate",
        isFirstContent = false,
        positionDescription = "",
        isSubsection = false,
      } = contextInfo || {};

      const currentSection = getSectionByPath(outline, path);
      const sectionIndex = path[0];

      let completedContent = "";
      if (completedSections.length > 0) {
        completedContent = completedSections
          .map(
            (sec, i) =>
              `第${i + 1}章【${sec.title}】：${sec.contentSummary || "内容摘要未生成"}`,
          )
          .join("\n\n");
      }

      let forbiddenPoints = "";
      if (usedKeyPoints.length > 0) {
        forbiddenPoints = usedKeyPoints
          .map((point, i) => `${i + 1}. ${point}`)
          .join("\n");
      }

      let systemPrompt = "";
      let userPrompt = "";

      if (taskType === "first_generate") {
        systemPrompt = `你是一位专业的文章写作助手，擅长根据上下文创作出连贯、有逻辑的内容。

【核心写作原则】
1. **上下文连贯性**：用1-2句话自然承接上一章的结尾，为下一章做好铺垫
2. **严格避免重复**：绝对不要重复【已完成章节摘要】和【禁止重复关键点】中的任何内容
3. **逻辑递进**：每个章节都要有独特的新内容，不是前面的重复
4. **边界清晰**：专注于当前章节的主题，不越界讲其他章节的内容
5. **语言风格统一**：保持专业、一致的文风
6. **只返回正文**：不要任何标题、解释、说明文字，更不要描述你的思考过程

⚠️ 硬性约束：
- 开头1-2句必须是承接上一章的过渡句
- 绝对不要以#、##、###等markdown标题开头
- 不要重复当前章节的标题
- 不要添加任何解释说明，更不要说"我需要..."、"让我..."、"子主题为..."这类话
- 直接开始撰写正文内容

🚫 特别禁止（非常重要）：
- 如果不是第一章，绝对不要重新定义基本概念！
- 不要说"任务是指..."这种第一章已经讲过的话！
- 绝对不要输出你的思考过程、处理步骤或任何中间内容！
- 直接切入本章的独特内容！`;

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
子主题：${
          Array.isArray(currentSection.children)
            ? currentSection.children
                .map((child) =>
                  typeof child === "object" ? child.title : child,
                )
                .join("、")
            : "无"
        }

📌 本章专属任务：
- 专注于"${currentSection.title}"这个主题
- 讲出前面章节没讲过的新内容
- 体现出本章的独特价值

⚠️ 特别警告：
${isFirstContent ? "这是文章的第一个内容（第1章第1节），可以做基本定义。" : "这不是第一个内容！前面已经讲过基本概念，本章绝对不要重新定义！直接切入独特内容！"}

📍 当前位置：${positionDescription || "未知位置"}

✍️ 写作要求：
1. 开头先用1-2句话自然承接上一章
2. 绝对不要重复已讲过的内容
3. 内容要具体、有细节，避免空泛
4. 专注于本章主题，不越界
5. 结尾可以为下一章做轻微铺垫
6. 字数约300-500字

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
      } else {
        systemPrompt = `你是一位专业的文章写作助手，擅长根据上下文创作出连贯、有逻辑的内容。

【核心写作原则】
1. **上下文连贯性**：用1-2句话自然承接上一章的结尾，为下一章做好铺垫
2. **严格避免重复**：绝对不要重复【已完成章节摘要】和【禁止重复关键点】中的任何内容
3. **逻辑递进**：每个章节都要有独特的新内容，不是前面的重复
4. **边界清晰**：专注于当前章节的主题，不越界讲其他章节的内容
5. **语言风格统一**：保持专业、一致的文风
6. **只返回正文**：不要任何标题、解释、说明文字，更不要描述你的思考过程

⚠️ 硬性约束：
- 开头1-2句必须是承接上一章的过渡句
- 绝对不要以#、##、###等markdown标题开头
- 不要重复当前章节的标题
- 不要添加任何解释说明，更不要说"我需要..."、"让我..."、"子主题为..."这类话
- 直接开始撰写正文内容

🚫 特别禁止（非常重要）：
- 如果不是第一章，绝对不要重新定义基本概念！
- 不要说"任务是指..."这种第一章已经讲过的话！
- 绝对不要输出你的思考过程、处理步骤或任何中间内容！
- 直接切入本章的独特内容！`;

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
子主题：${
          Array.isArray(currentSection.children)
            ? currentSection.children
                .map((child) =>
                  typeof child === "object" ? child.title : child,
                )
                .join("、")
            : "无"
        }

📌 本章专属任务：
- 专注于"${currentSection.title}"这个主题
- 讲出前面章节没讲过的新内容
- 体现出本章的独特价值

⚠️ 特别警告：
${isFirstContent ? "这是文章的第一个内容（第1章第1节），可以做基本定义。" : "这不是第一个内容！前面已经讲过基本概念，本章绝对不要重新定义！直接切入独特内容！"}

📍 当前位置：${positionDescription || "未知位置"}

✍️ 写作要求：
1. 开头先用1-2句话自然承接上一章
2. 绝对不要重复已讲过的内容
3. 内容要具体、有细节，避免空泛
4. 专注于本章主题，不越界
5. 结尾可以为下一章做轻微铺垫
6. 字数约300-500字

直接返回正文内容，不要任何标题或解释！`;
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

      const response = await aiService.client.chatCompletions({
        model: aiService.model,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
        stream: false,
      });

      const message = response.data.choices[0]?.message;
      const content = message?.content || message?.reasoning_content || "";

      console.log("内容生成成功");
      res.json({ success: true, data: content });
    } catch (error) {
      console.error("生成内容失败:", error);
      res
        .status(500)
        .json({ success: false, error: "服务器内部错误，请稍后重试" });
    }
  });

  // 改写内容
  router.post("/rewrite", async (req, res) => {
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

      const result = await rewriteService.rewriteContent(content, operation);

      res.json({ success: true, data: result });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: "服务器内部错误，请稍后重试" });
    }
  });

  // 一次性获取所有5个维度的质检
  router.post("/quality-check-full", async (req, res) => {
    try {
      const { topic, outline, fullMarkdown } = req.body;

      if (!topic || typeof topic !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "请提供有效的文章主题" });
      }

      const result = await rewriteService.fullQualityCheck(
        topic,
        outline,
        fullMarkdown,
      );

      res.json({ success: true, data: result });
    } catch (error) {
      console.error("质检失败:", error.message);
      res
        .status(500)
        .json({ success: false, error: "服务器内部错误，请稍后重试" });
    }
  });

  // 单维度质检（保留用于兼容）
  router.post("/quality-check-single", async (req, res) => {
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
      res
        .status(500)
        .json({ success: false, error: "服务器内部错误，请稍后重试" });
    }
  });

  return router;
}
