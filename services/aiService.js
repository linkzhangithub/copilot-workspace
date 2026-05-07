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

  async generateContent(outline, sectionIndex) {
    if (!outline || !Array.isArray(outline) || sectionIndex >= outline.length) {
      throw new Error("无效的大纲或段落索引");
    }

    const currentSection = outline[sectionIndex];
    const context = outline
      .slice(0, sectionIndex)
      .map((s) => s.title)
      .join(" → ");

    const messages = [
      {
        role: "system",
        content:
          "你是一个专业的文案撰写助手，擅长根据大纲撰写详细的文章内容。\n\n⚠️ 严格遵守以下规则：\n1. 只返回正文内容，绝对不要添加任何标题\n2. 不要以#、##、###等markdown标题开头\n3. 不要重复当前章节的标题\n4. 不要添加任何解释、说明或引导文字\n5. 直接开始撰写正文的第一句话\n6. 输出格式应该就是纯文本段落，不要任何markdown格式",
      },
      {
        role: "user",
        content: `根据以下文章大纲和上下文，撰写第${sectionIndex + 1}部分的正文内容：\n\n文章主题上下文：${context || "无"}\n\n当前章节：${currentSection.title}\n子主题：${currentSection.children?.join("、") || "无"}\n\n请撰写一段详细的正文内容，字数约300-500字。\n\n⚠️ 再次提醒：只返回纯文本正文，不要任何标题！`,
      },
    ];

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: 0.8,
        max_tokens: 1000,
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
          "你是一位资深的文章质量评估专家，擅长从多个维度精准评价文章优劣。请仔细阅读文章，深入分析后给出评价，评价要客观具体，有细节，语言简洁有力。不要解释你的思考过程，直接给出评价结果。",
      },
      {
        role: "user",
        content: `${articleContent}

请从以下5个维度评价这篇文章，每个维度用50字以内概括评价，并给出0-20分的分数（每个维度满分20分）：

1. 大纲结构
2. 章节内容
3. 逻辑严密性
4. 内容质量
5. 表达清晰度

请严格按照以下格式输出，不要改变顺序，不要添加额外解释：
1. 大纲结构：评价内容 | 分数
2. 章节内容：评价内容 | 分数
3. 逻辑严密性：评价内容 | 分数
4. 内容质量：评价内容 | 分数
5. 表达清晰度：评价内容 | 分数`,
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
      const result = message?.content || message?.reasoning_content || "";

      console.log("AI完整返回:", result);

      // 解析各个维度的评价和分数
      const evaluations = {
        structure: "文章结构需要完善。",
        content: "内容充实度需要提升。",
        logic: "文章逻辑需要优化。",
        quality: "内容质量有待提高。",
        clarity: "表达清晰度需要改进。",
        structureScore: 0,
        contentScore: 0,
        logicScore: 0,
        qualityScore: 0,
        clarityScore: 0,
        totalScore: 0,
        comment: "继续努力，提升文章质量！",
      };

      // 解析格式：1. 大纲结构：评价内容 | 分数
      const parsePattern = (tag) => {
        const regex = new RegExp(
          `\\d+\\.\\s*${tag}：(.*?)(?=\\n\\d+\\.|$)`,
          "s",
        );
        const match = result.match(regex);
        if (match && match[1]) {
          let text = match[1].trim();
          let score = 0;

          // 尝试分离评价内容和分数
          const parts = text.split("|");
          if (parts.length >= 2) {
            text = parts[0].trim();
            // 提取分数
            const scoreMatch = parts[1].match(/(\d+)/);
            if (scoreMatch) {
              score = Math.min(20, Math.max(0, parseInt(scoreMatch[1])));
            }
          } else {
            // 如果没有分数分隔符，尝试从文本末尾提取分数
            const scoreMatch = text.match(/(\d+)\s*分?\s*$/);
            if (scoreMatch) {
              score = Math.min(20, Math.max(0, parseInt(scoreMatch[1])));
              text = text.replace(/\d+\s*分?\s*$/, "").trim();
            }
          }

          // 清理评价
          text = text.replace(/\n/g, " ");
          if (text.length > 50) {
            text = text.substring(0, 50);
          }
          return { text, score };
        }
        return null;
      };

      const structureResult = parsePattern("大纲结构");
      if (structureResult) {
        evaluations.structure = structureResult.text;
        evaluations.structureScore = structureResult.score;
      }

      const contentResult = parsePattern("章节内容");
      if (contentResult) {
        evaluations.content = contentResult.text;
        evaluations.contentScore = contentResult.score;
      }

      const logicResult = parsePattern("逻辑严密性");
      if (logicResult) {
        evaluations.logic = logicResult.text;
        evaluations.logicScore = logicResult.score;
      }

      const qualityResult = parsePattern("内容质量");
      if (qualityResult) {
        evaluations.quality = qualityResult.text;
        evaluations.qualityScore = qualityResult.score;
      }

      const clarityResult = parsePattern("表达清晰度");
      if (clarityResult) {
        evaluations.clarity = clarityResult.text;
        evaluations.clarityScore = clarityResult.score;
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
