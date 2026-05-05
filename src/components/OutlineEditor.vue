<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import Icon from "./Icon.vue";
import { Edit3, Trash2, Plus } from "lucide-vue-next";

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
        v-for="(section, index) in outline"
        :key="section.id || index"
        class="outline-item"
      >
        <div class="item-left">
          <div class="item-number">{{ index + 1 }}</div>
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
            <span class="section-title">{{ cleanTitle(section.title) }}</span>
          </div>
        </div>
        <div class="item-right">
          <button
            class="action-btn edit-btn"
            @click.stop="startEdit(index)"
            title="编辑章节"
          >
            <Icon name="Edit3" :size="16" />
          </button>
          <button
            class="action-btn delete-btn"
            @click="deleteSection(index, $event)"
            title="删除章节"
          >
            <Icon name="Trash2" :size="16" />
          </button>
        </div>
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

.outline-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 12px;
  gap: 12px;
  background-color: var(--bg-sidebar);
  border: 2px solid var(--border);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 60px;
  box-sizing: border-box;
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

.item-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: white;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
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
  font-size: 15px;
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
  border-radius: 8px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  outline: none;
  box-sizing: border-box;
  height: 32px;
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
  width: 36px;
  height: 36px;
  border: none;
  background-color: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 8px;
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
</style>
