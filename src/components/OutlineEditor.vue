<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
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
});

const emit = defineEmits(["update:outline"]);

const editingPath = ref(null);
const editingValue = ref("");
const editInputRefs = ref({});
const expandedState = ref({});
const generatingPath = ref(null);
const draggedIndex = ref(null);
const overIndex = ref(null);
const touchStartY = ref(0);
const isTouchDragging = ref(false);

const flatOutline = computed(() => {
  const result = [];

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

  flatten(props.outline);
  return result;
});

const getPathKey = (path) => path.join("-");

const toggleExpand = (path, event) => {
  if (event) event.stopPropagation();
  const key = getPathKey(path);
  expandedState.value[key] = !expandedState.value[key];
};

const addSubSectionByPath = async (path, event) => {
  event.stopPropagation();

  const pathKey = getPathKey(path);
  generatingPath.value = pathKey;

  try {
    const sectionIndex = path[0];
    const currentSection = props.outline[sectionIndex];

    // 调用AI生成子章节
    const response = await fetch("/api/ai/generate-outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: currentSection.title }),
    });

    const result = await response.json();

    let subSections = [];

    if (result.success && result.data.length > 0) {
      // 使用AI返回的子章节
      const firstItem = result.data[0];
      if (firstItem.children && firstItem.children.length > 0) {
        subSections = firstItem.children;
      } else if (result.data.length > 1) {
        subSections = result.data.slice(1).map((item) => item.title);
      } else {
        subSections = ["要点一", "要点二", "要点三"];
      }
    } else {
      subSections = ["要点一", "要点二", "要点三"];
    }

    const timestamp = Date.now();

    // 逐个显示子章节，有动画效果
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

      // 添加到i位置（当前这一步）
      const title = subSections[i];
      current[path[path.length - 1]].children.push({
        id: `subsection-${timestamp}-${i}`,
        title: typeof title === "string" ? title : title.title,
        children: [],
      });

      emit("update:outline", newOutline);

      // 延迟一下，让动画更自然（最后一个不需要延迟）
      if (i < subSections.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  } catch (err) {
    console.error("生成子章节失败:", err);

    // 如果API失败，使用fallback数据，也用逐个显示效果
    const fallbackSections = ["要点一", "要点二", "要点三"];
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

const cleanTitle = (title) => {
  if (!title) return title;
  return title.replace(/^#+\s*/, "").trim();
};

const getDisplayNumber = (path) => path.map((p) => p + 1).join(".") + ".";

// 拖拽相关函数
const handleDragStart = (path, event) => {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", path[0].toString());
  }
  draggedIndex.value = path[0];
};

const handleDragOver = (path, event) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  overIndex.value = path[0];
};

const handleDragLeave = () => {
  overIndex.value = null;
};

const handleDrop = (targetPath, event) => {
  event.preventDefault();
  const targetIndex = targetPath[0];

  if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
    draggedIndex.value = null;
    overIndex.value = null;
    return;
  }

  const deepClone = (arr) => {
    return arr.map((item) => ({
      ...item,
      children: item.children ? deepClone(item.children) : [],
    }));
  };

  const newOutline = deepClone(props.outline);
  const [removed] = newOutline.splice(draggedIndex.value, 1);
  newOutline.splice(targetIndex, 0, removed);

  emit("update:outline", newOutline);

  draggedIndex.value = null;
  overIndex.value = null;
};

const handleDragEnd = () => {
  draggedIndex.value = null;
  overIndex.value = null;
};

// 移动端触摸事件
const touchMoveThreshold = 10; // 移动超过10px才认为是拖动

const handleTouchStart = (path, event) => {
  if (event.touches.length !== 1) return;
  touchStartY.value = event.touches[0].clientY;
  isTouchDragging.value = false; // 初始不认为是拖动
  draggedIndex.value = path[0];
};

const handleTouchMove = (path, event) => {
  if (event.touches.length !== 1) return;

  const touch = event.touches[0];
  const diffY = Math.abs(touch.clientY - touchStartY.value);

  // 只有移动超过阈值才认为是拖动
  if (!isTouchDragging.value && diffY > touchMoveThreshold) {
    isTouchDragging.value = true;
    event.preventDefault(); // 防止滚动
  }

  if (isTouchDragging.value) {
    event.preventDefault();
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target) {
      const wrapper = target.closest(".outline-item-wrapper");
      if (wrapper) {
        const index = parseInt(wrapper.dataset.index);
        if (!isNaN(index) && index !== draggedIndex.value) {
          overIndex.value = index;
        }
      }
    }
  }
};

const handleTouchEnd = (path, event) => {
  if (!isTouchDragging.value) {
    // 如果不是拖动，重置状态
    draggedIndex.value = null;
    overIndex.value = null;
    return;
  }

  isTouchDragging.value = false;

  if (overIndex.value !== null && draggedIndex.value !== overIndex.value) {
    const deepClone = (arr) => {
      return arr.map((item) => ({
        ...item,
        children: item.children ? deepClone(item.children) : [],
      }));
    };
    const newOutline = deepClone(props.outline);
    const [removed] = newOutline.splice(draggedIndex.value, 1);
    newOutline.splice(overIndex.value, 0, removed);
    emit("update:outline", newOutline);
  }

  draggedIndex.value = null;
  overIndex.value = null;
};

