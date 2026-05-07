<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from "vue";
import OutlineEditor from "./OutlineEditor.vue";
import ContentGenerator from "./ContentGenerator.vue";
import Icon from "./Icon.vue";
import {
  Sparkles,
  Loader2,
  Edit3,
  CheckSquare,
  X,
  List,
  FileText,
  GitBranch,
  CheckCircle,
  MessageSquare,
} from "lucide-vue-next";

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

// 质检弹窗相关
const showQualityCheck = ref(false);
const qualityCheckLoading = ref(false);
const showLoadingState = ref(true); // 控制显示加载状态还是评价系统
const visibleItems = ref([false, false, false, false, false]); // 控制每一项的可见性
const qualityResults = ref({
  structure: "",
  content: "",
  logic: "",
  quality: "",
  clarity: "",
});
const currentStep = ref(-1); // -1=未开始, 0-4=当前步骤

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

// 生成完整markdown内容（用于质检）- 和导出markdown完全一致
const generateFullMarkdown = () => {
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

  return markdown;
};

// 智能文章质检
const startQualityCheck = async () => {
  showQualityCheck.value = true;
  showLoadingState.value = true;
  qualityCheckLoading.value = true;

  // 重置状态
  qualityResults.value = {
    structure: "",
    content: "",
    logic: "",
    quality: "",
    clarity: "",
  };
  currentStep.value = -1;

  // 质检维度配置
  const dimensions = [
    {
      key: "structure",
      name: "大纲结构",
    },
    {
      key: "content",
      name: "章节内容",
    },
    {
      key: "logic",
      name: "逻辑严密性",
    },
    {
      key: "quality",
      name: "内容质量",
    },
    {
      key: "clarity",
      name: "表达清晰度",
    },
  ];

  try {
    // 生成完整markdown内容
    const fullMarkdown = generateFullMarkdown();

    console.log("=========================================");
    console.log("开始智能质检！");
    console.log("=========================================");

    // 调用一次AI获取所有5个维度的评价
    const response = await fetch("/api/ai/quality-check-full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: props.project.name,
        outline: outline.value,
        fullMarkdown: fullMarkdown,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("获取到的评价结果:", result);

    // 等一小段时间让用户看到加载状态
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 先淡出加载状态
    showLoadingState.value = false;

    // 等待淡出动画完成（0.4s）
    await new Promise((resolve) => setTimeout(resolve, 400));

    // 显示第一项
    visibleItems.value[0] = true;
    currentStep.value = 0;

    // 开始依次处理每条评价
    const evaluations = result.data;
    for (let i = 0; i < dimensions.length; i++) {
      const dim = dimensions[i];
      const text = evaluations[dim.key] || "评价加载失败";
      currentStep.value = i;

      // 如果不是第一项，等200ms显示下一项
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        visibleItems.value[i] = true;
      }

      // 流式输出该条内容
      for (let j = 0; j < text.length; j++) {
        qualityResults.value[dim.key] += text[j];
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    // 全部完成
    currentStep.value = 5;
  } catch (error) {
    console.error("质检失败:", error);
  } finally {
    qualityCheckLoading.value = false;
  }
};

// 关闭质检弹窗
const closeQualityCheck = () => {
  showQualityCheck.value = false;
  showLoadingState.value = true;
  visibleItems.value = [false, false, false, false, false];
  qualityResults.value = {
    structure: "",
    content: "",
    logic: "",
    quality: "",
    clarity: "",
  };
  currentStep.value = -1;
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
          <button
            v-if="outline.length > 0"
            class="quality-check-btn"
            @click="startQualityCheck"
            :disabled="qualityCheckLoading"
          >
            <Icon v-if="!qualityCheckLoading" name="CheckSquare" :size="18" />
            <Icon v-else name="Loader2" :size="18" class="spinner" />
            <span>智能质检</span>
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
          <!-- 使用Transition的mode="out-in"确保先淡出再淡入 -->
          <Transition name="fade" mode="out-in">
            <!-- 加载状态 -->
            <div v-if="showLoadingState" key="loading" class="loading-state">
              <div class="loading-icon">
                <Icon name="Loader2" :size="48" class="spinner" />
              </div>
              <p class="loading-text">正在读取文章内容</p>
              <p class="loading-subtext">AI正在分析您的文章...</p>
            </div>

            <!-- 评价系统 -->
            <div v-else key="quality" class="quality-list">
              <TransitionGroup name="slide-fade">
                <div v-if="visibleItems[0]" key="0" class="quality-item">
                  <div class="quality-item-left">
                    <div
                      class="quality-icon"
                      :class="{
                        loading: currentStep === 0,
                        done: currentStep > 0,
                      }"
                    >
                      <Icon
                        v-if="currentStep > 0"
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
                    <span class="quality-name">大纲结构</span>
                  </div>
                  <div class="quality-result">
                    {{ qualityResults.structure }}
                  </div>
                  <div class="quality-score"></div>
                </div>
                <div v-if="visibleItems[1]" key="1" class="quality-item">
                  <div class="quality-item-left">
                    <div
                      class="quality-icon"
                      :class="{
                        loading: currentStep === 1,
                        done: currentStep > 1,
                      }"
                    >
                      <Icon
                        v-if="currentStep > 1"
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
                    <span class="quality-name">章节内容</span>
                  </div>
                  <div class="quality-result">{{ qualityResults.content }}</div>
                  <div class="quality-score"></div>
                </div>
                <div v-if="visibleItems[2]" key="2" class="quality-item">
                  <div class="quality-item-left">
                    <div
                      class="quality-icon"
                      :class="{
                        loading: currentStep === 2,
                        done: currentStep > 2,
                      }"
                    >
                      <Icon
                        v-if="currentStep > 2"
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
                    <span class="quality-name">逻辑严密性</span>
                  </div>
                  <div class="quality-result">{{ qualityResults.logic }}</div>
                  <div class="quality-score"></div>
                </div>
                <div v-if="visibleItems[3]" key="3" class="quality-item">
                  <div class="quality-item-left">
                    <div
                      class="quality-icon"
                      :class="{
                        loading: currentStep === 3,
                        done: currentStep > 3,
                      }"
                    >
                      <Icon
                        v-if="currentStep > 3"
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
                    <span class="quality-name">内容质量</span>
                  </div>
                  <div class="quality-result">{{ qualityResults.quality }}</div>
                  <div class="quality-score"></div>
                </div>
                <div v-if="visibleItems[4]" key="4" class="quality-item">
                  <div class="quality-item-left">
                    <div
                      class="quality-icon"
                      :class="{
                        loading: currentStep === 4,
                        done: currentStep > 4,
                      }"
                    >
                      <Icon
                        v-if="currentStep > 4"
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
                    <span class="quality-name">表达清晰度</span>
                  </div>
                  <div class="quality-result">{{ qualityResults.clarity }}</div>
                  <div class="quality-score"></div>
                </div>
              </TransitionGroup>
            </div>
          </Transition>
        </div>
      </div>
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

