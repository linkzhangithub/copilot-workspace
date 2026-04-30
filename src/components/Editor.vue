<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from "vue";
import OutlineEditor from "./OutlineEditor.vue";
import ContentGenerator from "./ContentGenerator.vue";

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update-project"]);

// 状态
const outline = ref([]);
const error = ref("");
const loading = ref(false);
const isEditingTitle = ref(false);
const editingTitle = ref("");
const editTitleWrapper = ref(null);
const titleInput = ref(null);

// 计算导出按钮是否可用
const canExport = computed(() => {
  return (
    outline.value.length > 0 || outline.value.some((section) => section.content)
  );
});

// 给 outline 项目添加唯一 id
const addIdsToOutline = (outline) => {
  return outline.map((item, index) => ({
    ...item,
    id: item.id || `section-${Date.now()}-${index}`,
  }));
};

// 本地存储
const getStorageKey = () => `vue-project-${props.project.id}`;

const loadFromStorage = () => {
  try {
    const saved = localStorage.getItem(getStorageKey());
    if (saved) {
      const data = JSON.parse(saved);
      outline.value = addIdsToOutline(data.outline || []);
    }
  } catch (e) {
    console.error("加载失败:", e);
  }
};

const saveToStorage = () => {
  try {
    localStorage.setItem(
      getStorageKey(),
      JSON.stringify({
        outline: outline.value,
      }),
    );
  } catch (e) {
    console.error("保存失败:", e);
  }
};

// 大纲变化时自动保存
watch(outline, saveToStorage, { deep: true });

// 生成大纲
const generateOutline = async () => {
  error.value = "";
  loading.value = true;

  try {
    const response = await fetch("/api/ai/generate-outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: props.project.name }),
    });

    const result = await response.json();

    if (result.success) {
      outline.value = addIdsToOutline(result.data);
    } else {
      error.value = result.error || "生成大纲失败";
    }
  } catch (err) {
    console.error("请求失败:", err);
    // 先用 mock 数据
    const mockOutline = [
      { title: "概述", children: ["什么是" + props.project.name, "重要性"] },
      { title: "技术原理", children: ["核心技术", "工作流程"] },
      { title: "应用场景", children: ["场景一", "场景二"] },
      { title: "未来展望", children: ["发展趋势", "挑战与机遇"] }
    ];
    outline.value = addIdsToOutline(mockOutline);
  } finally {
    loading.value = false;
  }
};

// 更新大纲
const updateOutline = (newOutline) => {
  outline.value = newOutline;
};

// 导出 Markdown
const exportMarkdown = () => {
  let markdown = "";

  if (props.project.name) {
    markdown += `# ${props.project.name}\n\n`;
  }

  outline.value.forEach((section, index) => {
    markdown += `## ${section.title}\n\n`;
    if (section.content) {
      markdown += `${section.content}\n\n`;
    }
  });

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${props.project.name || "document"}.md`;
  a.click();
  URL.revokeObjectURL(url);
};

// 编辑标题
const startEditTitle = () => {
  isEditingTitle.value = true;
  editingTitle.value = props.project.name;
  nextTick(() => {
    if (titleInput.value) {
      titleInput.value.focus();
      titleInput.value.select();
    }
  });
};

// 处理全局点击，在编辑区域外点击时取消编辑
const handleGlobalClick = (e) => {
  if (isEditingTitle.value && editTitleWrapper.value) {
    if (!editTitleWrapper.value.contains(e.target)) {
      cancelEditTitle();
    }
  }
};

const saveEditTitle = () => {
  if (editingTitle.value.trim()) {
    emit("update-project", props.project.id, editingTitle.value.trim());
  }
  isEditingTitle.value = false;
};

const cancelEditTitle = () => {
  isEditingTitle.value = false;
};

// 暴露方法给父组件
defineExpose({
  exportMarkdown,
  canExport,
});

onMounted(() => {
  loadFromStorage();
  document.addEventListener("click", handleGlobalClick);
});

onUnmounted(() => {
  document.removeEventListener("click", handleGlobalClick);
});
</script>

<template>
  <div class="editor">
    <div class="editor-content">
      <!-- 错误提示 -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- 项目主题区 -->
      <div class="topic-section">
        <div class="topic-wrapper">
          <!-- 标题容器 - 一直有背景色，像 outline-item 一样 -->
          <div
            class="title-wrapper"
            ref="editTitleWrapper"
            @dblclick="!isEditingTitle && startEditTitle()"
          >
            <!-- 编辑状态 -->
            <div v-if="isEditingTitle" class="edit-wrapper" @click.stop>
              <input
                v-model="editingTitle"
                @blur="saveEditTitle"
                @keyup.enter="saveEditTitle"
                @keyup.esc="cancelEditTitle"
                class="edit-title-input"
                ref="titleInput"
                autofocus
              />
            </div>
            <!-- 非编辑状态 -->
            <h1 v-else class="project-title">{{ project.name }}</h1>

            <!-- 编辑按钮区域 -->
            <div class="topic-right">
              <button
                v-if="!isEditingTitle"
                class="edit-btn"
                @click.stop="startEditTitle"
                title="编辑标题"
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
            </div>
          </div>
          <button
            class="generate-btn"
            @click="generateOutline"
            :disabled="loading"
          >
            <svg
              v-if="!loading"
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
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              ></polygon>
            </svg>
            <svg
              v-else
              class="spinner"
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
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke-dasharray="40 20"
                stroke-dashoffset="0"
              ></circle>
            </svg>
            <span>生成大纲</span>
          </button>
        </div>
        <p v-if="outline.length === 0" class="topic-hint">
          点击生成大纲，AI 将为你创建文章结构
        </p>
      </div>

      <!-- 大纲编辑器 -->
      <OutlineEditor
        v-if="outline.length > 0"
        :outline="outline"
        @update:outline="updateOutline"
      />

      <!-- 内容生成器 -->
      <ContentGenerator
        v-if="outline.length > 0"
        :outline="outline"
        @update:outline="updateOutline"
      />
    </div>
  </div>
</template>

<style scoped>
.editor {
  height: 100%;
  overflow-y: auto;
  background-color: var(--bg-page);
}

.editor-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 24px;
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 24px;
  font-size: 14px;
}

/* 项目主题区 */
.topic-section {
  margin-bottom: 32px;
}

.topic-wrapper {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 标题容器 - 一直有背景色，像 outline-item 一样 */
.title-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  cursor: text;
  padding: 6px 10px;
  border-radius: 6px;
  gap: 12px;
  background-color: var(--bg-hover);
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

/* hover 时背景加深 */
.title-wrapper:hover {
  background-color: var(--bg-input);
  border-color: var(--border);
}

/* 编辑按钮区域 */
.topic-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.title-wrapper:hover .topic-right {
  opacity: 1;
}

/* 编辑容器 */
.edit-wrapper {
  flex: 1;
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
  flex-shrink: 0;
}

.edit-btn:hover {
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.project-title {
  flex: 1;
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.edit-title-input {
  width: 100%;
  padding: 6px 10px;
  border: 2px solid var(--primary);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 32px;
  font-weight: 600;
  outline: none;
}

.topic-hint {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: var(--text-muted);
}

.generate-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: none;
  background-color: var(--primary);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  white-space: nowrap;
  transition: all 0.15s ease;
  flex-shrink: 0;
  height: 40px;
}

.generate-btn:hover:not(:disabled) {
  background-color: var(--primary-hover);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
</style>