onMounted(() => document.addEventListener("click", handleGlobalClick));
onUnmounted(() => document.removeEventListener("click", handleGlobalClick));
</script>

<template>
  <div class="outline-editor">
    <div class="outline-header">
      <div class="header-left">
        <div class="header-icon">
          <Icon name="List" :size="20" />
        </div>
        <span class="outline-title">文章大纲</span>
      </div>
      <span class="outline-count">{{ outline.length }} 个章节</span>
    </div>

    <div class="outline-list">
      <div
        v-for="item in flatOutline"
        :key="getPathKey(item.path)"
        class="outline-item-wrapper"
        :data-index="item.level === 0 ? item.path[0] : undefined"
        :class="[
          `outline-item-wrapper-level-${item.level}`,
          {
            dragging: item.level === 0 && draggedIndex === item.path[0],
            'drag-over': item.level === 0 && overIndex === item.path[0],
          },
        ]"
        :draggable="item.level === 0"
        @dragstart="
          item.level === 0 ? handleDragStart(item.path, $event) : null
        "
        @dragover="item.level === 0 ? handleDragOver(item.path, $event) : null"
        @dragleave="item.level === 0 ? handleDragLeave() : null"
        @drop="item.level === 0 ? handleDrop(item.path, $event) : null"
        @dragend="item.level === 0 ? handleDragEnd() : null"
        @touchstart="
          item.level === 0 ? handleTouchStart(item.path, $event) : null
        "
        @touchmove="
          item.level === 0 ? handleTouchMove(item.path, $event) : null
        "
        @touchend="item.level === 0 ? handleTouchEnd(item.path, $event) : null"
      >
        <div
          class="outline-item"
          :class="{ clickable: item.hasChildren }"
          @click="item.hasChildren ? toggleExpand(item.path) : null"
        >
          <div class="item-left">
            <div class="outline-number">{{ getDisplayNumber(item.path) }}</div>
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
              v-if="item.level === 0"
              class="drag-handle"
              :class="{ 'drag-handle-active': draggedIndex === item.path[0] }"
            >
              <Icon name="GripVertical" :size="18" />
            </div>
            <button
              class="action-btn edit-btn"
              @click="startEdit(item.path)"
              title="编辑章节"
            >
              <Icon name="Edit3" :size="16" />
            </button>
            <button
              class="action-btn delete-btn"
              @click="deleteSectionByPath(item.path, $event)"
              title="删除章节"
            >
              <Icon name="Trash2" :size="16" />
            </button>
          </div>
        </div>

        <button
          v-if="item.level === 0"
          class="generate-sub-btn"
          @click.stop="addSubSectionByPath(item.path, $event)"
          :disabled="generatingPath === getPathKey(item.path)"
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
    </div>

    <button class="add-section-btn" @click="addSection">
      <Icon name="Plus" :size="18" />
      <span>添加章节</span>
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
}

.outline-item-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.outline-item-wrapper.dragging {
  opacity: 0.4;
  transform: scale(0.98);
}

.outline-item-wrapper.drag-over {
  transform: translateY(-2px);
}

.outline-item-wrapper.drag-over::before {
  content: "";
  position: absolute;
  left: 0;
  top: -8px;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  border-radius: 2px;
  animation: pulse 1.5s ease-in-out infinite;
}

.outline-item-wrapper.drag-over .outline-item {
  border-color: var(--primary);
  background: linear-gradient(
    135deg,
    rgba(99, 91, 255, 0.05),
    rgba(34, 211, 238, 0.05)
  );
}

.outline-item-wrapper[draggable="true"] {
  cursor: grab;
}

.outline-item-wrapper[draggable="true"]:active {
  cursor: grabbing;
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

.drag-handle:active,
.drag-handle-active {
  color: var(--primary);
  cursor: grabbing;
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 56px;
  box-sizing: border-box;
  flex: 1;
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
}

.edit-wrapper {
  flex: 1;
}

.edit-input {
  width: 100%;
  padding: 0;
  border: 2px solid var(--primary);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  outline: none;
  box-sizing: border-box;
  height: 28px;
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

.generate-article-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: none;
  background-color: var(--primary);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}

.generate-article-btn:hover {
  background-color: var(--primary-hover);
  transform: translateY(-1px);
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
  width: 32px;
  height: 32px;
  border: none;
  background-color: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.delete-btn:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--danger);
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

.generate-sub-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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
    opacity: 1;
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
    width: 28px;
    height: 28px;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .generate-sub-btn {
    padding: 8px 12px;
    font-size: 12px;
    gap: 4px;
  }

  .drag-handle {
    width: 24px;
    height: 24px;
  }

  .drag-handle svg {
    width: 16px;
    height: 16px;
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
