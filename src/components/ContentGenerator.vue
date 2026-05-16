<script setup>
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  toRef,
  nextTick,
} from "vue";
import Icon from "./Icon.vue";
import { cleanTitleMarkdown } from "../utils/stringUtils.js";
import "../styles/content-generator.css";
import { useContentGenerator } from "../composables/useContentGenerator.js";

const props = defineProps({
  outline: { type: Array, required: true },
  articleTopic: { type: String, default: "" },
  isGeneratingAll: { type: Boolean, default: false },
  isPaused: { type: Boolean, default: false },
  generatingSubsectionPath: { type: Array, default: null },
});

const emit = defineEmits([
  "update:outline",
  "show-toast",
  "generating-state-change",
]);

// AbortController 用于中断单个小节生成
let currentAbortController = null;

const {
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
  getDisplayNumber,
  getOperationDesc,
  buildContextInfo,
  scrollToSection,
} = useContentGenerator({
  outline: toRef(props, "outline"),
  articleTopic: toRef(props, "articleTopic"),
  emit,
});

const handleTextareaInput = (path, e) => {
  updateSectionByPath(path, e.target.value);
  if (isMobile.value) {
    nextTick(() => autoResizeTextarea(path));
  }
};

const isCurrentSubsectionGenerating = (path) => {
  if (
    !props.isGeneratingAll ||
    !props.generatingSubsectionPath ||
    props.isPaused
  )
    return false;
  return getPathKey(path) === getPathKey(props.generatingSubsectionPath);
};

const generateSection = async (path) => {
  // 检查是否正在一键生成
  if (props.isGeneratingAll && !props.isPaused) {
    emit("show-toast", "内容生成中，请稍后再试", "warning", 3000);
    return;
  }

  if (generatingPath.value !== null) return;
  if (operatingPath.value !== null) return;

  const pathKey = getPathKey(path);
  console.log("[ContentGenerator] Before setting generatingPath:", {
    currentGeneratingPath: generatingPath.value,
    newPath: pathKey,
  });
  generatingPath.value = pathKey;
  console.log("[ContentGenerator] After setting generatingPath:", {
    generatingPath: generatingPath.value,
    isGeneratingSingle:
      generatingPath.value !== null || operatingPath.value !== null,
  });

  // 创建 AbortController
  const abortController = new AbortController();
  currentAbortController = abortController;

  // 显示Toast提示：正在生成第X章第X小节
  const mainIndex = path[0] + 1;
  const subIndex = path.length > 1 ? path[1] + 1 : null;
  const positionText = subIndex
    ? `第${mainIndex}章第${subIndex}小节`
    : `第${mainIndex}章`;
  emit("show-toast", `正在生成${positionText}内容...`, "info", 2000);

  const currentSection = getSectionByPath(props.outline, path);
  const sectionTitle = currentSection.title;

  const updateContent = (content) => {
    updateSectionByPath(path, content);
    if (isMobile.value) {
      nextTick(() => autoResizeTextarea(path));
    }
  };

  try {
    const contextInfo = buildContextInfo(path, "first_generate");

    console.log(
      "generateSection: about to call fetch, generatingPath is",
      generatingPath.value,
    );
    const response = await fetch("/api/ai/generate-content-simple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outline: props.outline,
        path: path,
        contextInfo: contextInfo,
      }),
      signal: abortController.signal,
    });
    console.log(
      "generateSection: fetch completed, generatingPath is",
      generatingPath.value,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      const cleanedContent = cleanDuplicateTitleInContent(
        result.data,
        sectionTitle,
      );
      updateContent("");
      await typeWriter(cleanedContent, (partialText) => {
        // 检查是否被中断
        if (generatingPath.value === null) {
          throw new Error("生成已中断");
        }
        updateContent(partialText);
      });
    }
  } catch (err) {
    if (err.name === "AbortError" || err.message === "生成已中断") {
      console.log("生成被中断");
      // 清空内容
      updateContent("");
    } else {
      console.error("生成失败:", err);
      emit("show-toast", "生成失败，请重试", "error", 3000);
    }
  } finally {
    console.log("generateSection: finally block, clearing generatingPath");
    generatingPath.value = null;
    currentAbortController = null;
  }
};

