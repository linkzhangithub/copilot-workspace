<script setup>
import { ref, onMounted, onUnmounted, toRef, watch } from "vue";
import Icon from "./Icon.vue";
import "../styles/outline-editor.css";
import { cleanTitleNumber } from "../utils/stringUtils.js";
import { deepClone } from "../utils/deepClone.js";
import {
  MAX_TOTAL_SUBSECTIONS,
  MAX_SUBSECTIONS_PER_CHAPTER,
} from "../constants/limits.js";
import { useOutlineEditor } from "../composables/useOutlineEditor.js";

const props = defineProps({
  outline: { type: Array, required: true },
  hasGeneratedAllContent: { type: Boolean, default: false },
  isGeneratingAll: { type: Boolean, default: false },
  isPaused: { type: Boolean, default: false },
  generateAllButtonState: { type: String, default: "ready" },
});

const emit = defineEmits([
  "update:outline",
  "show-toast",
  "generate-all-content",
  "scroll-to-section",
  "generating-state-change",
]);

const isMobile = ref(false);

// AbortController 用于中断 API 请求
let currentAbortController = null;

const {
  editingPath,
  editingValue,
  editInputRefs,
  expandedState,
  generatingPath,
  isDragging,
  isAnimating,
  animatingIndex,
  originalDragIndex,
  itemRefs,
  outlineListRef,
  articleStructure,
  flatOutline,
  getPathKey,
  toggleExpand,
  expandAll,
  collapseAll,
  isAllExpanded,
  getSectionByPath,
  deleteSectionByPath,
  addSection,
  startEdit,
  saveEdit,
  cancelEdit,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  getItemStyle,
  getDisplayNumber,
} = useOutlineEditor({
  outline: toRef(props, "outline"),
  emit,
});

// 监听生成状态变化，通知父组件
watch(
  generatingPath,
  (newValue) => {
    const isGenerating = newValue !== null;
    console.log("[OutlineEditor] generatingPath changed:", {
      generatingPath: newValue,
      isGenerating,
    });
    emit("generating-state-change", isGenerating);
  },
  { immediate: true },
);

