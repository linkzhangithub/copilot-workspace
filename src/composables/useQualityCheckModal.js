import { ref, computed, nextTick } from "vue";

export const useQualityCheckModal = (options) => {
  const {
    projectId,
    projectName,
    outline,
    isGeneratingContent,
    fullMarkdown,
    emit,
  } = options;

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
  const visibleSuggestions = ref(false);
  const visibleSuggestionItems = ref([false, false, false]);
  const suggestions = ref([]);
  const displaySuggestions = ref([]);

  const dimensions = [
    { key: "structure", name: "大纲结构" },
    { key: "content", name: "章节内容" },
    { key: "logic", name: "逻辑严密性" },
    { key: "quality", name: "内容质量" },
    { key: "clarity", name: "表达清晰度" },
  ];

  const visibleQualityItems = computed(() => {
    return dimensions
      .map((dim, index) => ({ dim, index }))
      .filter((item) => visibleItems.value[item.index]);
  });

  const visibleSuggestionList = computed(() => {
    return displaySuggestions.value
      .map((suggestion, index) => ({ suggestion, index }))
      .filter((item) => visibleSuggestionItems.value[item.index]);
  });

  const lastQualityCheck = ref({
    articleContent: "",
    results: null,
    scores: null,
    totalScore: 0,
    totalComment: "",
    suggestions: null,
  });

  const getQualityCheckStorageKey = () => `quality-check-${projectId.value}`;

  const loadQualityCheckRecord = () => {
    try {
      const saved = localStorage.getItem(getQualityCheckStorageKey());
      if (saved) {
        let data = JSON.parse(saved);
        if (data.totalScore === undefined && data.scores) {
          data.totalScore =
            (data.scores.structure || 0) +
            (data.scores.content || 0) +
            (data.scores.logic || 0) +
            (data.scores.quality || 0) +
            (data.scores.clarity || 0);
          data.totalComment = "继续努力，提升文章质量！";
        }
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

  const saveQualityCheckRecord = () => {
    try {
      localStorage.setItem(
        getQualityCheckStorageKey(),
        JSON.stringify(lastQualityCheck.value),
      );
    } catch (e) {
      console.error("保存质检记录失败:", e);
    }
  };

  const getTotalScoreColor = (score) => {
    if (score >= 85) return "#10b981";
    if (score >= 70) return "#3b82f6";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const getScoreClass = (score) => {
    if (score >= 17) return "score-excellent";
    if (score >= 13) return "score-good";
    if (score >= 9) return "score-medium";
    if (score >= 5) return "score-poor";
    return "score-bad";
  };

  const scrollToBottom = () => {
    const modalBody = document.querySelector(".modal-body");
    if (!modalBody) return;
    modalBody.scrollTop = modalBody.scrollHeight;
  };

  const canShowQualityReport = computed(() => {
    if (!lastQualityCheck.value.results || !lastQualityCheck.value.scores)
      return false;
    return fullMarkdown.value === lastQualityCheck.value.articleContent;
  });

  const showPreviousQualityCheck = () => {
    showQualityCheck.value = true;
    showLoadingState.value = false;
    qualityCheckLoading.value = false;
    qualityResults.value = { ...lastQualityCheck.value.results };
    qualityScores.value = { ...lastQualityCheck.value.scores };
    totalScore.value = lastQualityCheck.value.totalScore;
    totalComment.value = lastQualityCheck.value.totalComment;
    suggestions.value = [...lastQualityCheck.value.suggestions];
    displaySuggestions.value = [...lastQualityCheck.value.suggestions];

    nextTick(() => {
      visibleItems.value = [true, true, true, true, true];
      visibleTotalScore.value = true;
      visibleSuggestions.value = true;
      visibleSuggestionItems.value = [true, true, true];
      progressBarWidth.value = totalScore.value;
      currentStep.value = 5;
      qualityCheckCompleted.value = true;
    });
  };

  const startQualityCheck = async () => {
    if (qualityCheckLoading.value) return;
    if (isGeneratingContent.value) {
      emit("show-toast", "内容生成中，请稍后再试", "warning", 3000);
      return;
    }

    const hasContent = outline.value.some(
      (section) =>
        section.content ||
        (section.children && section.children.some((sub) => sub.content)),
    );

    if (!hasContent) {
      emit("show-toast", "请先生成文章内容", "warning", 3000);
      return;
    }

    isQualityCheckCancelled.value = false;
    qualityCheckCompleted.value = false;

    if (
      fullMarkdown.value === lastQualityCheck.value.articleContent &&
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

    try {
      const response = await fetch("/api/ai/quality-check-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: projectName.value,
          outline: outline.value,
          fullMarkdown: fullMarkdown.value,
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

      showLoadingState.value = false;
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (isQualityCheckCancelled.value) return;

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
        autoSuggestions = evaluations.suggestions
          .slice(0, 3)
          .map((s, index) => {
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
        articleContent: fullMarkdown.value,
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
    visibleItems.value = [false, false, false, false, false];
    visibleSuggestions.value = false;
    visibleSuggestionItems.value = [false, false, false];
    displaySuggestions.value = [];
  };

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

  const processDimensions = async (dimensions, evaluations) => {
    for (let i = 0; i < dimensions.length; i++) {
      if (isQualityCheckCancelled.value) return;

      const dim = dimensions[i];
      const text = evaluations[dim.key] || "评价加载失败";
      const scoreKey = `${dim.key}Score`;
      const score = evaluations[scoreKey] || 0;

      currentStep.value = i;
      qualityScores.value[dim.key] = score;

      await new Promise((resolve) => setTimeout(resolve, 150));
      if (isQualityCheckCancelled.value) return;

      visibleItems.value[i] = true;
      await nextTick();
      scrollToBottom();

      const resultText = text;
      qualityResults.value[dim.key] = "";

      for (let j = 0; j < resultText.length; j++) {
        if (isQualityCheckCancelled.value) return;
        qualityResults.value[dim.key] += resultText[j];
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  };

  const calculateTotalScore = () => {
    totalScore.value =
      (qualityScores.value.structure || 0) +
      (qualityScores.value.content || 0) +
      (qualityScores.value.logic || 0) +
      (qualityScores.value.quality || 0) +
      (qualityScores.value.clarity || 0);
  };

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

  const showTotalScore = async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    visibleTotalScore.value = true;
    await nextTick();
    scrollToBottom();

    const targetWidth = totalScore.value;
    const step = Math.ceil(targetWidth / 30);
    for (let i = 0; i <= targetWidth; i += step) {
      if (isQualityCheckCancelled.value) return;
      progressBarWidth.value = Math.min(i, targetWidth);
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    progressBarWidth.value = targetWidth;
  };

  const showSuggestions = async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    visibleSuggestions.value = true;
    await nextTick();
    scrollToBottom();

    displaySuggestions.value = suggestions.value.map((s) => ({
      icon: s.icon,
      text: "",
      issue: "",
      example: "",
      hasIssue: !!s.issue,
      hasExample: !!s.example,
    }));

    for (let i = 0; i < suggestions.value.length; i++) {
      if (isQualityCheckCancelled.value) return;

      visibleSuggestionItems.value[i] = true;
      await nextTick();
      scrollToBottom();

      await new Promise((resolve) => setTimeout(resolve, 500));

      const suggestion = suggestions.value[i];
      const displaySuggestion = displaySuggestions.value[i];

      if (suggestion.issue) {
        for (let j = 0; j < suggestion.issue.length; j++) {
          if (isQualityCheckCancelled.value) return;
          displaySuggestion.issue += suggestion.issue[j];
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (suggestion.text) {
        for (let j = 0; j < suggestion.text.length; j++) {
          if (isQualityCheckCancelled.value) return;
          displaySuggestion.text += suggestion.text[j];
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (suggestion.example) {
        for (let j = 0; j < suggestion.example.length; j++) {
          if (isQualityCheckCancelled.value) return;
          displaySuggestion.example += suggestion.example[j];
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

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
    loadQualityCheckRecord,
    startQualityCheck,
    closeQualityCheck,
    getTotalScoreColor,
    getScoreClass,
    dimensions,
    visibleQualityItems,
    visibleSuggestionList,
  };
};
