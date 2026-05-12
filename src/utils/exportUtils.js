import { chineseNumbers } from "../constants/chineseNumbers.js";

/**
 * 清理内容中重复的标题
 * @param {string} content - 文章内容
 * @param {string} title - 标题
 * @returns {string} - 清理后的内容
 */
const cleanDuplicateTitle = (content, title) => {
  if (!content || !title) return content;

  let cleaned = content.trim();

  const cleanForMatch = (text) => {
    return text.replace(/[、\(\)\[\]（）【】\.\,，。\s\-]/g, "").toLowerCase();
  };

  const targetTitleClean = cleanForMatch(title);

  const lines = cleaned.split("\n");
  const filteredLines = [];
  let removedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTrim = line.trim();
    let shouldSkip = false;

    if (i < 5 && removedCount < 2) {
      const isMarkdownTitle = lineTrim.startsWith("#");
      const lineContent = isMarkdownTitle
        ? lineTrim.replace(/^#+\s*/, "").trim()
        : lineTrim;
      const lineClean = cleanForMatch(lineContent);

      if (lineClean.length > 0 && targetTitleClean.length > 0) {
        if (
          lineClean.includes(targetTitleClean) ||
          targetTitleClean.includes(lineClean)
        ) {
          shouldSkip = true;
        }

        if (!shouldSkip) {
          const titleWords = title.split(/[、\s]+/);
          for (const word of titleWords) {
            if (word.length >= 2 && lineClean.includes(cleanForMatch(word))) {
              shouldSkip = true;
              break;
            }
          }
        }
      }
    }

    if (shouldSkip) {
      removedCount++;
      continue;
    }

    filteredLines.push(line);
  }

  cleaned = filteredLines.join("\n").trim();

  return cleaned;
};

/**
 * 生成完整的 Markdown 内容
 * @param {string} projectName - 项目名称
 * @param {Array} outline - 大纲数据
 * @returns {string} - Markdown 内容
 */
export const generateFullMarkdown = (projectName, outline) => {
  let markdown = "";

  if (projectName) {
    markdown += `# ${projectName}\n\n`;
  }

  const appendContent = (items, parentLevel = 0, parentIndex = []) => {
    items.forEach((item, index) => {
      const currentIndex = [...parentIndex, index];
      let heading = "";
      let title = "";

      if (currentIndex.length === 1) {
        const num = chineseNumbers[index] || index + 1;
        heading = "##";
        title = `${num}、${item.title}`;
      } else if (currentIndex.length === 2) {
        heading = "###";
        title = `(${index + 1}) ${item.title}`;
      } else {
        heading = "#".repeat(currentIndex.length + 1);
        title = item.title;
      }

      markdown += `${heading} ${title}\n\n`;

      if (item.content) {
        let content = cleanDuplicateTitle(item.content, item.title);
        if (content) {
          markdown += `${content}\n\n`;
        }
      }

      if (item.children && item.children.length > 0) {
        appendContent(item.children, parentLevel + 1, currentIndex);
      }
    });
  };

  appendContent(outline);

  return markdown;
};

/**
 * 导出 Markdown 文件
 * @param {string} projectName - 项目名称
 * @param {Array} outline - 大纲数据
 */
export const exportMarkdown = (projectName, outline) => {
  const markdown = generateFullMarkdown(projectName, outline);

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName || "document"}.md`;
  a.click();
  URL.revokeObjectURL(url);
};
