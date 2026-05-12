/**
 * 清理标题中的数字前缀
 * @param {string} title - 原始标题
 * @returns {string} - 清理后的标题
 */
export const cleanTitleNumber = (title) => {
  return title.replace(/^[\d一二三四五六七八九十、.]+\s*/, "");
};

/**
 * 清理 markdown 标题符号
 * @param {string} title - 原始标题
 * @returns {string} - 清理后的标题
 */
export const cleanTitleMarkdown = (title) => {
  if (!title) return title;
  return title.replace(/^#+\s*/, "").trim();
};