const addSubSectionByPath = async (path, event) => {
  event.stopPropagation();

  if (!articleStructure.value.canAddSubsection(path[0])) {
    const tooltip = articleStructure.value.getSubsectionTooltip(path[0]);
    emit("show-toast", tooltip, "warning", 3000);
    return;
  }

  const pathKey = getPathKey(path);
  generatingPath.value = pathKey;

  // 创建 AbortController
  const abortController = new AbortController();
  currentAbortController = abortController;

  try {
    const currentSection = getSectionByPath(path);
    const existingTitles = new Set();
    const collect = (items) => {
      items.forEach((item) => {
        if (item.title) existingTitles.add(item.title.trim().toLowerCase());
        if (item.children?.length) collect(item.children);
      });
    };
    collect(props.outline);

    const response = await fetch("/api/ai/generate-subsections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: currentSection.title,
        existingTitles: Array.from(existingTitles),
      }),
      signal: abortController.signal,
    });

    const result = await response.json();
    let subSections = [];

    if (result.success && result.data?.length > 0) {
      subSections = result.data.filter((title) => {
        const normalized = (typeof title === "string" ? title : title.title)
          .trim()
          .toLowerCase();
        return !existingTitles.has(normalized);
      });
    }

    if (subSections.length === 0 && result.data?.length > 0) {
      subSections = result.data.map((title) =>
        typeof title === "string" ? title : title.title,
      );
    }

    const availableSlots =
      MAX_TOTAL_SUBSECTIONS - articleStructure.value.totalSubsections;
    const slotsPerChapter =
      MAX_SUBSECTIONS_PER_CHAPTER -
      (articleStructure.value.chapterSubsectionCounts[path[0]] || 0);
    const maxToAdd = Math.min(availableSlots, slotsPerChapter);
    subSections = subSections.slice(0, maxToAdd);

    const timestamp = Date.now();
    for (let i = 0; i < subSections.length; i++) {
      const newOutline = deepClone(props.outline);
      let current = newOutline;
      for (let j = 0; j < path.length - 1; j++) {
        current = current[path[j]].children;
      }
      if (!current[path[path.length - 1]].children) {
        current[path[path.length - 1]].children = [];
      }

      const title = subSections[i];
      current[path[path.length - 1]].children.push({
        id: `subsection-${timestamp}-${i}`,
        title: typeof title === "string" ? title : title.title,
        children: [],
      });

      emit("update:outline", newOutline);
      if (i < subSections.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("生成子章节被中断");
      // 被中断，不添加任何子章节
      return;
    }

    console.error("生成子章节失败:", err);
    const section = getSectionByPath(path);
    const fallbackSections = [
      `${section.title}概述`,
      `${section.title}要点`,
      `${section.title}应用`,
    ];
    const timestamp = Date.now();

    for (let i = 0; i < fallbackSections.length; i++) {
      const newOutline = deepClone(props.outline);
      let current = newOutline;
      for (let j = 0; j < path.length - 1; j++) {
        current = current[path[j]].children;
      }
      if (!current[path[path.length - 1]].children) {
        current[path[path.length - 1]].children = [];
      }

      current[path[path.length - 1]].children.push({
        id: `subsection-${timestamp}-${i}`,
        title: fallbackSections[i],
        children: [],
      });

      emit("update:outline", newOutline);
      if (i < fallbackSections.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  } finally {
    generatingPath.value = null;
    currentAbortController = null;
  }
};

const scrollToSection = (path) => {
  emit("scroll-to-section", path);
};

const toggleAllSections = () => {
  if (isAllExpanded.value) {
    collapseAll();
  } else {
    expandAll();
  }
};

const generateAllContent = () => {
  // 移除粗糙的标志位检查，改为由父组件进行精准的空内容扫描
  // if (props.hasGeneratedAllContent) {
  //   emit("show-toast", "文章内容已生成，可手动调整", "warning", 3000);
  //   return;
  // }

  const hasSubsections = props.outline.some(
    (chapter) => chapter.children && chapter.children.length > 0,
  );

  if (!hasSubsections) {
    emit("show-toast", "请先添加小节", "warning", 3000);
    return;
  }

  emit("generate-all-content");
};

const handleGlobalClick = (e) => {
  if (editingPath.value !== null) {
    const key = getPathKey(editingPath.value);
    const input = editInputRefs.value[key];
    if (input && !input.contains(e.target)) {
      cancelEdit();
    }
  }
};

const checkIsMobile = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isMobileUserAgent =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent,
    );
  isMobile.value = isTouchDevice && isMobileUserAgent;
};

const isEditing = (path) => {
  return (
    editingPath.value &&
    JSON.stringify(editingPath.value) === JSON.stringify(path)
  );
};

onMounted(() => {
  checkIsMobile();
  document.addEventListener("click", handleGlobalClick);
  window.addEventListener("resize", checkIsMobile);
});

onUnmounted(() => {
  document.removeEventListener("click", handleGlobalClick);
  window.removeEventListener("resize", checkIsMobile);
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
});

/**
 * 清理生成状态 - 用于切换项目时中断生成
 */
const cleanupState = () => {
  // 中断 API 请求
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  // 清空生成路径
  generatingPath.value = null;
};

defineExpose({
  cleanupState,
});
</script>