/* 智能质检按钮 - 蓝色轮廓样式 */
.quality-check-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: 2px solid var(--primary);
  background-color: transparent;
  color: var(--primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 12px;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  height: 52px;
}

.quality-check-btn:hover:not(:disabled) {
  background-color: rgba(14, 165, 233, 0.1);
  transform: translateY(-2px);
}

.quality-check-btn:active {
  transform: translateY(0);
}

.quality-check-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 智能质检弹窗 */
.quality-check-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  background-color: var(--bg-sidebar);
  border-radius: 16px;
  border: 1px solid var(--border);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  background-color: var(--bg-input);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
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
  transition: all 0.2s ease;
}

.close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 450px;
  /* 固定高度，正好显示5个评价项 */
}

/* 加载状态样式 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  min-height: 280px;
}

.loading-icon {
  color: var(--primary);
  margin-bottom: 24px;
}

.loading-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.loading-subtext {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* 淡入淡出过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 各项依次淡入动画 */
.slide-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 评价列表样式 */
.quality-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 质检项目 - 紧凑高度 */
.quality-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background-color: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.quality-item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.quality-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: var(--bg-tertiary);
  color: var(--text-muted);
  flex-shrink: 0;
}

.quality-icon.loading {
  color: var(--primary);
}

.quality-icon.done {
  color: var(--success);
}

.quality-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

.quality-result {
  flex: 1;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-secondary);
  min-height: 3.6em;
  max-height: 3.6em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.quality-score {
  width: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 18px;
  font-weight: 700;
  color: var(--primary);
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
