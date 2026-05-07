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
        content:
          "你是专业内容策划师，输出纯JSON数组，不要包含markdown代码块标记，不要添加任何解释文字。\n要求：\n1. 只生成4-8个不重复的主标题\n2. 主标题要简洁，适合作为文章的章节\n3. 每个主标题的children可以为空或者有少量子点",
      },
      {
        role: "user",
        content: `主题：${topic}。输出格式：[{"title":"章节标题","children":["子点1","子点2"]}]，注意只输出JSON数组，不要其他文字。`,
      },
    ];

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 2000,
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
        const outline = parsed.map((item) => ({
          title: String(
            item.title ||
              item.chapter ||
              item.name ||
              item.section ||
              item.章节 ||
              "",
          ),
          children:
            item.children ||
            item.subpoints ||
            item.sections ||
            item.points ||
            item.items ||
            item.子点 ||
            item.子主题 ||
            [],
        }));

        // 去重
        const seen = new Set();
        const deduplicated = [];
        for (const item of outline) {
          const titleKey = item.title.trim().toLowerCase();
          if (!seen.has(titleKey)) {
            seen.add(titleKey);
            deduplicated.push(item);
          }
        }

        // 限制数量
        const limited = deduplicated.slice(0, 8);
        return limited;
      }

      return [];
    } catch (error) {
      console.error("生成大纲失败:", error);
      throw new Error("生成大纲失败: " + error.message);
    }
  }

  /**
   * 生成章节内容 - 增强版
   * @param {Array} outline - 完整文章大纲
   * @param {number} sectionIndex - 当前章节索引
   * @param {Object} contextInfo - 上下文信息
   */
  async generateContent(outline, sectionIndex, contextInfo = {}) {
    if (!outline || !Array.isArray(outline) || sectionIndex >= outline.length) {
      throw new Error("无效的大纲或段落索引");
    }

    const currentSection = outline[sectionIndex];
    
    // 构建完整的上下文信息
    const {
      articleTopic = "",
      completedSections = [], // 前面已完成的章节（包含标题和内容摘要）
      usedKeyPoints = [], // 已经提到过的关键信息（避免重复）
      taskType = "first_generate" // first_generate / polish / expand / shorten
    } = contextInfo;

    // 构建已完成章节信息
    let completedContent = "";
    if (completedSections.length > 0) {
      completedContent = completedSections
        .map(
          (sec, i) =>
            `第${i + 1}章【${sec.title}】：${sec.contentSummary || "内容摘要未生成"}`
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
          "你是一位资深的文章质量评估专家。你必须返回严格的JSON格式，不能有任何其他文字。",
      },
      {
        role: "user",
        content: `${articleContent}

请从以下5个维度评价这篇文章：

【评价要求】
- 每个维度用50字以内概括评价
- 每个维度给出0-20分的分数（满分20分）

【输出格式】
必须严格按照以下JSON格式输出，不要添加任何其他文字：
{
  "structure": "大纲结构评价",
  "content": "章节内容评价",
  "logic": "逻辑严密性评价",
  "quality": "内容质量评价",
  "clarity": "表达清晰度评价",
  "structureScore": 15,
  "contentScore": 16,
  "logicScore": 14,
  "qualityScore": 15,
  "clarityScore": 17
}`,
      },
    ];

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: 0.1,
        max_tokens: 1000,
      });

      const message = response.data.choices[0]?.message;
      let result = message?.content || message?.reasoning_content || "";

      // 清理返回内容，只保留JSON
      result = result.trim();
      result = result
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .replace(/`{1,2}/g, "")
        .trim();
      
      // 提取JSON部分
      const jsonStart = result.indexOf("{");
      const jsonEnd = result.lastIndexOf("}");
      if (jsonStart > -1 && jsonEnd > jsonStart) {
        result = result.substring(jsonStart, jsonEnd + 1);
      }

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
        comment: ""
      };

      // 尝试解析JSON
      try {
        const parsed = JSON.parse(result);
        
        evaluations.structure = parsed.structure || evaluations.structure;
        evaluations.content = parsed.content || evaluations.content;
        evaluations.logic = parsed.logic || evaluations.logic;
        evaluations.quality = parsed.quality || evaluations.quality;
        evaluations.clarity = parsed.clarity || evaluations.clarity;
        
        evaluations.structureScore = Math.min(20, Math.max(0, parsed.structureScore || 0));
        evaluations.contentScore = Math.min(20, Math.max(0, parsed.contentScore || 0));
        evaluations.logicScore = Math.min(20, Math.max(0, parsed.logicScore || 0));
        evaluations.qualityScore = Math.min(20, Math.max(0, parsed.qualityScore || 0));
        evaluations.clarityScore = Math.min(20, Math.max(0, parsed.clarityScore || 0));
        

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
