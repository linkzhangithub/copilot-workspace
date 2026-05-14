<script setup>
import {
  ref,
  watch,
  computed,
  onMounted,
  onUnmounted,
  nextTick,
  toRef,
} from "vue";
import OutlineEditor from "./OutlineEditor.vue";
import ContentGenerator from "./ContentGenerator.vue";
import Icon from "./Icon.vue";
import QualityCheckModal from "./QualityCheckModal.vue";
import "../styles/editor.css";
import { chineseNumbers } from "../constants/chineseNumbers.js";
import { MAX_TOTAL_SUBSECTIONS } from "../constants/limits.js";
import {
  generateFullMarkdown as generateMarkdown,
  exportMarkdown as exportMarkdownFile,
} from "../utils/exportUtils.js";
import { useEditorState } from "../composables/useEditorState.js";
import { useEditorGenerateAll } from "../composables/useEditorGenerateAll.js";

const props = defineProps({
  project: { type: Object, required: true },
});

const emit = defineEmits(["update-project", "show-toast"]);

const {
  outline,
  error,
  loading,
  hasGeneratedOutline,
  hasGeneratedAllContent,
  canGenerateOutline,
  generateOutlineTooltip,
  totalSubsections,
  hasEmptySubsections,
  loadFromStorage,
  saveToStorage,
  updateOutline,
} = useEditorState({
  projectId: computed(() => props.project.id),
  emit,
});

const {
  isGeneratingAll,
  isPaused,
  generatingSubsectionPath,
  handleGenerateAllContent,
} = useEditorGenerateAll({
  outline,
  projectName: toRef(props.project, "name"),
  emit,
});

const generateAllButtonState = computed(() => {
  if (isGeneratingAll.value && !isPaused.value) {
    return "generating";
  } else if (isPaused.value) {
    return "paused";
  } else if (hasEmptySubsections.value) {
    return "ready";
  } else if (outline.value.length > 0) {
    return "completed";
  }
  return "ready";
});

const isEditingTitle = ref(false);
const editingTitle = ref("");
const editTitleWrapper = ref(null);
const titleInput = ref(null);
const contentGeneratorRef = ref(null);
const editorRef = ref(null);
const showBackToTop = ref(false);

const isGeneratingContent = computed(() => {
  if (generatingSubsectionPath.value !== null) return true;
  if (isGeneratingAll.value && !isPaused.value) return true;
  return false;
});

const fullMarkdown = computed(() => {
  return generateMarkdown(props.project.name, outline.value);
});

const qualityCheckModalRef = ref(null);

const startQualityCheck = () => {
  if (qualityCheckModalRef.value) {
    qualityCheckModalRef.value.startQualityCheck();
  }
};

const canShowQualityReport = computed(() => {
  if (qualityCheckModalRef.value) {
    return qualityCheckModalRef.value.canShowQualityReport;
  }
  return false;
});

const qualityCheckLoading = computed(() => {
  if (qualityCheckModalRef.value) {
    return qualityCheckModalRef.value.qualityCheckLoading;
  }
  return false;
});

const addIdsToOutline = (outline, timestamp = Date.now()) => {
  return outline.map((item, index) => {
    let processedItem;
    if (typeof item === "string") {
      processedItem = { title: item, children: [] };
    } else {
      processedItem = { ...item };
    }

    const newItem = {
      ...processedItem,
      id: `section-${timestamp}-${index}`,
    };
    if (processedItem.children && processedItem.children.length > 0) {
      newItem.children = addIdsToOutline(processedItem.children, timestamp);
    } else {
      newItem.children = [];
    }
    return newItem;
  });
};

const loadFromStorageWithIds = () => {
  try {
    const saved = localStorage.getItem(`vue-project-${props.project.id}`);
    if (saved) {
      const data = JSON.parse(saved);
      outline.value = addIdsToOutline(data.outline || []);
      hasGeneratedOutline.value = data.hasGeneratedOutline || false;
      hasGeneratedAllContent.value = data.hasGeneratedAllContent || false;
    }
  } catch (e) {
    console.error("加载失败:", e);
  }
};