<template>
  <div class="outline-editor" :class="{ 'is-mobile': isMobile }">
    <div class="outline-header">
      <div class="header-left">
        <div
          class="header-icon"
          :class="{ clickable: true }"
          @click="toggleAllSections"
          :title="isAllExpanded ? '收起所有章节' : '展开所有章节'"
        >
          <Icon v-if="isAllExpanded" name="ChevronUp" :size="20" />
          <Icon v-else name="ChevronDown" :size="20" />
        </div>
        <span class="outline-title">文章大纲</span>
      </div>
      <span class="outline-count">{{ outline.length }} 个章节</span>
    </div>

    <div ref="outlineListRef" class="outline-list">
      <template
        v-for="(item, index) in flatOutline"
        :key="getPathKey(item.path)"
      >
        <div
          v-if="item.level === 0"
          class="outline-item-wrapper outline-item-wrapper-level-0"
          :data-index="item.path[0]"
        >
          <div
            class="outline-item"
            :class="[
              { clickable: item.hasChildren },
              {
                'is-dragging': isDragging && item.path[0] === originalDragIndex,
              },
              {
                'is-animating': isAnimating && item.path[0] === animatingIndex,
              },
            ]"
            :ref="(el) => (itemRefs[index] = el)"
            :style="getItemStyle(item, index)"
            @click="item.hasChildren ? toggleExpand(item.path, $event) : null"
          >
            <div
              class="outline-drag-handle"
              @mousedown="handleDragStart(item.path, $event)"
            >
              <Icon name="GripVertical" :size="18" />
            </div>
            <div class="outline-number">
              {{ getDisplayNumber(item.path) }}
            </div>
            <button
              v-if="item.hasChildren"
              class="expand-btn"
              :class="{ expanded: !item.isCollapsed }"
            >
              <Icon v-if="item.isCollapsed" name="Plus" :size="16" />
              <Icon v-else name="Minus" :size="16" />
            </button>

            <div class="title-area">
              <input
                v-if="isEditing(item.path)"
                v-model="editingValue"
                @blur="saveEdit"
                @keyup.enter="saveEdit"
                @keyup.esc="cancelEdit"
                class="title-input"
                :ref="(el) => (editInputRefs[getPathKey(item.path)] = el)"
                @click.stop
                autofocus
              />
              <span v-else class="section-title">{{
                cleanTitleNumber(item.title)
              }}</span>
            </div>

            <div class="item-actions" @click.stop>
              <div
                class="outline-action-btn outline-edit-btn"
                @click="startEdit(item.path)"
                title="编辑章节"
              >
                <Icon name="Edit3" :size="18" />
              </div>
              <div
                class="outline-action-btn outline-delete-btn"
                @click="deleteSectionByPath(item.path, $event)"
                title="删除章节"
              >
                <Icon name="Trash2" :size="18" />
              </div>
            </div>
          </div>

          <button
            class="generate-sub-btn"
            :class="{
              'disabled-btn': !articleStructure.canAddSubsection(item.path[0]),
            }"
            @click.stop="
              articleStructure.canAddSubsection(item.path[0]) &&
              addSubSectionByPath(item.path, $event)
            "
            :disabled="
              generatingPath === getPathKey(item.path) ||
              !articleStructure.canAddSubsection(item.path[0])
            "
            :title="articleStructure.getSubsectionTooltip(item.path[0])"
          >
            <Icon
              v-if="generatingPath === getPathKey(item.path)"
              name="Loader2"
              :size="16"
              class="spinner"
            />
            <Icon v-else name="Sparkles" :size="16" />
            <span>生成小节</span>
          </button>
        </div>

        <div
          v-else-if="item.level > 0"
          class="outline-item-wrapper"
          :class="`outline-item-wrapper-level-${item.level}`"
        >
          <div
            class="outline-item"
            :class="{ clickable: item.hasChildren }"
            @click="item.hasChildren ? toggleExpand(item.path) : null"
          >
            <div class="outline-number">
              {{ getDisplayNumber(item.path) }}
            </div>
            <button
              v-if="item.hasChildren"
              class="expand-btn"
              :class="{ expanded: !item.isCollapsed }"
            >
              <Icon v-if="item.isCollapsed" name="Plus" :size="16" />
              <Icon v-else name="Minus" :size="16" />
            </button>

            <div class="title-area" @click.stop>
              <input
                v-if="isEditing(item.path)"
                v-model="editingValue"
                @blur="saveEdit"
                @keyup.enter="saveEdit"
                @keyup.esc="cancelEdit"
                class="title-input"
                :ref="(el) => (editInputRefs[getPathKey(item.path)] = el)"
                autofocus
              />
              <span v-else class="section-title">{{
                cleanTitleNumber(item.title)
              }}</span>
            </div>

            <div class="item-actions" @click.stop>
              <div
                class="outline-action-btn outline-locate-btn"
                @click="scrollToSection(item.path)"
                title="快速定位到内容"
              >
                <Icon name="Navigation" :size="18" />
              </div>
              <div
                class="outline-action-btn outline-edit-btn"
                @click="startEdit(item.path)"
                title="编辑章节"
              >
                <Icon name="Edit3" :size="18" />
              </div>
              <div
                class="outline-action-btn outline-delete-btn"
                @click="deleteSectionByPath(item.path, $event)"
                title="删除章节"
              >
                <Icon name="Trash2" :size="18" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <button class="add-section-btn" @click="addSection">
      <Icon name="Plus" :size="18" />
      <span>添加自定义章节</span>
    </button>

    <button
      class="generate-all-btn"
      :class="{
        'disabled-btn': generateAllButtonState === 'completed',
        generating: generateAllButtonState === 'generating',
        paused: generateAllButtonState === 'paused',
      }"
      @click="generateAllContent"
      :disabled="generateAllButtonState === 'completed'"
    >
      <Icon
        v-if="generateAllButtonState === 'generating'"
        name="Loader2"
        :size="18"
        class="spinner"
      />
      <Icon
        v-else-if="generateAllButtonState === 'paused'"
        name="Play"
        :size="18"
      />
      <Icon v-else name="Sparkles" :size="18" />
      <span v-if="generateAllButtonState === 'generating'"
        >正在生成，点击暂停</span
      >
      <span v-else-if="generateAllButtonState === 'paused'"
        >已暂停，点击继续</span
      >
      <span v-else-if="generateAllButtonState === 'completed'"
        >文章已生成完成</span
      >
      <span v-else>一键生成文章</span>
    </button>
  </div>