const rewriteSection = async (path, operation) => {
  // 统一拦截逻辑：如果正在一键生成或单个生成，则拒绝
  if ((props.isGeneratingAll && !props.isPaused) || props.generatingSubsectionPath !== null) {
    emit("show-toast", "内容生成中，请稍后再试", "warning", 3000);
    return;
  }

  if (operatingPath.value !== null) return;

  const pathKey = getPathKey(path);
  operatingPath.value = pathKey;
  currentOperation.value = operation;

  // 创建 AbortController
  const abortController = new AbortController();
  currentAbortController = abortController;

  const section = getSectionByPath(props.outline, path);

  const updateRewriteContent = (content) => {
    updateSectionByPath(path, content);
    if (isMobile.value) {
      nextTick(() => autoResizeTextarea(path));
    }
  };

  try {
    const contextInfo = buildContextInfo(path, operation, section.content);

    const response = await fetch("/api/ai/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: section.content,
        operation: operation,
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      updateRewriteContent("");
      await typeWriter(result.data, (partialText) => {
        // 检查是否被中断
        if (operatingPath.value === null) {
          throw new Error("改写已中断");
        }
        updateRewriteContent(partialText);
      });
    }
  } catch (err) {
    if (err.name === "AbortError" || err.message === "改写已中断") {
      console.log("改写被中断");
      // 恢复原始内容
      updateRewriteContent(section.content);
    } else {
      console.error("改写失败:", err);
      let newContent = section.content;
      if (operation === "polish") {
        newContent = section.content + "\n\n（已润色）";
      } else if (operation === "expand") {
        newContent = section.content + "\n\n（已扩写）这段是新增的扩展内容。";
      } else if (operation === "shorten") {
        newContent = section.content.slice(0, 50) + "...\n（已缩写）";
      }

      updateRewriteContent("");
      await typeWriter(newContent, (partialText) => {
        updateRewriteContent(partialText);
      });
    }
  } finally {
    operatingPath.value = null;
    currentOperation.value = "";
    currentAbortController = null;
  }
};

const isDragging = ref(false);
const dragStartY = ref(0);
const dragPathKey = ref(null);
const dragStartHeight = ref(0);

const startDrag = (e, pathKey) => {
  isDragging.value = true;
  dragPathKey.value = pathKey;
  dragStartY.value = e.clientY;
  dragStartHeight.value = textareaHeights.value[pathKey] || 200;
  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", stopDrag);
};

const onDrag = (e) => {
  if (!isDragging.value || dragPathKey.value === null) return;
  const deltaY = e.clientY - dragStartY.value;
  const newHeight = Math.max(200, dragStartHeight.value + deltaY);
  textareaHeights.value[dragPathKey.value] = newHeight;
};

const stopDrag = () => {
  isDragging.value = false;
  dragPathKey.value = null;
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDrag);
};

// 检查是否正在生成单个小节内容
const isGeneratingSingle = computed(() => {
  return generatingPath.value !== null || operatingPath.value !== null;
});

// 监听生成状态变化，通知父组件
watch(
  isGeneratingSingle,
  (newValue, oldValue) => {
    console.log("[ContentGenerator] isGeneratingSingle changed:", {
      oldValue,
      newValue,
      generatingPath: generatingPath.value,
      operatingPath: operatingPath.value,
    });
    emit("generating-state-change", newValue);
  },
  { immediate: true },
);

/**
 * 清理生成状态
 */
const cleanupState = () => {
  // 中断 API 请求
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  generatingPath.value = null;
  operatingPath.value = null;
  currentOperation.value = "";
};

/**
 * 检查是否正在生成单个小节
 */
const getIsGeneratingSingle = () => {
  const result = generatingPath.value !== null || operatingPath.value !== null;
  console.log("getIsGeneratingSingle called:", {
    generatingPath: generatingPath.value,
    operatingPath: operatingPath.value,
    result,
  });
  return result;
};

defineExpose({
  scrollToSection,
  isGeneratingSingle,
  getIsGeneratingSingle,
  cleanupState,
});