const saveToStorageWithIds = () => {
  try {
    localStorage.setItem(
      `vue-project-${props.project.id}`,
      JSON.stringify({
        outline: outline.value,
        hasGeneratedOutline: hasGeneratedOutline.value,
        hasGeneratedAllContent: hasGeneratedAllContent.value,
      }),
    );
  } catch (e) {
    console.error("保存失败:", e);
  }
};

watch(
  () => props.project.id,
  () => {
    outline.value = [];
    hasGeneratedOutline.value = false;
    hasGeneratedAllContent.value = false;
    loadFromStorageWithIds();
  },
);

let saveToStorageTimer = null;
const saveToStorageDebounced = () => {
  if (saveToStorageTimer) {
    clearTimeout(saveToStorageTimer);
  }
  saveToStorageTimer = setTimeout(() => {
    saveToStorageWithIds();
    saveToStorageTimer = null;
  }, 500);
};

watch(outline, saveToStorageDebounced, { deep: true });

watch(
  () => outline.value.length,
  (newLength) => {
    if (newLength === 0) {
      hasGeneratedOutline.value = false;
      hasGeneratedAllContent.value = false;
    }
  },
);

const generateOutline = async () => {
  error.value = "";
  loading.value = true;

  emit("show-toast", "AI写作助手正在为您构建大纲，请稍候...", "info", 2000);

  try {
    const response = await fetch("/api/ai/generate-outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: props.project.name }),
    });

    const result = await response.json();

    let outlineData = [];
    if (result.success && result.data && Array.isArray(result.data)) {
      outlineData = result.data;
    }

    if (outlineData.length === 0) {
      error.value = "生成大纲失败，使用默认数据";
      outlineData = [
        { title: "概述", children: ["背景介绍", "核心概念"] },
        { title: "技术原理", children: ["基础架构", "关键技术"] },
        { title: "应用场景", children: ["典型场景", "最佳实践"] },
        { title: "未来展望", children: ["发展趋势", "总结"] },
      ];
    }

    const timestamp = Date.now();
    outline.value = [];

    for (let i = 0; i < outlineData.length; i++) {
      const chapter = outlineData[i];

      const chapterWithEmptyChildren = {
        id: `section-${timestamp}-${i}`,
        title: chapter.title,
        children: [],
      };

      outline.value = [...outline.value, chapterWithEmptyChildren];
      await new Promise((resolve) => setTimeout(resolve, 200));

      if (chapter.children && chapter.children.length > 0) {
        for (let j = 0; j < chapter.children.length; j++) {
          const subsectionTitle = chapter.children[j];

          outline.value[i].children.push({
            id: `subsection-${timestamp}-${i}-${j}`,
            title: subsectionTitle,
            children: [],
          });

          outline.value = [...outline.value];
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    hasGeneratedOutline.value = true;

    emit(
      "show-toast",
      "大纲生成完成！当前已是AI推荐的最优结构，如有需要可手动调整",
      "success",
      3000,
    );
  } catch (err) {
    console.error("请求失败:", err);
    error.value = "生成大纲失败，请确保后端服务已启动";

    if (outline.value.length === 0) {
      const fallbackOutline = [
        { title: "概述", children: ["背景介绍", "核心概念"] },
        { title: "技术原理", children: ["基础架构", "关键技术"] },
        { title: "应用场景", children: ["典型场景", "最佳实践"] },
        { title: "未来展望", children: ["发展趋势", "总结"] },
      ];

      const timestamp = Date.now();
      for (let i = 0; i < fallbackOutline.length; i++) {
        const chapter = fallbackOutline[i];
        outline.value.push({
          id: `section-${timestamp}-${i}`,
          title: chapter.title,
          children: chapter.children,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  } finally {
    loading.value = false;
  }
};

const exportMarkdown = () => {
  exportMarkdownFile(props.project.name, outline.value);
};

const startEditTitle = (e) => {
  e.stopPropagation();
  if (isEditingTitle.value) return;
  isEditingTitle.value = true;
  editingTitle.value = props.project.name;
  nextTick(() => {
    if (titleInput.value) {
      titleInput.value.focus();
      titleInput.value.select();
    }
  });
};

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

const handleScrollToSection = (path) => {
  if (contentGeneratorRef.value) {
    contentGeneratorRef.value.scrollToSection(path);
  }
};

const handleEditorScroll = () => {
  if (editorRef.value) {
    showBackToTop.value = editorRef.value.scrollTop > 300;
  }
};

const scrollToTop = () => {
  if (editorRef.value) {
    editorRef.value.scrollTo({ top: 0, behavior: "smooth" });
  }
};

defineExpose({ exportMarkdown });

onMounted(() => {
  loadFromStorageWithIds();
  document.addEventListener("click", handleGlobalClick);
  if (editorRef.value) {
    editorRef.value.addEventListener("scroll", handleEditorScroll);
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleGlobalClick);
  if (editorRef.value) {
    editorRef.value.removeEventListener("scroll", handleEditorScroll);
  }
});
</script>

<template>
  <div class="editor" ref="editorRef">
    <div class="editor-content">
      <div v-if="error" class="error-message">
        <Icon name="AlertCircle" :size="18" />
        <span>{{ error }}</span>
      </div>

      <div class="topic-section">
        <div class="topic-wrapper">
          <div
            class="title-wrapper"
            ref="editTitleWrapper"
            @click="startEditTitle($event)"
          >
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
            <h1 v-else class="project-title">{{ project.name }}</h1>
          </div>
          <button
            class="generate-btn"
            :class="{ 'disabled-btn': !canGenerateOutline && !loading }"
            @click="generateOutline"
            :disabled="loading || !canGenerateOutline"
            :title="generateOutlineTooltip"
          >
            <Icon v-if="!loading" name="Sparkles" :size="18" />
            <Icon v-else name="Loader2" :size="18" class="spinner" />
            <span>生成大纲</span>
          </button>
          <button
            v-if="outline.length > 0"
            class="quality-check-btn"
            :class="{ 'quality-report-mode': canShowQualityReport }"
            @click="startQualityCheck"
            :disabled="qualityCheckLoading"
          >
            <Icon v-if="!qualityCheckLoading" name="CheckSquare" :size="18" />
            <Icon v-else name="Loader2" :size="18" class="spinner" />
            <span>{{ canShowQualityReport ? "质检报告" : "智能质检" }}</span>
          </button>
        </div>
        <p v-if="outline.length === 0" class="topic-hint">
          点击生成大纲，AI 将为你创建文章结构
        </p>
      </div>

      <OutlineEditor
        v-if="outline.length > 0"
        :outline="outline"
        :has-generated-all-content="hasGeneratedAllContent"
        :is-generating-all="isGeneratingAll"
        :is-paused="isPaused"
        :generate-all-button-state="generateAllButtonState"
        @update:outline="updateOutline"
        @show-toast="
          (msg, type, duration) => emit('show-toast', msg, type, duration)
        "
        @generate-all-content="handleGenerateAllContent"
        @scroll-to-section="handleScrollToSection"
      />

      <ContentGenerator
        v-if="outline.length > 0"
        ref="contentGeneratorRef"
        :outline="outline"
        :article-topic="project.name"
        :is-generating-all="isGeneratingAll"
        :is-paused="isPaused"
        :generating-subsection-path="generatingSubsectionPath"
        @update:outline="updateOutline"
        @update:generating-path="generatingSubsectionPath = $event"
      />
    </div>

    <QualityCheckModal
      ref="qualityCheckModalRef"
      :projectId="project.id"
      :projectName="project.name"
      :outline="outline"
      :isGeneratingContent="isGeneratingContent"
      :fullMarkdown="fullMarkdown"
      @show-toast="
        (message, type, duration) => emit('show-toast', message, type, duration)
      "
    />

    <Transition name="fade">
      <button
        v-if="showBackToTop"
        class="back-to-top-btn"
        @click="scrollToTop"
        title="回到顶部"
      >
        <Icon name="ArrowUp" :size="20" />
      </button>
    </Transition>
  </div>
</template>
