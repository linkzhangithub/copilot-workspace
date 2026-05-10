<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import Icon from "./Icon.vue";
import {
  Edit3,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  ChevronDown,
  Loader2,
  GripVertical,
} from "lucide-vue-next";

const props = defineProps({
  outline: {
    type: Array,
    required: true,
  },
  hasGeneratedAllContent: {
    type: Boolean,
    default: false,
  },
  isGeneratingAll: {
    type: Boolean,
    default: false,
  },
  isPaused: {
    type: Boolean,
    default: false,
  },
  generateAllButtonState: {
    type: String,
    default: "ready",
  },
});

const emit = defineEmits([
  "update:outline",
  "show-toast",
  "generate-all-content",
  "scroll-to-section",
]);

// 限制常量
const MAX_CHAPTERS = 8;
const MAX_SUBSECTIONS_PER_CHAPTER = 10;
const MAX_TOTAL_SUBSECTIONS = 50;

// 计算文章结构状态
const articleStructure = computed(() => {
  const chapterCount = props.outline.length;
  let totalSubsections = 0;
  const chapterSubsectionCounts = props.outline.map((chapter) => {
    const count = chapter.children?.length || 0;
    totalSubsections += count;
    return count;
  });

  return {
    chapterCount,
    totalSubsections,
    chapterSubsectionCounts,
    canAddChapter: chapterCount < MAX_CHAPTERS,
    canAddSubsection: (chapterIndex) => {
      const chapterSubCount = chapterSubsectionCounts[chapterIndex] || 0;
      return (
        chapterSubCount < MAX_SUBSECTIONS_PER_CHAPTER &&
        totalSubsections < MAX_TOTAL_SUBSECTIONS
      );
    },
    getSubsectionTooltip: (chapterIndex) => {
      const chapterSubCount = chapterSubsectionCounts[chapterIndex] || 0;
      if (totalSubsections >= MAX_TOTAL_SUBSECTIONS) {
        return "文章结构已充实，建议专注内容创作";
      }
      if (chapterSubCount >= MAX_SUBSECTIONS_PER_CHAPTER) {
        return "AI 建议的小节已完善，可手动调整";
      }
      return "";
    },
  };
});

const isMobile = ref(false);

const editingPath = ref(null);
const editingValue = ref("");
const editInputRefs = ref({});
const expandedState = ref({});
const generatingPath = ref(null);

// 拖拽相关状态
const isDragging = ref(false);
const dragIndex = ref(-1);
const dragStartY = ref(0);
const currentDragY = ref(0);
const itemRefs = ref([]);
const outlineListRef = ref(null);
const localOutline = ref([]);

const flatOutline = computed(() => {
  const result = [];
  const outlineToUse =
    isDragging.value && localOutline.value.length > 0
      ? localOutline.value
      : props.outline;

  const flatten = (items, path = [], level = 0, parentCollapsed = false) => {
    items.forEach((item, index) => {
      const currentPath = [...path, index];
      const pathKey = getPathKey(currentPath);
      const hasChildren = item.children && item.children.length > 0;
      const isCollapsed = expandedState.value[pathKey] ?? false;

      result.push({
        ...item,
        path: currentPath,
        level,
        hasChildren,
        isCollapsed,
      });

      if (hasChildren && !isCollapsed && !parentCollapsed) {
        flatten(item.children, currentPath, level + 1, isCollapsed);
      }
    });
  };

  flatten(outlineToUse);
  return result;
});

// 获取一级章节的索引映射
const getLevel0Info = () => {
  const level0Info = [];
  flatOutline.value.forEach((item, idx) => {
    if (item.level === 0) {
      level0Info.push({
        index: item.path[0],
        flatIndex: idx,
        item: item,
      });
    }
  });
  return level0Info;
};

const getPathKey = (path) => path.join("-");

const toggleExpand = (path, event) => {
  if (event) event.stopPropagation();
  const key = getPathKey(path);
  const current = expandedState.value[key] ?? true;
  expandedState.value[key] = !current;
};

const getAllExistingTitles = () => {
  const titles = new Set();
  const collect = (items) => {
    items.forEach((item) => {
      if (item.title) {
        titles.add(item.title.trim().toLowerCase());
      }
      if (item.children && item.children.length > 0) {
        collect(item.children);
      }
    });
  };
  collect(props.outline);
  return titles;
};

