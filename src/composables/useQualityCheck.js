import { ref, computed, nextTick } from "vue";

/**
 * 质检相关逻辑的 Composable
 * @param {Object} options - 配置选项
 * @param {Function} options.generateFullMarkdown - 生成完整 Markdown 内容的函数
 * @param {Function} options.emit - Vue emit 函数
 * @param {Function} options.getIsGeneratingContent - 获取是否正在生成内容的函数
 * @param {Function} options.getOutline - 获取大纲数据的函数
 * @param {Function} options.getProjectName - 获取项目名称的函数
 * @param {Function} options.getProjectId - 获取项目 ID 的函数
 * @returns {Object} - 质检相关的状态和方法
 */
export const useQualityCheck = (options) => {
  const {
    generateFullMarkdown,
    emit,
    getIsGeneratingContent,
    getOutline,
    getProjectName,
    getProjectId,
  } = options;

  // 质检弹窗相关状态
  const showQualityCheck = ref(false);
  const qualityCheckLoading = ref(false);
  const qualityCheckError = ref("");
  const showLoadingState = ref(true);
  const visibleItems = ref([false, false, false, false, false]);
  const qualityResults = ref({
    structure: "",
    content: "",
    logic: "",
    quality: "",
    clarity: "",
  });
  const qualityScores = ref({
    structure: 0,
    content: 0,
    logic: 0,
    quality: 0,
    clarity: 0,
  });
  const totalScore = ref(0);
  const totalComment = ref("");
  const visibleTotalScore = ref(false);
  const progressBarWidth = ref(0);
  const currentStep = ref(-1);
  const isQualityCheckCancelled = ref(false);
  const qualityCheckCompleted = ref(false);

  // 修改建议相关状态
  const visibleSuggestions = ref(false);
  const visibleSuggestionItems = ref([false, false, false]);
  const suggestions = ref([]);

  // 保存上一次的质检结果和文章内容
  const getQualityCheckStorageKey = () => `quality-check-${getProjectId()}`;
  const lastQualityCheck = ref({
    articleContent: "",
    results: null,
    scores: null,
    totalScore: 0,
    totalComment: "",
    suggestions: null,
  });

  /**
   * 加载项目质检记录
   */
  const loadQualityCheckRecord = () => {
    try {
      const saved = localStorage.getItem(getQualityCheckStorageKey());
      if (saved) {
        let data = JSON.parse(saved);

        // 给旧数据补全缺失的字段
        if (data.totalScore === undefined && data.scores) {
          data.totalScore =
            (data.scores.structure || 0) +
            (data.scores.content || 0) +
            (data.scores.logic || 0) +
            (data.scores.quality || 0) +
            (data.scores.clarity || 0);
          data.totalComment = "继续努力，提升文章质量！";
        }

        // 给旧数据补全suggestions
        if (!data.suggestions) {
          data.suggestions = [
            {
              icon: "💡",
              text: "增加2-3个具体案例或数据支持，提升内容的说服力和充实度",
            },
            {
              icon: "📝",
              text: "优化段落之间的过渡语句，让文章逻辑更加连贯自然",
            },
            { icon: "🎯", text: "简化部分冗长复杂的句子，让表达更加清晰易懂" },
          ];
        }

        lastQualityCheck.value = data;
      } else {
        resetLastQualityCheck();
      }
    } catch (e) {
      console.error("加载质检记录失败:", e);
      resetLastQualityCheck();
    }
  };

  /**
   * 重置质检记录
   */
  const resetLastQualityCheck = () => {
    lastQualityCheck.value = {
      articleContent: "",
      results: null,
      scores: null,
      totalScore: 0,
      totalComment: "",
      suggestions: null,
    };
  };

  /**
   * 保存项目质检记录
   */
  const saveQualityCheckRecord = () => {
    try {
      localStorage.setItem(
        getQualityCheckStorageKey(),
        JSON.stringify(lastQualityCheck.value)
      );
    } catch (e) {
      console.error("保存质检记录失败:", e);
    }
  };

  /**
   * 判断是否可以显示质检报告（内容未变化且有结果）
   */
  const canShowQualityReport = computed(() => {
    if (!lastQualityCheck.value.results || !lastQualityCheck.value.scores)
      return false;
    const currentContent = generateFullMarkdown();
    return currentContent === lastQualityCheck.value.articleContent;
  });

  /**
   * 根据总分获取颜色
   */
  const getTotalScoreColor = (score) => {
    if (score >= 85) return "#10b981";
    if (score >= 70) return "#3b82f6";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  /**
   * 根据分数获取样式类
   */
  const getScoreClass = (score) => {
    if (score >= 17) return "score-excellent";
    if (score >= 13) return "score-good";
    if (score >= 9) return "score-medium";
    if (score >= 5) return "score-poor";
    return "score-bad";
  };

  /**
   * 滚动到弹窗底部
   */
  const scrollToBottom = () => {
    const modalBody = document.querySelector(".modal-body");
    if (!modalBody) return;
    modalBody.scrollTop = modalBody.scrollHeight;
  };

  /**
   * 显示上次的质检结果
   */
  const showPreviousQualityCheck = () => {
    showQualityCheck.value = true;
    showLoadingState.value = false;
    qualityCheckLoading.value = false;
    qualityResults.value = { ...lastQualityCheck.value.results };
    qualityScores.value = { ...lastQualityCheck.value.scores };
    totalScore.value = lastQualityCheck.value.totalScore;
    totalComment.value = lastQualityCheck.value.totalComment;
    suggestions.value = [...lastQualityCheck.value.suggestions];
    visibleItems.value = [true, true, true, true, true];
    visibleTotalScore.value = true;
    visibleSuggestions.value = true;
    visibleSuggestionItems.value = [true, true, true];
    progressBarWidth.value = totalScore.value;
    currentStep.value = 5;
    qualityCheckCompleted.value = true;
  };

  /**
   * 智能文章质检
   */
  const startQualityCheck = async () => {
    if (qualityCheckLoading.value) return;

    if (getIsGeneratingContent()) {
      emit("show-toast", "内容生成中，请稍后再试", "warning", 3000);
      return;
    }

    const outline = getOutline();
    const hasContent = outline.some(
      (section) =>
        section.content ||
        (section.children && section.children.some((sub) => sub.content))
    );

    if (!hasContent) {
      emit("show-toast", "请先生成文章内容", "warning", 3000);
      return;
    }

    isQualityCheckCancelled.value = false;
    qualityCheckCompleted.value = false;

    const fullMarkdown = generateFullMarkdown();

    if (
      fullMarkdown === lastQualityCheck.value.articleContent &&
      lastQualityCheck.value.results &&
      lastQualityCheck.value.scores &&
      lastQualityCheck.value.suggestions &&
      Array.isArray(lastQualityCheck.value.suggestions)
    ) {
      showPreviousQualityCheck();
      return;
    }

    showQualityCheck.value = true;
    showLoadingState.value = true;
    qualityCheckLoading.value = true;

    resetQualityState();

    const dimensions = [
      { key: "structure", name: "大纲结构" },
      { key: "content", name: "章节内容" },
      { key: "logic", name: "逻辑严密性" },
      { key: "quality", name: "内容质量" },
      { key: "clarity", name: "表达清晰度" },
    ];

    try {
      const response = await fetch("/api/ai/quality-check-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: getProjectName(),
          outline: outline,
          fullMarkdown: fullMarkdown,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "质检请求失败");
      }

      if (isQualityCheckCancelled.value) return;

      await new Promise((resolve) => setTimeout(resolve, 800));
      if (isQualityCheckCancelled.value) return;

      showLoadingState.value = false;
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (isQualityCheckCancelled.value) return;

      visibleItems.value[0] = true;
      currentStep.value = 0;

      const evaluations = result.data;
      const categoryIcons = {
        结构: "📋",
        内容: "📝",
        逻辑: "🔗",
        表达: "✍️",
        质量: "⭐",
      };
      const fallbackIcons = ["📋", "💡", "🔗"];

      let autoSuggestions = [];

      if (evaluations.suggestions && Array.isArray(evaluations.suggestions)) {
        autoSuggestions = evaluations.suggestions.slice(0, 3).map((s, index) => {
          if (typeof s === "string") {
            return {
              icon: fallbackIcons[index % fallbackIcons.length],
              text: s,
              category: "质量",
              priority: index + 1,
              issue: "",
              example: "",
            };
          } else {
            return {
              icon:
                categoryIcons[s.category] ||
                fallbackIcons[index % fallbackIcons.length],
              text: s.suggestion || s.text || "",
              category: s.category || "质量",
              priority: s.priority || index + 1,
              issue: s.issue || "",
              example: s.example || "",
            };
          }
        });
      }

      if (autoSuggestions.length === 0) {
        autoSuggestions = getDefaultSuggestions();
      }

      suggestions.value = autoSuggestions;

      await processDimensions(dimensions, evaluations);
      if (isQualityCheckCancelled.value) return;

      currentStep.value = 5;
      qualityCheckCompleted.value = true;

      calculateTotalScore();
      generateTotalComment();

      lastQualityCheck.value = {
        articleContent: fullMarkdown,
        results: { ...qualityResults.value },
        scores: { ...qualityScores.value },
        totalScore: totalScore.value,
        totalComment: totalComment.value,
        suggestions: [...suggestions.value],
      };
      saveQualityCheckRecord();

      await showTotalScore();
      await showSuggestions();
    } catch (error) {
      if (!isQualityCheckCancelled.value) {
        console.error("质检失败:", error);
        qualityCheckError.value = "质检暂时不可用，请稍后再试";
        showLoadingState.value = false;
      }
    } finally {
      qualityCheckLoading.value = false;
    }
  };

  /**
   * 重置质检状态
   */
  const resetQualityState = () => {
    qualityResults.value = {
      structure: "",
      content: "",
      logic: "",
      quality: "",
      clarity: "",
    };
    qualityScores.value = {
      structure: 0,
      content: 0,
      logic: 0,
      quality: 0,
      clarity: 0,
    };
    totalScore.value = 0;
    totalComment.value = "";
    visibleTotalScore.value = false;
    progressBarWidth.value = 0;
    currentStep.value = -1;
  };

  /**
   * 获取默认建议
   */
  const getDefaultSuggestions = () => {
    return [
      {
        icon: "📋",
        text: "优化章节间的层次关系，让大纲结构更清晰",
        category: "结构",
        priority: 1,
        issue: "",
        example: "",
      },
      {
        icon: "💡",
        text: "增加具体的案例和数据，提升内容的充实度",
        category: "内容",
        priority: 2,
        issue: "",
        example: "",
      },
      {
        icon: "🔗",
        text: "加强各部分之间的逻辑关联，让论证更严密",
        category: "逻辑",
        priority: 3,
        issue: "",
        example: "",
      },
    ];
  };

  /**
   * 处理各个维度的评价
   */
  const processDimensions = async (dimensions, evaluations) => {
    for (let i = 0; i < dimensions.length; i++) {
      if (isQualityCheckCancelled.value) return;

      const dim = dimensions[i];
      const text = evaluations[dim.key] || "评价加载失败";
      const scoreKey = `${dim.key}Score`;
      const score = evaluations[scoreKey] || 0;
      currentStep.value = i;

      qualityScores.value[dim.key] = score;

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (isQualityCheckCancelled.value) return;
        visibleItems.value[i] = true;
        await nextTick();
        scrollToBottom();
      }

      for (let j = 0; j < text.length; j++) {
        if (isQualityCheckCancelled.value) return;
        qualityResults.value[dim.key] += text[j];
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  };

  /**
   * 计算总分
   */
  const calculateTotalScore = () => {
    totalScore.value =
      (qualityScores.value.structure || 0) +
      (qualityScores.value.content || 0) +
      (qualityScores.value.logic || 0) +
      (qualityScores.value.quality || 0) +
      (qualityScores.value.clarity || 0);
  };

  /**
   * 生成总评语
   */
  const generateTotalComment = () => {
    if (totalScore.value >= 85) {
      totalComment.value = "文章优秀，继续保持！";
    } else if (totalScore.value >= 70) {
      totalComment.value = "文章良好，还有提升空间！";
    } else if (totalScore.value >= 50) {
      totalComment.value = "文章一般，需要继续完善！";
    } else {
      totalComment.value = "继续努力，提升文章质量！";
    }
  };

  /**
   * 显示总分
   */
  const showTotalScore = async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    visibleTotalScore.value = true;
    await nextTick();
    scrollToBottom();

    const targetWidth = totalScore.value;
    for (let i = 0; i <= targetWidth; i += 2) {
      if (isQualityCheckCancelled.value) return;
      progressBarWidth.value = i;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    progressBarWidth.value = targetWidth;
  };

  /**
   * 显示修改建议
   */
  const showSuggestions = async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    visibleSuggestions.value = true;
    await nextTick();
    scrollToBottom();

    for (let i = 0; i < suggestions.value.length; i++) {
      if (isQualityCheckCancelled.value) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
      visibleSuggestionItems.value[i] = true;
      await nextTick();
      scrollToBottom();
    }
  };

  /**
   * 关闭质检弹窗
   */
  const closeQualityCheck = () => {
    if (!qualityCheckCompleted.value && qualityCheckLoading.value) {
      isQualityCheckCancelled.value = true;
      qualityCheckLoading.value = false;

      resetLastQualityCheck();

      emit("show-toast", "已中断质检", "warning", 2500);
    }

    showQualityCheck.value = false;
    qualityCheckError.value = "";
  };

  return {
    // 状态
    showQualityCheck,
    qualityCheckLoading,
    qualityCheckError,
    showLoadingState,
    visibleItems,
    qualityResults,
    qualityScores,
    totalScore,
    totalComment,
    visibleTotalScore,
    progressBarWidth,
    currentStep,
    isQualityCheckCancelled,
    qualityCheckCompleted,
    visibleSuggestions,
    visibleSuggestionItems,
    suggestions,
    lastQualityCheck,
    canShowQualityReport,

    // 方法
    loadQualityCheckRecord,
    saveQualityCheckRecord,
    getTotalScoreColor,
    getScoreClass,
    startQualityCheck,
    closeQualityCheck,
  };
};
