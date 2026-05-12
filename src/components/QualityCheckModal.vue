<script setup>
import { ref, computed, nextTick, watch } from "vue";
import Icon from "./Icon.vue";

const props = defineProps({
  projectId: { type: String, required: true },
  projectName: { type: String, required: true },
  outline: { type: Array, required: true },
  isGeneratingContent: { type: Boolean, default: false },
  fullMarkdown: { type: String, default: "" },
});

const emit = defineEmits(["show-toast"]);

// 质检弹窗相关
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

const getQualityCheckStorageKey = () => `quality-check-${props.projectId}`;
const lastQualityCheck = ref({
  articleContent: "",
  results: null,
  scores: null,
  totalScore: 0,
  totalComment: "",
  suggestions: null,
});

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
      JSON.stringify(lastQualityCheck.value)
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
  return props.fullMarkdown === lastQualityCheck.value.articleContent;
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
  visibleItems.value = [true, true, true, true, true];
  visibleTotalScore.value = true;
  visibleSuggestions.value = true;
  visibleSuggestionItems.value = [true, true, true];
  progressBarWidth.value = totalScore.value;
  currentStep.value = 5;
  qualityCheckCompleted.value = true;
};

const startQualityCheck = async () => {
  if (qualityCheckLoading.value) return;
  if (props.isGeneratingContent) {
    emit("show-toast", "内容生成中，请稍后再试", "warning", 3000);
    return;
  }

  const hasContent = props.outline.some(
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

  const fullMarkdown = props.fullMarkdown;

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
        topic: props.projectName,
        outline: props.outline,
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

watch(
  () => props.projectId,
  () => {
    loadQualityCheckRecord();
  },
  { immediate: true }
);

defineExpose({
  startQualityCheck,
  canShowQualityReport,
});
</script>

<template>
  <!-- 智能质检弹窗 -->
  <div v-if="showQualityCheck" class="quality-check-modal">
    <div class="modal-overlay" @click="closeQualityCheck"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>智能文章质检</h2>
        <button class="close-btn" @click="closeQualityCheck">
          <Icon name="X" :size="20" />
        </button>
      </div>
      <div class="modal-body">
        <Transition name="fade" mode="out-in">
          <div v-if="showLoadingState" key="loading" class="loading-state">
            <div class="loading-icon">
              <Icon name="Loader2" :size="48" class="spinner" />
            </div>
            <p class="loading-text">正在读取文章内容</p>
            <p class="loading-subtext">AI正在分析您的文章...</p>
          </div>

          <div v-else key="quality" class="quality-list">
            <div v-if="qualityCheckError" class="quality-error-message">
              <Icon name="AlertCircle" :size="18" />
              <span>{{ qualityCheckError }}</span>
            </div>
            <template v-else>
              <TransitionGroup name="slide-fade">
                <div
                  v-for="(dim, index) in [
                    { key: 'structure', name: '大纲结构' },
                    { key: 'content', name: '章节内容' },
                    { key: 'logic', name: '逻辑严密性' },
                    { key: 'quality', name: '内容质量' },
                    { key: 'clarity', name: '表达清晰度' },
                  ]"
                  :key="dim.key"
                  v-if="visibleItems[index]"
                  class="quality-item"
                >
                  <div class="quality-item-left">
                    <div
                      class="quality-icon"
                      :class="{
                        loading: currentStep === index,
                        done: currentStep > index,
                      }"
                    >
                      <Icon
                        v-if="currentStep > index"
                        name="CheckCircle"
                        :size="20"
                      />
                      <Icon
                        v-else
                        name="Loader2"
                        :size="20"
                        :class="{ spinner: currentStep >= 0 }"
                      />
                    </div>
                    <span class="quality-name">{{ dim.name }}</span>
                  </div>
                  <div class="quality-result">
                    <span class="quality-result-content">{{
                      qualityResults[dim.key]
                    }}</span>
                  </div>
                  <div
                    class="quality-score"
                    :class="getScoreClass(qualityScores[dim.key])"
                  >
                    {{ qualityScores[dim.key]
                    }}<span class="score-total">/20</span>
                  </div>
                </div>
              </TransitionGroup>

              <Transition name="fade">
                <div v-if="visibleTotalScore" class="total-score-section">
                  <div class="total-score-header">
                    <span class="total-score-label">总分</span>
                    <span
                      class="total-score-value"
                      :style="{ color: getTotalScoreColor(totalScore) }"
                    >
                      {{ totalScore }}/100
                    </span>
                  </div>
                  <div class="total-score-progress">
                    <div
                      class="total-score-progress-bar"
                      :style="{
                        width: `${progressBarWidth}%`,
                        backgroundColor: getTotalScoreColor(totalScore),
                      }"
                    ></div>
                  </div>
                  <div class="total-score-comment">{{ totalComment }}</div>
                </div>
              </Transition>

              <Transition name="fade">
                <div v-if="visibleSuggestions" class="suggestions-section">
                  <h3 class="suggestions-title">修改建议</h3>
                  <TransitionGroup name="slide-fade">
                    <div
                      v-for="(suggestion, index) in suggestions"
                      :key="index"
                      v-if="visibleSuggestionItems[index]"
                      class="suggestion-item"
                    >
                      <span class="suggestion-icon">{{ suggestion.icon }}</span>
                      <span class="suggestion-text">{{ suggestion.text }}</span>
                    </div>
                  </TransitionGroup>
                </div>
              </Transition>
            </template>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quality-check-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
  max-height: calc(80vh - 80px);
  overflow-y: auto;
}

.loading-state {
  text-align: center;
  padding: 48px 0;
}

.loading-icon {
  margin-bottom: 16px;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.loading-subtext {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.quality-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quality-error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 14px;
}

.quality-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.quality-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 140px;
}

.quality-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.quality-icon.loading {
  background: #dbeafe;
  color: #3b82f6;
}

.quality-icon.done {
  background: #d1fae5;
  color: #10b981;
}

.quality-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.quality-result {
  flex: 1;
  font-size: 14px;
  color: var(--text-secondary);
}

.quality-score {
  font-size: 18px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 6px;
  min-width: 60px;
  text-align: center;
}

.score-excellent {
  background: #d1fae5;
  color: #10b981;
}

.score-good {
  background: #dbeafe;
  color: #3b82f6;
}

.score-medium {
  background: #fef3c7;
  color: #f59e0b;
}

.score-poor {
  background: #fee2e2;
  color: #ef4444;
}

.score-bad {
  background: #fee2e2;
  color: #ef4444;
}

.score-total {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.7;
}

.total-score-section {
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border);
  margin-top: 8px;
}

.total-score-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.total-score-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.total-score-value {
  font-size: 24px;
  font-weight: 700;
}

.total-score-progress {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.total-score-progress-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.total-score-comment {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
}

.suggestions-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

.suggestions-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
}

.suggestion-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.suggestion-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