const addSubSectionByPath = async (path, event) => {
  event.stopPropagation();

  if (!articleStructure.value.canAddSubsection(path[0])) {
    const tooltip = articleStructure.value.getSubsectionTooltip(path[0]);
    emit("show-toast", tooltip, "warning", 3000);
    return;
  }

  const pathKey = getPathKey(path);
  generatingPath.value = pathKey;

  try {
    const currentSection = getSectionByPath(path);
    const existingTitles = getAllExistingTitles();

    const response = await fetch("/api/ai/generate-subsections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: currentSection.title,
        existingTitles: Array.from(existingTitles),
      }),
    });

    const result = await response.json();

    let subSections = [];

    if (result.success && result.data && result.data.length > 0) {
      subSections = result.data.filter((title) => {
        const normalized = (typeof title === "string" ? title : title.title)
          .trim()
          .toLowerCase();
        return !existingTitles.has(normalized);
      });
    }

    if (subSections.length === 0 && result.data && result.data.length > 0) {
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
      const deepClone = (arr) => {
        return arr.map((item) => ({
          ...item,
          children: item.children ? deepClone(item.children) : [],
        }));
      };
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
    console.error("生成子章节失败:", err);

    const section = getSectionByPath(path);
    const fallbackSections = [
      `${section.title}概述`,
      `${section.title}要点`,
      `${section.title}应用`,
    ];
    const timestamp = Date.now();

    for (let i = 0; i < fallbackSections.length; i++) {
      const deepClone = (arr) => {
        return arr.map((item) => ({
          ...item,
          children: item.children ? deepClone(item.children) : [],
        }));
      };
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
  }
};

const scrollToSection = (path) => {
  emit("scroll-to-section", path);
};

const startEdit = (path) => {
  editingPath.value = path;
  editingValue.value = getSectionByPath(path).title;
  nextTick(() => {
    const key = getPathKey(path);
    const input = editInputRefs.value[key];
    if (input && input.focus) {
      input.focus();
      if (input.select) input.select();
    }
  });
};

const saveEdit = () => {
  if (editingPath.value === null) return;
  updateSectionByPath(editingPath.value, {
    title: editingValue.value.trim(),
  });
  editingPath.value = null;
};

const cancelEdit = () => {
  editingPath.value = null;
};

const getSectionByPath = (path) => {
  let current = props.outline;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]].children;
  }
  return current[path[path.length - 1]];
};

const updateSectionByPath = (path, updates) => {
  const deepClone = (arr) => {
    return arr.map((item) => ({
      ...item,
      children: item.children ? deepClone(item.children) : [],
    }));
  };
  const newOutline = deepClone(props.outline);
  let current = newOutline;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]].children;
  }
  current[path[path.length - 1]] = {
    ...current[path[path.length - 1]],
    ...updates,
  };
  emit("update:outline", newOutline);
};

