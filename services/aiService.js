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
          "你是专业内容策划师，输出纯JSON数组，不要包含markdown代码块标记，不要添加任何解释文字。",
      },
      {
        role: "user",
        content: `主题：${topic}。输出格式：[{"title":"章节标题","children":["子点1","子点2"]}]`,
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
        return parsed.map((item) => ({
          title: String(item.title || item.chapter || item.name || item.section || item.章节 || ""),
          children: item.children || item.subpoints || item.sections || item.points || item.items || item.子点 || item.子主题 || []
        }));
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

    const messages = [
      {
        role: "system",
        content:
          "你是一个专业的文案润色助手，擅长对文章进行各种类型的改写处理。",
      },
      {
        role: "user",
        content: `请对以下内容进行${operationDesc}处理：\n\n${content}\n\n请直接返回改写后的内容。`,
      },
    ];

    try {
      const response = await this.client.chatCompletions({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const message = response.data.choices[0]?.message;
      const result = message?.content || message?.reasoning_content || "";
      return result || content;
    } catch (error) {
      console.error("改写内容失败:", error);
      throw new Error("改写内容失败: " + error.message);
    }
  }
}

export default AIService;
