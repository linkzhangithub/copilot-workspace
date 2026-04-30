<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps({
  outline: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["update:outline"]);

// 编辑状态
const editingIndex = ref(null);
const editingValue = ref("");
const editWrapperRefs = ref([]);

// 开始编辑
const startEdit = (index) => {
  editingIndex.value = index;
  editingValue.value = props.outline[index].title;
  nextTick(() => {
    const input = document.querySelector(".edit-input");
    if (input) {
      input.focus();
      input.select();
    }
  });
};

// 保存编辑
const saveEdit = () => {
  if (editingIndex.value === null) return;

  const newOutline = [...props.outline];
  newOutline[editingIndex.value] = {
    ...newOutline[editingIndex.value],
    title: editingValue.value.trim(),
  };
  emit("update:outline", newOutline);
  editingIndex.value = null;
};

// 取消编辑
const cancelEdit = () => {
  editingIndex.value = null;
};

// 处理全局点击
const handleGlobalClick = (e) => {
  if (editingIndex.value !== null) {
    const editWrapper = editWrapperRefs.value[editingIndex.value];
    if (editWrapper && !editWrapper.contains(e.target)) {
      cancelEdit();
    }
  }
};

onMounted(() => {
  document.addEventListener("click", handleGlobalClick);
});

onUnmounted(() => {
  document.removeEventListener("click", handleGlobalClick);
});

// 删除章节
const deleteSection = (index, event) => {
  event.stopPropagation();
  const newOutline = props.outline.filter((_, i) => i !== index);
  emit("update:outline", newOutline);
};

// 添加章节
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

// 清理标题中的 markdown 标记
const cleanTitle = (title) => {
  if (!title) return title;
  return title.replace(/^#+\s*/, "").trim();
};
</script>

<template>
  <div class="outline-editor">
    <div class="outline-header">
      <span class="outline-title">文章大纲</span>
      <span class="outline-count">{{ outline.length }} 个章节</span>
    </div>
    <div class="outline-list">
      <div
        v-for="(section, index) in outline"
        :key="section.id || index"
        class="outline-item"
      >
        <div class="item-left">
          <div
            v-if="editingIndex === index"
            class="edit-wrapper"
            @click.stop
            :ref="(el) => (editWrapperRefs[index] = el)"
          >
            <input
              v-model="editingValue"
              @blur="saveEdit"
              @keyup.enter="saveEdit"
              @keyup.esc="cancelEdit"
              class="edit-input"
              autofocus
            />
          </div>
          <div v-else class="title-wrapper">
            <span class="section-number">{{ index + 1 }}</span>
            <span class="section-title">{{ cleanTitle(section.title) }}</span>
          </div>
        </div>
        <div class="item-right">
          <button
            class="edit-btn"
            @click.stop="startEdit(index)"
            title="编辑章节"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              ></path>
              <path
                d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              ></path>
            </svg>
          </button>
          <button
            class="delete-btn"
            @click="deleteSection(index, $event)"
            title="删除章节"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3 6 5 6 21 6"></polyline>
              <path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <button class="add-section-btn" @click="addSection">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      <span>添加章节</span>
    </button>
  </div>
</template>

<style scoped>
.outline-editor {
  margin-bottom: 40px;
}

.outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 8px;
}

.outline-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.outline-count {
  font-size: 13px;
  color: var(--text-muted);
  background-color: var(--bg-hover);
  padding: 2px 8px;
  border-radius: 12px;
}

:global(.light-mode) .outline-count {
  background-color: #e5e7eb;
  color: #4b5563;
}

.outline-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.outline-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  gap: 12px;
  background-color: var(--bg-hover);
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

:global(.light-mode) .outline-item {
  background-color: #f9fafb;
  border-color: #e5e7eb;
}

:global(.light-mode) .outline-item:hover {
  background-color: #f3f4f6;
  border-color: #d1d5db;
}

.outline-item:hover {
  background-color: var(--bg-input);
  border-color: var(--border);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.title-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.section-number {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-muted);
  background-color: var(--bg-input);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  flex-shrink: 0;
}

.section-title {
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
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
  padding: 6px 10px;
  border: 2px solid var(--primary);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  outline: none;
}

.item-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.outline-item:hover .item-right {
  opacity: 1;
}

.edit-btn {
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

.edit-btn:hover {
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.delete-btn {
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

.delete-btn:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.add-section-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  background-color: transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.add-section-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-secondary);
}

:global(.light-mode) .add-section-btn:hover {
  background-color: #f3f4f6;
  color: #1f2937;
}
</style>