</template>

<style scoped>
.item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.outline-item:hover .item-actions {
  opacity: 1;
}

.outline-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--text-muted);
  cursor: grab;
  transition: all 0.2s ease;
  border-radius: 6px;
  flex-shrink: 0;
}

.outline-drag-handle:hover {
  color: var(--text-primary);
  background: var(--bg-input);
}

.outline-drag-handle:active {
  cursor: grabbing;
}

.outline-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 6px;
  flex-shrink: 0;
}

.outline-action-btn:hover {
  color: var(--text-primary);
  background: var(--bg-input);
}

.outline-action-btn.outline-delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.outline-editor.is-mobile .item-actions {
  opacity: 1;
}

.outline-editor.is-mobile .outline-drag-handle:active,
.outline-editor.is-mobile .outline-drag-handle:focus {
  background: var(--bg-input);
  color: var(--text-primary);
}

.outline-editor.is-mobile .outline-action-btn:active,
.outline-editor.is-mobile .outline-action-btn:focus {
  background: var(--bg-input);
  color: var(--text-primary);
}

.outline-editor.is-mobile .outline-action-btn.outline-delete-btn:active,
.outline-editor.is-mobile .outline-action-btn.outline-delete-btn:focus {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

@media (max-width: 768px) {
  .item-actions {
    opacity: 1;
    gap: 4px;
  }

  .outline-drag-handle {
    width: 36px;
    height: 36px;
  }

  .outline-action-btn {
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 480px) {
  .outline-action-btn {
    width: 26px;
    height: 26px;
  }

  .outline-drag-handle {
    width: 32px;
    height: 32px;
  }
}
</style>
