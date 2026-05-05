<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from "vue";
import OutlineEditor from "./OutlineEditor.vue";
import ContentGenerator from "./ContentGenerator.vue";
import Icon from "./Icon.vue";
import { Sparkles, Loader2, Edit3 } from "lucide-vue-next";

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
const addIdsToOutline = (outline, timestamp = Date.now()) => {
  return outline.map((item, index) => {
    // 如果 item 是字符串，转为对象
    let processedItem;
    if (typeof item === "string") {
      processedItem = {
        title: item,
        children: [],
      };
    } else {
      processedItem = { ...item };
    }

    const newItem = {
      ...processedItem,
      id: `section-${timestamp}-${index}`,
    };
    // 处理子章节
    if (processedItem.children && processedItem.children.length > 0) {
      newItem.children = addIdsToOutline(processedItem.children, timestamp);
    } else {
      newItem.children = [];
    }
    return newItem;
  });
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

// 监听 project 变化，重置 outline
watch(
  () => props.project.id,
  () => {
    outline.value = [];
    loadFromStorage();
  },
);

// 大纲变化时自动保存
watch(outline, saveToStorage, { deep: true });

// 生成大纲（带逐个显示效果，有内容时追加而不是覆盖）
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

    let outlineData = [];
    if (result.success && result.data && Array.isArray(result.data)) {
      // 只保留主标题，清除子标题
      let rawData = result.data.map((item) => ({
        title: item.title,
        children: [],
      }));

      // 前端再做一层去重和数量限制
      const seen = new Set();
      const deduplicated = [];
      for (const item of rawData) {
        const titleKey = item.title.trim().toLowerCase();
        if (!seen.has(titleKey)) {
          seen.add(titleKey);
          deduplicated.push(item);
        }
      }

      outlineData = deduplicated.slice(0, 6);
    }

    // 确保无论如何都有数据
    if (outlineData.length === 0) {
      error.value = "生成大纲失败，使用默认数据";
      outlineData = [
        { title: "概述", children: [] },
        { title: "技术原理", children: [] },
        { title: "应用场景", children: [] },
        { title: "未来展望", children: [] },
      ];
    }

    const timestamp = Date.now();

    // 如果大纲已有内容，直接追加；如果为空，从头生成
    if (outline.value.length > 0) {
      // 大纲已有内容，逐个追加新内容
      const existingTitles = new Set(
        outline.value.map((item) => item.title.trim().toLowerCase()),
      );
      const newItems = outlineData.filter(
        (item) => !existingTitles.has(item.title.trim().toLowerCase()),
      );

      // 限制追加数量不超过3个
      const limitedNewItems = newItems.slice(0, 3);

      for (let i = 0; i < limitedNewItems.length; i++) {
        const newItem = {
          ...limitedNewItems[i],
          id: `section-${timestamp}-${i}`,
        };
        outline.value = [...outline.value, newItem];

        if (i < limitedNewItems.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } else {
      // 大纲为空，逐个显示所有章节
      for (let i = 0; i < outlineData.length; i++) {
        const newOutline = outlineData.slice(0, i + 1);
        outline.value = addIdsToOutline(newOutline, timestamp);

        if (i < outlineData.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }
  } catch (err) {
    console.error("请求失败:", err);
    error.value = "生成大纲失败，请确保后端服务已启动";
    // 如果API失败并且大纲为空，才使用fallback数据
    if (outline.value.length === 0) {
      const fallbackOutline = [
        { title: "概述", children: [] },
        { title: "技术原理", children: [] },
        { title: "应用场景", children: [] },
        { title: "未来展望", children: [] },
      ];
      outline.value = addIdsToOutline(fallbackOutline, Date.now());
    }
  } finally {
    loading.value = false;
  }
};

// 更新大纲
const updateOutline = (newOutline) => {
  outline.value = newOutline;
};

// 中文数字转换
const chineseNumbers = [
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
];

// 清理内容中重复的标题
const cleanDuplicateTitle = (content, title) => {
  if (!content || !title) return content;

  let cleaned = content.trim();

  // 准备标题的各种变体（去掉标点、空格等）用于匹配
  const cleanForMatch = (text) => {
    return text.replace(/[、\(\)\[\]（）【】\.\,，。\s\-]/g, "").toLowerCase();
  };

  const targetTitleClean = cleanForMatch(title);

  // 按行分割，查找并移除匹配的标题行（只检查前5行，避免误删正文）
  const lines = cleaned.split("\n");
  const filteredLines = [];
  let removedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTrim = line.trim();

    // 只在前5行检查标题
    if (i < 5 && removedCount < 2) {
      // 检查是否是markdown标题
      const isMarkdownTitle = lineTrim.startsWith("#");
      const lineContent = isMarkdownTitle
        ? lineTrim.replace(/^#+\s*/, "").trim()
        : lineTrim;
      const lineClean = cleanForMatch(lineContent);

      // 检查是否匹配（包括部分匹配）
      if (lineClean.length > 0 && targetTitleClean.length > 0) {
        if (
          lineClean.includes(targetTitleClean) ||
          targetTitleClean.includes(lineClean)
        ) {
          removedCount++;
          continue; // 跳过这一行
        }

        // 检查是否有部分关键词匹配（比如"概述"匹配"AI写作助手概述"）
        const titleWords = title.split(/[、\s]+/);
        for (const word of titleWords) {
          if (word.length >= 2 && lineClean.includes(cleanForMatch(word))) {
            // 可能是相关标题，跳过
            removedCount++;
            continue;
          }
        }
      }
    }

    filteredLines.push(line);
  }

  cleaned = filteredLines.join("\n").trim();

  return cleaned;
};

// 导出 Markdown
const exportMarkdown = () => {
  let markdown = "";

  if (props.project.name) {
    markdown += `# ${props.project.name}\n\n`;
  }

  const appendContent = (items, parentLevel = 0, parentIndex = []) => {
    items.forEach((item, index) => {
      const currentIndex = [...parentIndex, index];
      let heading = "";
      let title = "";

      if (currentIndex.length === 1) {
        // 主标题
        const num = chineseNumbers[index] || index + 1;
        heading = "##";
        title = `${num}、${item.title}`;
      } else if (currentIndex.length === 2) {
        // 子标题
        heading = "###";
        title = `(${index + 1}) ${item.title}`;
      } else {
        // 更深层级（如果有的话）
        heading = "#".repeat(currentIndex.length + 1);
        title = item.title;
      }

      markdown += `${heading} ${title}\n\n`;

      // 只输出纯内容，不重复标题
      if (item.content) {
        // 清理内容中重复的标题
        let content = cleanDuplicateTitle(item.content, item.title);
        if (content) {
          markdown += `${content}\n\n`;
        }
      }

      if (item.children && item.children.length > 0) {
        appendContent(item.children, parentLevel + 1, currentIndex);
      }
    });
  };

  appendContent(outline.value);

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
        <Icon name="AlertCircle" :size="18" />
        <span>{{ error }}</span>
      </div>

      <!-- 项目主题区 -->
      <div class="topic-section">
        <div class="topic-wrapper">
          <!-- 标题容器 -->
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
                <Icon name="Edit3" :size="16" />
              </button>
            </div>
          </div>
          <button
            class="generate-btn"
            @click="generateOutline"
            :disabled="loading"
          >
            <Icon v-if="!loading" name="Sparkles" :size="18" />
            <Icon v-else name="Loader2" :size="18" class="spinner" />
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
  max-width: 850px;
  margin: 0 auto;
  padding: 48px 32px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 14px 18px;
  border-radius: 12px;
  margin-bottom: 32px;
  font-size: 14px;
  font-weight: 500;
}

/* 项目主题区 */
.topic-section {
  margin-bottom: 40px;
}

.topic-wrapper {
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

/* 标题容器 - 固定高度防止抖动 */
.title-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  cursor: text;
  padding: 14px 16px;
  border-radius: 14px;
  gap: 12px;
  background-color: var(--bg-sidebar);
  border: 2px solid var(--border);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 70px;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
}

/* hover 时背景加深 */
.title-wrapper:hover {
  background-color: var(--bg-hover);
  border-color: var(--text-muted);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

/* 编辑按钮区域 */
.topic-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.title-wrapper:hover .topic-right {
  opacity: 1;
}

/* 编辑容器 */
.edit-wrapper {
  flex: 1;
  min-width: 0;
}

.edit-btn {
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
  flex-shrink: 0;
}

.edit-btn:hover {
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.project-title {
  flex: 1;
  font-size: 34px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 0;
  box-sizing: border-box;
  height: 42px;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: 100%;
}

.edit-title-input {
  width: 100%;
  min-width: 0;
  padding: 0 8px;
  border: 2px solid var(--primary);
  border-radius: 8px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 34px;
  font-weight: 700;
  outline: none;
  line-height: 1.2;
  box-sizing: border-box;
  height: 42px;
  resize: none;
}

.topic-hint {
  margin: 12px 0 0 0;
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
}

.generate-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  background-color: var(--primary);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 12px;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  height: 52px;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
}

.generate-btn:hover:not(:disabled) {
  background-color: var(--primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.35);
}

.generate-btn:active {
  transform: translateY(0);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
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

/* ===== 响应式设计 - 移动端适配 ===== */
@media (max-width: 768px) {
  .editor-content {
    padding: 28px 18px;
  }

  .topic-section {
    margin-bottom: 28px;
  }

  .topic-wrapper {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .title-wrapper {
    padding: 12px 14px;
    min-height: 60px;
  }

  .project-title {
    font-size: 24px;
    height: 34px;
  }

  .edit-title-input {
    font-size: 24px;
    height: 34px;
  }

  .generate-btn {
    width: 100%;
    justify-content: center;
    height: 48px;
    padding: 10px 16px;
    font-size: 14px;
  }

  .error-message {
    padding: 12px 14px;
    font-size: 13px;
    margin-bottom: 24px;
  }

  .topic-hint {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .editor-content {
    padding: 20px 14px;
  }

  .topic-section {
    margin-bottom: 24px;
  }

  .title-wrapper {
    padding: 10px 12px;
    min-height: 56px;
  }

  .project-title {
    font-size: 20px;
    height: 30px;
  }

  .edit-title-input {
    font-size: 20px;
    height: 30px;
  }

  .generate-btn {
    height: 46px;
    padding: 10px 14px;
    font-size: 13px;
  }

  .error-message {
    padding: 10px 12px;
    font-size: 13px;
    margin-bottom: 20px;
  }

  .topic-hint {
    font-size: 13px;
    margin-top: 10px 0 0 0;
  }
}
</style>
