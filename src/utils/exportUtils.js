import { chineseNumbers } from "../constants/chineseNumbers.js";

/**
 * 清理内容中重复的标题
 * @param {string} content - 文章内容
 * @param {string} title - 标题
 * @returns {string} - 清理后的内容
 */
const cleanDuplicateTitle = (content, title) => {
  if (!content) return content;

  const titlePatterns = [
    new RegExp(`^#+\\s*${escapeRegExp(title)}\\s*\\n`, "i"),
    new RegExp(`^${escapeRegExp(title)}\\s*\\n`, "i"),
    new RegExp(`^\\d+\\.\\s*${escapeRegExp(title)}\\s*\\n`, "i"),
    new RegExp(`^[一二三四五六七八九十]+、\\s*${escapeRegExp(title)}\\s*\\n`, "i"),
  ];

  let cleanedContent = content;
  for (const pattern of titlePatterns) {
    cleanedContent = cleanedContent.replace(pattern, "");
  }

  return cleanedContent.trim();
};

/**
 * 转义正則表達式特殊字符
 * @param {string} string - 需要转义的字符串
 * @returns {string} - 转义后的字符串
 */
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