const deleteSectionByPath = (path, event) => {
  event.stopPropagation();
  const deepClone = (arr) => {
    return arr.map((item) => ({
      ...item,
      children: item.children ? deepClone(item.children) : [],
    }));
  };
  const newOutline = deepClone(props.outline);
  let current = newOutline;
  if (path.length === 1) {
    const updated = newOutline.filter((_, i) => i !== path[0]);
    emit("update:outline", updated);
  } else {
    for (let i = 0; i < path.length - 2; i++) {
      current = current[path[i]].children;
    }
    const parent = current[path[path.length - 2]].children;
    parent.splice(path[path.length - 1], 1);
    emit("update:outline", newOutline);
  }
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

const addSection = () => {
  if (!articleStructure.value.canAddChapter) {
    emit("show-toast", "文章结构已完善，建议专注内容创作", "warning", 3000);
    return;
  }

  const newOutline = [
    ...props.outline,
    {
      id: `section-${Date.now()}`,
      title: "新章节",
      children: [],
    },
  ];
  emit("update:outline", newOutline);
};

const generateAllContent = () => {
  if (props.hasGeneratedAllContent) {
    emit("show-toast", "文章内容已生成，可手动调整", "warning", 3000);
    return;
  }

  const hasSubsections = props.outline.some(
    (chapter) => chapter.children && chapter.children.length > 0,
  );

  if (!hasSubsections) {
    emit("show-toast", "请先添加小节", "warning", 3000);
    return;
  }

  emit("generate-all-content");
};

const cleanTitle = (title) => {
  if (!title) return title;
  return title.replace(/^#+\s*/, "").trim();
};

const getDisplayNumber = (path) => path.map((p) => p + 1).join(".");

// 收起所有展开的小节
const collapseAll = () => {
  const newState = {};
  // 遍历所有章节，设置为折叠状态
  props.outline.forEach((chapter, index) => {
    const pathKey = getPathKey([index]);
    newState[pathKey] = true; // true表示折叠
  });
  expandedState.value = newState;
};

// 深拷贝函数
const deepClone = (arr) => {
  return arr.map((item) => ({
    ...item,
    children: item.children ? deepClone(item.children) : [],
  }));
};

// ================= 拖拽核心逻辑 =================

const handleDragStart = (path, event) => {
  if (isDragging.value) return;

  // 开始拖拽时，收起所有展开的小节
  collapseAll();

  dragIndex.value = path[0];

  // 初始化本地状态
  localOutline.value = deepClone(props.outline);

  // 记录初始位置
  nextTick(() => {
    dragStartY.value = event.clientY;
    currentDragY.value = 0;
    isDragging.value = true;
  });

  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);
  event.preventDefault();
  event.stopPropagation();
};

const handleDragMove = (event) => {
  if (!isDragging.value || dragIndex.value === -1) return;

  const deltaY = event.clientY - dragStartY.value;

  // 限制拖拽范围（视觉上不能超出大纲区域）
  const itemHeight = 66; // 预估每个元素的高度 + gap
  const maxDragUp = -dragIndex.value * itemHeight; // 最大向上拖拽距离
  const maxDragDown =
    (localOutline.value.length - 1 - dragIndex.value) * itemHeight; // 最大向下拖拽距离
  currentDragY.value = Math.max(maxDragUp, Math.min(maxDragDown, deltaY));

  // 计算应该交换到的位置
  const movedItems = Math.round(deltaY / itemHeight);
  let targetPosition = dragIndex.value + movedItems;

  // 限制范围
  targetPosition = Math.max(
    0,
    Math.min(targetPosition, localOutline.value.length - 1),
  );

  // 如果位置变化，立即交换本地状态
  if (targetPosition !== dragIndex.value) {
    const [removed] = localOutline.value.splice(dragIndex.value, 1);
    localOutline.value.splice(targetPosition, 0, removed);

    // 更新拖拽索引
    dragIndex.value = targetPosition;

    // 重置拖拽起点，避免累积误差
    dragStartY.value = event.clientY;
    currentDragY.value = 0;
  }
};

const handleDragEnd = (event) => {
  if (!isDragging.value) return;

  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);

  // 提交最终结果
  if (localOutline.value.length > 0) {
    emit("update:outline", localOutline.value);
  }

  // 重置所有状态
  isDragging.value = false;
  dragIndex.value = -1;
  currentDragY.value = 0;
  localOutline.value = [];
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

// 计算元素的偏移量样式
const getItemStyle = (item, index) => {
  if (!item || item.level !== 0) return {};

  // 只有当前正在拖拽的元素才有跟随鼠标的效果
  if (isDragging.value && item.path[0] === dragIndex.value) {
    return {
      position: "relative",
      zIndex: 1000,
      transform: `translateY(${currentDragY.value}px) scale(1.02)`,
      boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
      transition: "box-shadow 0.15s ease, transform 0s",
    };
  }

  return {};
};
</script>

<template>
  <div class="outline-editor" :class="{ 'is-mobile': isMobile }">
    <div class="outline-header">
      <div class="header-left">
        <div class="header-icon">
          <Icon name="List" :size="20" />
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
                'is-dragging': isDragging && item.path[0] === dragIndex,
              },
            ]"
            :ref="(el) => (itemRefs[index] = el)"
            :style="getItemStyle(item, index)"
            @click="item.hasChildren ? toggleExpand(item.path) : null"
          >
            <div class="item-left">
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

              <div
                v-if="
                  editingPath &&
                  JSON.stringify(editingPath) === JSON.stringify(item.path)
                "
                class="edit-wrapper"
                @click.stop
              >
                <input
                  v-model="editingValue"
                  @blur="saveEdit"
                  @keyup.enter="saveEdit"
                  @keyup.esc="cancelEdit"
                  class="edit-input"
                  :ref="(el) => (editInputRefs[getPathKey(item.path)] = el)"
                  autofocus
                />
              </div>

              <div v-else class="title-wrapper">
                <span class="section-title">{{ cleanTitle(item.title) }}</span>
              </div>
            </div>

            <div class="item-right" @click.stop>
              <div
                class="drag-handle"
                @mousedown="handleDragStart(item.path, $event)"
              >
                <Icon name="GripVertical" :size="18" />
              </div>
              <div
                class="action-btn edit-btn"
                @click="startEdit(item.path)"
                title="编辑章节"
              >
                <Icon name="Edit3" :size="18" />
              </div>
              <div
                class="action-btn delete-btn"
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
            <div class="item-left">
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

              <div
                v-if="
                  editingPath &&
                  JSON.stringify(editingPath) === JSON.stringify(item.path)
                "
                class="edit-wrapper"
                @click.stop
              >
                <input
                  v-model="editingValue"
                  @blur="saveEdit"
                  @keyup.enter="saveEdit"
                  @keyup.esc="cancelEdit"
                  class="edit-input"
                  :ref="(el) => (editInputRefs[getPathKey(item.path)] = el)"
                  autofocus
                />
              </div>

              <div v-else class="title-wrapper">
                <span class="section-title">{{ cleanTitle(item.title) }}</span>
              </div>
            </div>

            <div class="item-right" @click.stop>
              <div
                class="action-btn locate-btn"
                @click="scrollToSection(item.path)"
                title="快速定位到内容"
              >
                <Icon name="Navigation" :size="18" />
              </div>
              <div
                class="action-btn edit-btn"
                @click="startEdit(item.path)"
                title="编辑章节"
              >
                <Icon name="Edit3" :size="18" />
              </div>
              <div
                class="action-btn delete-btn"
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
.outline-editor {
  margin-bottom: 48px;
}

.outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  border-radius: 10px;
  color: white;
}

.outline-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.outline-count {
  font-size: 13px;
  color: var(--text-muted);
  background-color: var(--bg-hover);
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 600;
}

.outline-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
  position: relative;
}

.outline-item-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.outline-item-wrapper-level-1 {
  margin-left: 24px;
}

.outline-item-wrapper-level-2 {
  margin-left: 48px;
}

.outline-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 10px;
  gap: 10px;
  background-color: var(--bg-sidebar);
  border: 2px solid var(--border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 56px;
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

.outline-item.clickable {
  cursor: pointer;
}

.outline-item:hover {
  background-color: var(--bg-hover);
  border-color: var(--text-muted);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.outline-item.is-dragging {
  pointer-events: none;
  transition: box-shadow 0.15s ease;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.outline-number {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.outline-item-wrapper-level-1 .outline-number {
  color: var(--text-secondary);
  font-size: 13px;
}

.outline-item-wrapper-level-2 .outline-number {
  color: var(--text-secondary);
  font-size: 12px;
}

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background-color: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.expand-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.title-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.section-title {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

.edit-wrapper {
  flex: 1;
  min-width: 0;
}

.edit-input {
  width: 100%;
  min-width: 0;
  padding: 0 8px;
  border: 2px solid var(--primary);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  outline: none;
  box-sizing: border-box;
  height: 28px;
  resize: none;
}

.generate-sub-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  background-color: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.generate-sub-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(99, 91, 255, 0.15);
}

.generate-sub-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.generate-sub-btn.disabled-btn {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: var(--border);
  color: var(--text-muted);
}

.generate-sub-btn.disabled-btn:hover {
  border-color: var(--border);
  color: var(--text-muted);
  transform: none;
  box-shadow: none;
}

.item-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.outline-item:hover .item-right {
  opacity: 1;
}

.action-btn {
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

.action-btn:hover {
  color: var(--text-primary);
  background: var(--bg-input);
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.drag-handle {
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

.drag-handle:hover {
  color: var(--text-primary);
  background: var(--bg-input);
}

.drag-handle:active {
  color: var(--primary);
  cursor: grabbing;
}

.add-section-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border: 2px dashed var(--border);
  background-color: transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
  justify-content: center;
}

.add-section-btn:hover {
  border-color: var(--primary);
  background-color: rgba(14, 165, 233, 0.05);
  color: var(--primary);
}

.generate-all-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 2px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
  justify-content: center;
  margin-top: 12px;
}

.generate-all-btn:hover:not(:disabled) {
  background-color: var(--primary);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.3);
}

.generate-all-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.generate-all-btn.disabled-btn {
  border-color: var(--border);
  background-color: var(--bg-sidebar);
  color: var(--text-muted);
}

.generate-all-btn.generating {
  border-color: var(--primary);
  background-color: rgba(14, 165, 233, 0.1);
  color: var(--primary);
}

.generate-all-btn.paused {
  border-color: #9333ea;
  background-color: rgba(147, 51, 234, 0.1);
  color: #9333ea;
}

.spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* 真实移动设备的样式（和屏幕宽度无关） */
.outline-editor.is-mobile .item-right {
  opacity: 1;
}

.outline-editor.is-mobile .action-btn:active,
.outline-editor.is-mobile .action-btn:focus {
  background: var(--bg-input);
  color: var(--text-primary);
}

.outline-editor.is-mobile .delete-btn:active,
.outline-editor.is-mobile .delete-btn:focus {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

/* ===== 响应式设计 - 移动端适配 ===== */
@media (max-width: 768px) {
  .outline-editor {
    margin-bottom: 36px;
  }

  .outline-header {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .header-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
  }

  .header-icon svg {
    width: 18px;
    height: 18px;
  }

  .outline-title {
    font-size: 16px;
  }

  .outline-count {
    font-size: 12px;
  }

  .outline-list {
    gap: 10px;
  }

  .outline-item-wrapper {
    gap: 8px;
  }

  .outline-item {
    padding: 10px 12px;
    min-height: 50px;
  }

  .item-left {
    gap: 8px;
  }

  .outline-number {
    font-size: 13px;
  }

  .outline-item-wrapper-level-1 .outline-number {
    font-size: 12px;
  }

  .outline-item-wrapper-level-2 .outline-number {
    font-size: 11px;
  }

  .section-title {
    font-size: 13px;
  }

  .edit-input {
    font-size: 13px;
    height: 26px;
  }

  .item-right {
    gap: 4px;
  }

  .drag-handle {
    width: 36px;
    height: 36px;
  }

  .drag-handle svg {
    width: 20px;
    height: 20px;
  }

  .action-btn {
    width: 36px;
    height: 36px;
  }

  .action-btn svg {
    width: 20px;
    height: 20px;
  }

  .generate-sub-btn {
    padding: 8px 12px;
    font-size: 12px;
    gap: 4px;
  }

  .outline-item-wrapper-level-0 {
    padding-left: 0;
  }

  .outline-item-wrapper-level-1 {
    padding-left: 24px;
  }

  .outline-item-wrapper-level-2 {
    padding-left: 44px;
  }

  .add-section-btn {
    padding: 12px 16px;
    font-size: 13px;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .outline-editor {
    margin-bottom: 28px;
  }

  .outline-header {
    margin-bottom: 14px;
  }

  .header-icon {
    width: 32px;
    height: 32px;
  }

  .header-icon svg {
    width: 16px;
    height: 16px;
  }

  .outline-title {
    font-size: 15px;
  }

  .outline-list {
    gap: 8px;
  }

  .outline-item-wrapper {
    gap: 6px;
  }

  .outline-item {
    padding: 8px 10px;
    min-height: 46px;
    gap: 8px;
  }

  .outline-number {
    font-size: 12px;
  }

  .outline-item-wrapper-level-1 .outline-number {
    font-size: 11px;
  }

  .outline-item-wrapper-level-2 .outline-number {
    font-size: 10px;
  }

  .section-title {
    font-size: 12px;
  }

  .edit-input {
    font-size: 12px;
    height: 24px;
  }

  .action-btn {
    width: 26px;
    height: 26px;
  }

  .action-btn svg {
    width: 13px;
    height: 13px;
  }

  .generate-sub-btn {
    padding: 7px 10px;
    font-size: 11px;
  }

  .generate-sub-btn span {
    display: none;
  }

  .drag-handle {
    width: 32px;
    height: 32px;
  }

  .drag-handle svg {
    width: 18px;
    height: 18px;
  }

  .outline-item-wrapper-level-1 {
    padding-left: 16px;
  }

  .outline-item-wrapper-level-2 {
    padding-left: 30px;
  }

  .add-section-btn {
    padding: 10px 14px;
    font-size: 12px;
    gap: 6px;
  }
}
</style>
