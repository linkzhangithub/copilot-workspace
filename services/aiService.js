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
        content: "你是一个专业的文案撰写助手，擅长根据大纲撰写详细的文章内容。",
      },
      {
        role: "user",
        content: `根据以下文章大纲和上下文，撰写第${sectionIndex + 1}部分的正文内容：\n\n文章主题上下文：${context || "无"}\n\n当前章节：${currentSection.title}\n子主题：${currentSection.children?.join("、") || "无"}\n\n请撰写一段详细的正文内容，字数约300-500字。`,
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
}

export default AIService;
