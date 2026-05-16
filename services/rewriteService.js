/**
 * 内容改写与质检服务模块
 * 负责润色、扩写、缩写以及文章质量检测
 */

import ZhipuClient from "./zhipuClient.js";
import {
  getPolishPrompt,
  getExpandPrompt,
  getShortenPrompt,
  getQualityCheckPrompt,
} from "./prompts.js";

class RewriteService {
  constructor() {
    this.client = new ZhipuClient();
    this.model = "glm-4.5-air";
  }

  async rewriteContent(content, operation) {
    const operationMap = {
      polish: "润色优化",
      expand: "扩写丰富",
      shorten: "缩写精简",
    };

    let systemPrompt = "";
    let userPrompt = "";

    if (operation === "polish") {
      systemPrompt = "你是一个专业的文案润色助手。";
      userPrompt = getPolishPrompt(content);
    } else if (operation === "expand") {
      systemPrompt = "你是一个专业的文案扩写助手。";
      userPrompt = getExpandPrompt(content);
    } else if (operation === "shorten") {
      systemPrompt = "你是一个专业的文案缩写助手。";
      userPrompt = getShortenPrompt(content);
    } else {
      userPrompt = `请对以下内容进行${operationMap[operation] || operation}处理：\n\n${content}`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
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
      if (result.startsWith("```") && result.endsWith("```")) {
        result = result.slice(3, -3).trim();
      }

      return result || content;
    } catch (error) {
      console.error("改写内容失败:", error);
      throw new Error("改写内容失败: " + error.message);
    }
  }

  async fullQualityCheck(topic, outline, fullMarkdown) {
    let articleContent = fullMarkdown;
    // 简单的格式化逻辑（如果 fullMarkdown 为空，这里可以进一步扩展）
    if (!articleContent) {
      articleContent = JSON.stringify(outline);
    }

    const messages = [
      {
        role: "system",
        content:
          "你是一位专业的写作导师，擅长给出具体、可操作的改进建议。你必须返回严格的JSON格式。",
      },
      {
        role: "user",
        content: getQualityCheckPrompt(topic, articleContent),
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

      // 清理并解析 JSON
      result = result
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const jsonStart = result.indexOf("{");
      const jsonEnd = result.lastIndexOf("}");
      if (jsonStart > -1 && jsonEnd > jsonStart) {
        result = result.substring(jsonStart, jsonEnd + 1);
      }

      const evaluations = JSON.parse(result);

      // 确保分数在合理范围内
      [
        "structureScore",
        "contentScore",
        "logicScore",
        "qualityScore",
        "clarityScore",
      ].forEach((key) => {
        evaluations[key] = Math.min(20, Math.max(0, evaluations[key] || 0));
      });

      evaluations.totalScore =
        (evaluations.structureScore || 0) +
        (evaluations.contentScore || 0) +
        (evaluations.logicScore || 0) +
        (evaluations.qualityScore || 0) +
        (evaluations.clarityScore || 0);

      return evaluations;
    } catch (error) {
      console.error("质检失败:", error);
      throw new Error("质检失败: " + error.message);
    }
  }
}

export default RewriteService;
