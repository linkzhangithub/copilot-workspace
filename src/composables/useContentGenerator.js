import { ref, computed, nextTick, onUnmounted } from "vue";
import { chineseNumbers } from "../constants/chineseNumbers.js";
import { deepClone } from "../utils/deepClone.js";

export const useContentGenerator = (options) => {
  const { outline, articleTopic, emit } = options;

  const generatingPath = ref(null);
  const operatingPath = ref(null);
  const currentOperation = ref("");
  const textareaHeights = ref({});
  const isMobile = ref(false);
  const MOBILE_MAX_HEIGHT = 500;

  const checkIsMobile = () => {
    isMobile.value = window.innerWidth <= 768;
  };

  const autoResizeTextarea = (path) => {
    if (!isMobile.value) return;
    const pathKey = getPathKey(path);
    const textarea = document.querySelector(`[data-path="${pathKey}"]`);
    if (textarea) {
      textarea.style.height = "auto";
      const contentHeight = textarea.scrollHeight;
      if (contentHeight <= MOBILE_MAX_HEIGHT) {
        textarea.style.height = contentHeight + "px";
        textarea.style.overflowY = "hidden";
      } else {
        textarea.style.height = MOBILE_MAX_HEIGHT + "px";
        textarea.style.overflowY = "scroll";
      }
    }
  };

  const typeWriterCancelFns = ref([]);

  const typeWriter = async (fullText, onUpdate, speed = 30) => {
    return new Promise((resolve) => {
      let index = 0;
      let currentText = "";
      let cancelled = false;
      const timeoutIds = [];

      const type = () => {
        if (cancelled) {
          timeoutIds.forEach((id) => clearTimeout(id));
          return;
        }

        if (index < fullText.length) {
          const charsToType = Math.min(3, fullText.length - index);
          currentText += fullText.slice(index, index + charsToType);
          index += charsToType;
          onUpdate(currentText);
          const randomDelay = speed + Math.random() * 20;
          const timeoutId = setTimeout(type, randomDelay);
          timeoutIds.push(timeoutId);
        } else {
          resolve();
        }
      };

      const cancel = () => {
        cancelled = true;
        timeoutIds.forEach((id) => clearTimeout(id));
      };

      typeWriterCancelFns.value.push(cancel);
      type();
      resolve.cancel = cancel;
    });
  };

  onUnmounted(() => {
    typeWriterCancelFns.value.forEach((cancel) => cancel());
    typeWriterCancelFns.value = [];
  });

  const flatContent = computed(() => {
    const result = [];
    const flatten = (items, path = [], level = 0) => {
      items.forEach((item, index) => {
        const currentPath = [...path, index];
        result.push({ ...item, path: currentPath, level });
        if (item.children?.length > 0) {
          flatten(item.children, currentPath, level + 1);
        }
      });
    };
    flatten(outline.value);
    return result;
  });

  const getPathKey = (path) => path.join("-");

  const getSectionByPath = (outlineData, path) => {
    let current = outlineData;
    for (let i = 0; i < path.length; i++) {
      if (i < path.length - 1) {
        current = current[path[i]].children;
      } else {
        current = current[path[i]];
      }
    }
    return current;
  };

  const updateSectionByPath = (path, content) => {
    const newOutline = deepClone(outline.value);
    let current = newOutline;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children;
    }
    current[path[path.length - 1]] = {
      ...current[path[path.length - 1]],
      content,
    };
    emit("update:outline", newOutline);
  };

  const cleanDuplicateTitleInContent = (content, title) => {
    if (!content) return content;
    let cleaned = content.trim();
    const lines = cleaned.split("\n");
    const filteredLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTrim = line.trim();
      if (i < 3) {
        if (lineTrim.startsWith("#")) continue;
        if (title && lineTrim.length > 0) {
          const similarity = calculateSimilarity(lineTrim, title);
          if (similarity > 0.8) continue;
        }
      }
      filteredLines.push(line);
    }
    cleaned = filteredLines.join("\n").trim();
    return cleaned;
  };

  const calculateSimilarity = (str1, str2) => {
    const s1 = str1.toLowerCase().replace(/\s/g, "");
    const s2 = str2.toLowerCase().replace(/\s/g, "");
    if (s1.length === 0 || s2.length === 0) return 0;
    let matches = 0;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
  };

  const getDisplayNumber = (path) => {
    if (path.length === 1) return chineseNumbers[path[0]] + "、";
    if (path.length === 2) return "(" + (path[1] + 1) + ")";
    return path[2] + 1 + ")";
  };

  const getOperationDesc = (op) => {
    const map = {
      polish: "润色中",
      expand: "扩写中",
      shorten: "缩写中",
      regenerate: "重新生成中",
    };
    return map[op] || "处理中";
  };

  const generateContentSummary = (content) => {
    if (!content || typeof content !== "string") return "内容为空";
    return content.substring(0, 100) + (content.length > 100 ? "..." : "");
  };

  const extractKeyPoints = (content) => {
    if (!content || typeof content !== "string") return [];
    const keyPoints = [];
    const sentences = content
      .split(/[。！？.!?]/)
      .filter((s) => s.trim().length > 10);
    sentences.slice(0, 3).forEach((sentence) => {
      if (sentence.trim().length > 15) {
        keyPoints.push(sentence.trim().substring(0, 50) + "...");
      }
    });
    return keyPoints;
  };

  const buildContextInfo = (
    path,
    taskType = "first_generate",
    originalContent = "",
  ) => {
    const completedSections = [];
    const usedKeyPoints = [];
    const isSubsection = path.length > 1;
    const mainSectionIndex = path[0];

    for (let i = 0; i < mainSectionIndex; i++) {
      const section = outline.value[i];
      if (section?.content) {
        completedSections.push({
          title: section.title,
          contentSummary: generateContentSummary(section.content),
        });
        usedKeyPoints.push(...extractKeyPoints(section.content));
      }
    }

    if (isSubsection && outline.value[mainSectionIndex]) {
      const mainSection = outline.value[mainSectionIndex];
      if (mainSection.children?.length > 0) {
        for (let i = 0; i < path[path.length - 1]; i++) {
          const subsection = mainSection.children[i];
          if (subsection?.content) {
            completedSections.push({
              title: subsection.title,
              contentSummary: generateContentSummary(subsection.content),
            });
            usedKeyPoints.push(...extractKeyPoints(subsection.content));
          }
        }
      }
    }

    const positionDescription = isSubsection
      ? `第${mainSectionIndex + 1}章第${path[path.length - 1] + 1}小节`
      : `第${mainSectionIndex + 1}章`;

    const isFirstContent =
      mainSectionIndex === 0 && (!isSubsection || path[path.length - 1] === 0);

    return {
      articleTopic: articleTopic.value,
      completedSections,
      usedKeyPoints: usedKeyPoints.slice(0, 8),
      taskType,
      originalContent,
      positionDescription,
      isFirstContent,
      isSubsection,
      path,
    };
  };

  const scrollToSection = (path) => {
    const pathKey = getPathKey(path);
    const sectionElement = document.getElementById(`section-${pathKey}`);
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return {
    generatingPath,
    operatingPath,
    currentOperation,
    textareaHeights,
    isMobile,
    checkIsMobile,
    autoResizeTextarea,
    typeWriter,
    flatContent,
    getPathKey,
    getSectionByPath,
    updateSectionByPath,
    cleanDuplicateTitleInContent,
    calculateSimilarity,
    getDisplayNumber,
    getOperationDesc,
    generateContentSummary,
    extractKeyPoints,
    buildContextInfo,
    scrollToSection,
  };
};
