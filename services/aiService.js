/**
 * AI 服务模块
 * 提供文章大纲生成、正文内容生成和改写功能
 */

import ZhipuClient from "./zhipuClient.js";

class AIService {
  constructor() {
    this.client = new ZhipuClient();
    this.model = "glm-4.5-air";
  }

  async generateOutline(topic) {
    const messages = [
      {
        role: "system",
        content: `你是专业的内容策划师，擅长设计逻辑严密、结构完整的文章大纲。

【核心任务】
根据文章主题，设计一份最优的大纲结构，确保内容层次清晰、逻辑递进。

【设计原则】
1. **章节独立性**：每个章节要有明确的主题边界，不与其他章节内容重叠
2. **小节具体性**：小节标题要具体、有实际内容，不是章节标题的简单重复
3. **逻辑递进**：章节之间要有自然的逻辑递进关系（从基础到深入，从概念到应用）
4. **内容完整**：根据主题需要，合理设置章节数量和小节数量
5. **结构合理**：如果适合，第一章节可包含引言/概述，最后一章节可包含总结/展望

【避免重复】
- 章节标题和小节标题不能相同或过于相似
- 不同章节的小节不能有重复内容
- 小节标题要体现该章节下的具体要点，而不是章节主题的重复

【输出格式】
纯JSON数组，不要markdown代码块标记，不要任何解释文字：
[
  {
    "title": "章节标题",
    "children": ["具体小节1", "具体小节2", "具体小节3"]
  }
]

【重要提示】
- children数组中的元素必须是字符串，不是对象
- 小节标题要具体、有针对性，避免空泛
- 确保每个小节都有独特的价值`,
      },
      {
        role: "user",
        content: `文章主题：${topic}

请为这篇文章设计一个最优的大纲结构，要求：
1. 根据主题需要，合理设置章节数量（建议4-8个章节）
2. 每个章节下设置合适数量的小节（建议2-5个小节）
3. 确保章节之间不重复，小节之间不重复
4. 小节标题要具体，体现该章节下的具体要点
5. 如果主题适合，包含引言和总结部分

直接输出JSON数组，不要任何其他文字。`,
      },
    ];

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 4000,
      });

      const message = response.data.choices[0]?.message;
      const content = message?.content || message?.reasoning_content || "";

      if (!content.trim()) {
        throw new Error("AI返回内容为空");
      }

      let jsonContent = content.trim();

      jsonContent = jsonContent
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .replace(/`{1,2}/g, "")
        .trim();

      const jsonStart = jsonContent.indexOf("[");
      const jsonEnd = jsonContent.lastIndexOf("]");

      if (jsonStart > -1 && jsonEnd > jsonStart) {
        jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1);
      }

      const parsed = JSON.parse(jsonContent);

      if (Array.isArray(parsed)) {
        const outline = parsed.map((item) => {
          const children = (
            item.children ||
            item.subpoints ||
            item.sections ||
            item.points ||
            item.items ||
            []
          )
            .map((child) => {
              if (typeof child === "string") {
                return child;
              } else if (child && typeof child === "object") {
                return child.title || child.name || "";
              }
              return "";
            })
            .filter((title) => title.length > 0);

          return {
            title: String(
              item.title || item.chapter || item.name || item.section || "",
            ),
            children: children,
          };
        });

        const seen = new Set();
        const deduplicated = [];
        for (const item of outline) {
          const titleKey = item.title.trim().toLowerCase();
          if (!seen.has(titleKey) && item.title.trim()) {
            seen.add(titleKey);
            deduplicated.push(item);
          }
        }

        console.log(`✅ 生成大纲：${deduplicated.length}个章节`);

        return deduplicated;
      }

      return [];
    } catch (error) {
      console.error("生成大纲失败:", error);
      throw new Error("生成大纲失败: " + error.message);
    }
  }

  // 通过完整path定位到章节
  getSectionByPath(outline, path) {
    if (!path || !Array.isArray(path)) {
      return outline[0]; // fallback
    }
    let current = outline;
    for (let i = 0; i < path.length; i++) {
      if (i < path.length - 1) {
        current = current[path[i]].children;
      } else {
        current = current[path[i]];
      }
    }
    return current;
  }

  /**
   * 生成章节内容 - 增强版
   * @param {Array} outline - 完整文章大纲
   * @param {number} sectionIndex - 当前章节索引（兼容用）
   * @param {Object} contextInfo - 上下文信息（包含path）
   */
  async generateContent(outline, sectionIndex, contextInfo = {}) {
    if (!outline || !Array.isArray(outline)) {
      throw new Error("无效的大纲");
    }

    // 优先从contextInfo.path定位，否则使用sectionIndex
    let currentSection;
    if (contextInfo.path && Array.isArray(contextInfo.path)) {
      currentSection = this.getSectionByPath(outline, contextInfo.path);
    } else {
      if (sectionIndex >= outline.length) {
        throw new Error("无效的段落索引");
      }
      currentSection = outline[sectionIndex];
    }

    // 构建完整的上下文信息
    const {
      articleTopic = "",
      completedSections = [], // 前面已完成的章节（包含标题和内容摘要）
      usedKeyPoints = [], // 已经提到过的关键信息（避免重复）
      taskType = "first_generate", // first_generate / polish / expand / shorten
      isFirstContent = false, // 是否是第一个内容（第1章第1节）
      positionDescription = "", // 位置描述，如"第1章第2小节"
      isSubsection = false, // 是否是子小节
    } = contextInfo;

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
              .map((child) => (typeof child === "object" ? child.title : child))
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

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: 0.7, // 稍降低温度，更稳定
        max_tokens: 1500, // 增加token上限
        stream: true,
      });

      return response;
    } catch (error) {
      console.error("生成正文失败:", error);
      throw new Error("生成正文失败: " + error.message);
    }
  }

  async rewriteContent(content, operation) {
    const operationMap = {
      polish: "润色优化",
      expand: "扩写丰富",
      shorten: "缩写精简",
    };

    const operationDesc = operationMap[operation] || operation;

    // 根据不同操作设置不同的prompt
    let systemPrompt = "你是一个专业的文案润色助手。";
    let userPrompt = "";

    if (operation === "polish") {
      systemPrompt =
        "你是一个专业的文案润色助手，擅长优化文章表达，使内容更流畅自然。";
      userPrompt = `请润色优化以下内容，保持原意，使表达更流畅专业：\n\n${content}\n\n直接返回润色后的内容，不要任何解释说明。`;
    } else if (operation === "expand") {
      systemPrompt =
        "你是一个专业的文案扩写助手，擅长在原文基础上适度扩展丰富内容，不要过于冗长。";
      userPrompt = `请适度扩写丰富以下内容，保持原文结构和核心观点，增加约30%-50%的内容量：\n\n${content}\n\n直接返回扩写后的内容，不要任何解释说明或规划。`;
    } else if (operation === "shorten") {
      systemPrompt =
        "你是一个专业的文案缩写助手，擅长提炼核心内容，使文章更简洁有力。";
      userPrompt = `请精简缩写以下内容，保留核心信息，删除冗余描述：\n\n${content}\n\n直接返回缩写后的内容，不要任何解释说明。`;
    } else {
      userPrompt = `请对以下内容进行${operationDesc}处理：\n\n${content}\n\n直接返回改写后的内容。`;
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

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: operation === "expand" ? 0.6 : 0.7,
        max_tokens: operation === "expand" ? 3000 : 2000,
      });

      const message = response.data.choices[0]?.message;
      let result = message?.content || message?.reasoning_content || "";

      // 清理可能的前置/后置内容
      result = result.trim();
      // 如果有markdown代码块标记，清理掉
      if (result.startsWith("```") && result.endsWith("```")) {
        result = result.slice(3, -3).trim();
      }

      return result || content;
    } catch (error) {
      console.error("改写内容失败:", error);
      throw new Error("改写内容失败: " + error.message);
    }
  }

  // 一次性获取所有5个维度的质检评价
  async fullQualityCheck(topic, outline, fullMarkdown) {
    // 优先使用 fullMarkdown，只有在没有 fullMarkdown 时才使用格式化大纲
    let articleContent;
    if (fullMarkdown && fullMarkdown.trim().length > 0) {
      console.log("✅ 使用完整的 Markdown 内容");
      articleContent = fullMarkdown;
    } else {
      console.log("⚠️ 没有 fullMarkdown，使用格式化大纲");
      articleContent = this.formatOutlineForCheck(outline);
    }

    const messages = [
      {
        role: "system",
        content:
          "你是一位专业的写作导师，擅长给出具体、可操作的改进建议。你必须返回严格的JSON格式，不能有任何其他文字。",
      },
      {
        role: "user",
        content: `【文章信息】
主题：${topic}
内容：
${articleContent}

【任务】请从以下5个维度评价这篇文章，并给出3条最优先的改进建议。

【评价要求】
- 每个维度用50字以内概括评价
- 每个维度给出0-20分的分数（满分20分）
- 生成3条优先改进建议，优先针对得分最低的维度

【建议要求】
1. 每条建议必须包含：问题描述+改进方向+可选示例
2. 建议按重要性从高到低排序
3. 每条建议控制在50-80字
4. 为每条建议分类：结构/内容/逻辑/表达/质量

【重要提示】
- 即使文章内容不完整，也要基于已有内容给出客观评价
- 必须严格按照JSON格式返回，不要添加任何其他文字
- 确保所有字段都有值，不要返回空字符串

【输出格式】
严格按照以下JSON格式输出：
{
  "structure": "大纲结构评价内容",
  "content": "章节内容评价内容",
  "logic": "逻辑严密性评价内容",
  "quality": "内容质量评价内容",
  "clarity": "表达清晰度评价内容",
  "structureScore": 15,
  "contentScore": 16,
  "logicScore": 14,
  "qualityScore": 15,
  "clarityScore": 17,
  "suggestions": [
    {
      "category": "结构",
      "priority": 1,
      "issue": "具体问题描述",
      "suggestion": "改进建议",
      "example": "修改示例（可选）"
    },
    {
      "category": "内容",
      "priority": 2,
      "issue": "具体问题描述",
      "suggestion": "改进建议",
      "example": "修改示例（可选）"
    },
    {
      "category": "逻辑",
      "priority": 3,
      "issue": "具体问题描述",
      "suggestion": "改进建议",
      "example": "修改示例（可选）"
    }
  ]
}`,
      },
    ];

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: 0.1,
        max_tokens: 2000,
      });

      const message = response.data.choices[0]?.message;
      let result = message?.content || message?.reasoning_content || "";

      console.log("=== AI 质检原始返回 ===");
      console.log("返回内容长度:", result.length);
      console.log("返回内容:", result);

      // 清理返回内容，只保留JSON
      result = result.trim();
      result = result
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .replace(/`{1,2}/g, "")
        .trim();

      console.log("清理后的内容:", result);

      // 提取JSON部分
      const jsonStart = result.indexOf("{");
      const jsonEnd = result.lastIndexOf("}");
      if (jsonStart > -1 && jsonEnd > jsonStart) {
        result = result.substring(jsonStart, jsonEnd + 1);
      }

      console.log("提取的JSON:", result);

      // 解析各个维度的评价和分数
      const evaluations = {
        structure: "",
        content: "",
        logic: "",
        quality: "",
        clarity: "",
        structureScore: 0,
        contentScore: 0,
        logicScore: 0,
        qualityScore: 0,
        clarityScore: 0,
        totalScore: 0,
        comment: "",
        suggestions: [],
      };

      // 尝试解析JSON
      try {
        const parsed = JSON.parse(result);

        evaluations.structure = parsed.structure || evaluations.structure;
        evaluations.content = parsed.content || evaluations.content;
        evaluations.logic = parsed.logic || evaluations.logic;
        evaluations.quality = parsed.quality || evaluations.quality;
        evaluations.clarity = parsed.clarity || evaluations.clarity;

        evaluations.structureScore = Math.min(
          20,
          Math.max(0, parsed.structureScore || 0),
        );
        evaluations.contentScore = Math.min(
          20,
          Math.max(0, parsed.contentScore || 0),
        );
        evaluations.logicScore = Math.min(
          20,
          Math.max(0, parsed.logicScore || 0),
        );
        evaluations.qualityScore = Math.min(
          20,
          Math.max(0, parsed.qualityScore || 0),
        );
        evaluations.clarityScore = Math.min(
          20,
          Math.max(0, parsed.clarityScore || 0),
        );

        // 处理建议，保持兼容性
        if (parsed.suggestions) {
          if (Array.isArray(parsed.suggestions)) {
            evaluations.suggestions = parsed.suggestions.map((s, index) => {
              if (typeof s === "string") {
                // 旧格式：纯字符串
                return {
                  category: "质量",
                  priority: index + 1,
                  issue: "",
                  suggestion: s,
                  example: "",
                };
              } else {
                // 新格式：结构化对象
                return {
                  category: s.category || "质量",
                  priority: s.priority || index + 1,
                  issue: s.issue || "",
                  suggestion: s.suggestion || s.text || "",
                  example: s.example || "",
                };
              }
            });
          }
        }
      } catch (e) {
        console.warn("解析JSON失败，使用默认值:", e);
        console.log("解析失败的原始内容:", result);
        console.log("========================================");
      }

      // 直接计算5个维度得分之和（每个维度20分，共100分）
      evaluations.totalScore =
        evaluations.structureScore +
        evaluations.contentScore +
        evaluations.logicScore +
        evaluations.qualityScore +
        evaluations.clarityScore;

      // 生成简单的评语
      if (evaluations.totalScore >= 85) {
        evaluations.comment = "文章优秀，继续保持！";
      } else if (evaluations.totalScore >= 70) {
        evaluations.comment = "文章良好，还有提升空间！";
      } else if (evaluations.totalScore >= 50) {
        evaluations.comment = "文章一般，需要继续完善！";
      } else {
        evaluations.comment = "继续努力，提升文章质量！";
      }

      console.log("解析后的评价:", evaluations);
      
      // 保存原始返回，便于调试
      evaluations._rawResponse = result;
      
      return evaluations;
    } catch (error) {
      console.error("质检失败:", error);
      throw new Error("质检失败: " + error.message);
    }
  }

  // 单维度质检（保留用于兼容）
  async singleDimensionCheck(topic, outline, fullMarkdown, dimension, prompt) {
    const dimensionPrompts = {
      structure: "大纲结构完整性",
      content: "章节内容充实度",
      logic: "逻辑严密性",
      quality: "内容质量",
      clarity: "表达清晰度",
    };

    const dimensionName = dimensionPrompts[dimension] || dimension;

    // 优先使用 fullMarkdown，只有在没有 fullMarkdown 时才使用格式化大纲
    let articleContent;
    if (fullMarkdown && fullMarkdown.trim().length > 0) {
      console.log("✅ 使用完整的 Markdown 内容");
      articleContent = fullMarkdown;
    } else {
      console.log("⚠️ 没有 fullMarkdown，使用格式化大纲");
      articleContent = this.formatOutlineForCheck(outline);
    }

    const messages = [
      {
        role: "system",
        content: "直接评价文章，不要解释你的思考过程。",
      },
      {
        role: "user",
        content: `${articleContent}

评价这篇文章的${dimensionName}。`,
      },
    ];

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 80,
      });

      const message = response.data.choices[0]?.message;
      let result = message?.content || message?.reasoning_content || "";
      result = result.trim();

      // 强力清理：去掉所有解释性内容
      // 去掉"用户让我"、"我需要"等开头
      let cleaned = result;
      const removePatterns = [
        /^用户让我[^。]*。?/,
        /^我需要[^。]*。?/,
        /^让我[^。]*。?/,
        /^首先[^。]*。?/,
        /^好的[^。]*。?/,
        /^这篇文章[^。]*。?/,
        /^评价这篇[^。]*。?/,
        /^任务是[^。]*。?/,
        /^我来[^。]*。?/,
        /^我会[^。]*。?/,
      ];

      for (const pattern of removePatterns) {
        cleaned = cleaned.replace(pattern, "").trim();
      }

      // 如果还是空，尝试取最后一句话
      if (!cleaned && result.includes("。")) {
        const sentences = result.split("。").filter((s) => s.trim());
        if (sentences.length > 0) {
          cleaned = sentences[sentences.length - 1].trim();
        }
      }

      // 截取前40字
      if (cleaned.length > 40) {
        cleaned = cleaned.substring(0, 40);
      }

      // 如果清理后还是没有内容，返回简单评价
      if (!cleaned) {
        cleaned = "文章内容需要完善。";
      }

      return cleaned;
    } catch (error) {
      console.error("质检失败:", error);
      throw new Error("质检失败: " + error.message);
    }
  }

  // 生成子章节
  async generateSubsections(topic, existingTitles = []) {
    const existingTitlesStr =
      existingTitles.length > 0 ? existingTitles.join("、") : "无";

    const messages = [
      {
        role: "system",
        content: `你是专业的内容策划师。请为给定的章节主题生成3-5个合适的子章节标题。

⚠️ 非常重要：
- 只返回标题本身，不要任何解释、说明或描述性文字
- 每个标题单独一行，不要编号
- 标题要简洁，10-15字左右
- 标题要具体，有实际内容
- 不要生成markdown格式
- 不要生成JSON格式
- 直接返回纯文本，每行一个标题

示例输出：
定义与概念
核心功能介绍
发展历史沿革
应用场景分析`,
      },
      {
        role: "user",
        content: `章节主题：${topic}

已有标题（请避免重复）：${existingTitlesStr}

请生成3-5个子章节标题，每行一个：`,
      },
    ];

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: 0.6,
        max_tokens: 300,
      });

      const message = response.data.choices[0]?.message;
      let content = message?.content || message?.reasoning_content || "";

      console.log("AI返回的子章节内容:", content);

      if (!content.trim()) {
        return ["要点一", "要点二", "要点三"];
      }

      // 按行分割
      let items = content
        .split(/[\n\r]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      // 更严格的过滤逻辑
      items = items.filter((item) => {
        // 1. 长度检查
        if (item.length < 3 || item.length > 30) return false;

        // 2. 过滤明显的提示词或说明文字（只过滤完整的提示词短语）
        const forbiddenPhrases = [
          "只返回",
          "不要任何",
          "每个标题",
          "单独一行",
          "不要编号",
          "标题简洁",
          "不要生成",
          "标题本身",
          "解释说明",
          "描述文字",
          "markdown",
          "JSON",
          "格式",
          "示例输出",
          "需要我",
          "请生成",
          "要求",
          "注意事项",
          "重要提示",
        ];

        // 检查是否包含明显的提示词内容
        const hasForbidden = forbiddenPhrases.some((phrase) =>
          item.toLowerCase().includes(phrase.toLowerCase()),
        );

        // 额外检查：如果标题看起来像是指令而非章节标题
        const looksLikeInstruction =
          item.startsWith("请") ||
          item.startsWith("需要") ||
          item.startsWith("你") ||
          item.startsWith("我") ||
          item.includes("返回") ||
          item.includes("生成") ||
          item.includes("不要") ||
          item.includes("注意");

        if (hasForbidden || looksLikeInstruction) {
          console.log("过滤掉提示词内容:", item);
          return false;
        }

        // 3. 过滤包含特殊标点的
        const hasSpecialPunctuation = /[、。：！？!?【】（）\[\]「」]/.test(
          item,
        );
        if (hasSpecialPunctuation) return false;

        // 4. 过滤"要点一"这样的占位标题
        if (item.match(/^要点[一二三四五六七八九十\d]+$/)) {
          console.log("过滤掉占位标题:", item);
          return false;
        }

        // 5. 标题应该是名词性短语，不是完整句子（不应该包含太多动词）
        const verbCount = (
          item.match(
            /是|有|在|做|为|用|能|要|会|可|就|也|都|很|最|更|还|而/gi,
          ) || []
        ).length;
        if (verbCount >= 2 && item.length > 15) return false;

        return true;
      });

      // 清理序号
      items = items.map((item) => item.replace(/^[\d.、\-\s\[\]]+/, "").trim());

      // 再次过滤空的和太短的
      items = items.filter((item) => item.length >= 3 && item.length <= 20);

      console.log("解析后的子章节:", items);

      if (items.length >= 2) {
        return items.slice(0, 5);
      }

      // 如果解析结果不好，返回更合理的fallback（基于主题生成）
      const defaultTitles = this.getDefaultSubsectionTitles(topic);
      console.log("使用默认子章节:", defaultTitles);
      return defaultTitles;
    } catch (error) {
      console.error("生成子章节失败:", error);
      // 出错时也返回基于主题的默认标题
      return this.getDefaultSubsectionTitles(topic);
    }
  }

  getDefaultSubsectionTitles(topic) {
    // 基于主题生成更合理的默认标题，而不是固定的"要点一"
    const commonPrefixes = [
      "核心概念",
      "主要功能",
      "应用场景",
      "实现原理",
      "技术要点",
    ];

    // 如果主题包含某些关键词，可以生成更贴合的标题
    let titles = [...commonPrefixes];

    if (topic.includes("数据") || topic.includes("分析")) {
      titles = ["数据来源", "分析方法", "指标设计", "可视化展示", "应用案例"];
    } else if (topic.includes("设计") || topic.includes("原则")) {
      titles = ["设计理念", "核心原则", "最佳实践", "常见错误", "优化方案"];
    } else if (topic.includes("技术") || topic.includes("实现")) {
      titles = ["技术架构", "核心模块", "实现流程", "关键技术", "性能优化"];
    }

    return titles.slice(0, 3);
  }

  // 格式化大纲用于质检
  formatOutlineForCheck(outline) {
    if (!outline || !Array.isArray(outline)) {
      return "无";
    }

    return outline
      .map((item, index) => {
        let line = `${index + 1}. ${item.title}`;
        if (item.children && item.children.length > 0) {
          // 安全地处理children，确保每个都是字符串
          const childrenTitles = item.children
            .map((child) => {
              if (typeof child === "string") {
                return child;
              } else if (child && typeof child === "object" && child.title) {
                return child.title;
              } else {
                return "";
              }
            })
            .filter(Boolean)
            .join("、");
          if (childrenTitles) {
            line += ` (${childrenTitles})`;
          }
        }
        if (item.content) {
          line += `\n   内容: ${item.content.substring(0, 100)}...`;
        }
        return line;
      })
      .join("\n");
  }
}

export default AIService;
