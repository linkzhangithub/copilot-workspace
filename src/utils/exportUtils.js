import { chineseNumbers } from "../constants/chineseNumbers.js";

export const generateFullMarkdown = (projectName, outline) => {
  let markdown = `# ${projectName}\n\n`;

  outline.forEach((section, index) => {
    const chapterNumber = chineseNumbers[index] || (index + 1).toString();
    markdown += `## ${chapterNumber}、${section.title}\n\n`;

    if (section.content) {
      markdown += `${section.content}\n\n`;
    }

    if (section.children && section.children.length > 0) {
      section.children.forEach((subsection, subIndex) => {
        markdown += `### (${subIndex + 1}) ${subsection.title}\n\n`;
        if (subsection.content) {
          markdown += `${subsection.content}\n\n`;
        }
      });
    }
  });

  return markdown;
};

export const exportMarkdown = (projectName, outline) => {
  const markdown = generateFullMarkdown(projectName, outline);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${projectName}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