onMounted(() => {
  checkIsMobile();
  window.addEventListener("resize", checkIsMobile);
  nextTick(() => {
    flatContent.value.forEach((item) => {
      if (item.content && item.level > 0) {
        autoResizeTextarea(item.path);
      }
    });
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", checkIsMobile);
});

watch(
  () => props.outline,
  () => {
    if (isMobile.value) {
      nextTick(() => {
        flatContent.value.forEach((item) => {
          if (item.content && item.level > 0) {
            autoResizeTextarea(item.path);
          }
        });
      });
    }
  },
  { deep: true },
);
</script>

<template>
  <div class="content-generator">
    <div class="sections-list">
      <div
        v-for="(item, idx) in flatContent"
        :key="getPathKey(item.path)"
        class="section-item"
        :class="`level-${item.level}`"
      >
        <div
          class="section-header"
          :id="item.level > 0 ? `section-${getPathKey(item.path)}` : undefined"
        >
          <div class="header-left">
            <div class="content-number">{{ getDisplayNumber(item.path) }}</div>
            <h3 v-if="item.level === 0" class="main-title">
              {{ cleanTitleMarkdown(item.title) }}
            </h3>
            <h4 v-else class="subsection-title">
              {{ cleanTitleMarkdown(item.title) }}
            </h4>
          </div>
          <div v-if="item.level > 0" class="section-actions">
            <button
              v-if="isCurrentSubsectionGenerating(item.path)"
              class="content-action-btn generating-btn"
              disabled
            >
              <Icon name="Loader2" :size="16" class="spinner" />
              <span class="btn-label">生成中...</span>
            </button>
            <button
              v-else-if="
                props.isGeneratingAll && !props.isPaused && !item.content
              "
              class="content-action-btn waiting-btn"
              disabled
            >
              <Icon name="Loader2" :size="16" class="spinner" />
              <span class="btn-label">等待生成...</span>
            </button>
            <button
              v-else-if="
                !item.content && generatingPath !== getPathKey(item.path)
              "
              class="content-action-btn generate-btn"
              @click="generateSection(item.path)"
            >
              <Icon name="Play" :size="16" />
              <span class="btn-label">生成内容</span>
            </button>
            <button
              v-else-if="generatingPath === getPathKey(item.path)"
              class="content-action-btn generating-btn"
              disabled
            >
              <Icon name="Loader2" :size="16" class="spinner" />
              <span class="btn-label">生成中...</span>
            </button>
            <template v-else-if="item.content">
              <button
                v-if="operatingPath !== getPathKey(item.path)"
                class="content-action-btn polish-btn"
                @click="rewriteSection(item.path, 'polish')"
                title="润色优化内容"
              >
                <Icon name="Sparkles" :size="16" />
                <span class="btn-label">润色</span>
              </button>
              <button v-else class="content-action-btn operating-btn" disabled>
                <Icon name="Loader2" :size="16" class="spinner" />
                <span class="btn-label">{{
                  getOperationDesc(currentOperation)
                }}</span>
              </button>
              <button
                v-if="operatingPath !== getPathKey(item.path)"
                class="content-action-btn content-expand-btn"
                @click="rewriteSection(item.path, 'expand')"
                title="扩写丰富内容"
              >
                <Icon name="ZoomIn" :size="16" />
                <span class="btn-label">扩写</span>
              </button>
              <button
                v-if="operatingPath !== getPathKey(item.path)"
                class="content-action-btn shorten-btn"
                @click="rewriteSection(item.path, 'shorten')"
                title="缩写精简内容"
              >
                <Icon name="ZoomOut" :size="16" />
                <span class="btn-label">缩写</span>
              </button>
              <button
                v-if="operatingPath !== getPathKey(item.path)"
                class="content-action-btn regenerate-btn"
                @click="generateSection(item.path)"
                title="重新生成内容"
              >
                <Icon name="RotateCcw" :size="16" />
                <span class="btn-label">重写</span>
              </button>
            </template>
          </div>
        </div>
        <div v-if="item.level > 0" class="section-content">
          <div v-if="item.content" class="textarea-wrapper">
            <textarea
              :value="item.content"
              @input="(e) => handleTextareaInput(item.path, e)"
              class="content-textarea"
              :class="{ 'content-textarea-mobile': isMobile }"
              placeholder="该章节暂无内容..."
              :data-path="getPathKey(item.path)"
              :style="
                !isMobile
                  ? {
                      height:
                        (textareaHeights[getPathKey(item.path)] || 240) + 'px',
                    }
                  : {}
              "
            ></textarea>
          </div>
          <div v-else class="content-placeholder">
            <div class="placeholder-icon">
              <Icon name="FileText" :size="48" />
            </div>
            <div class="placeholder-text">
              <h4>开始创作这个章节</h4>
              <p>点击上方的「生成内容」按钮，让 AI 帮你创作</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
