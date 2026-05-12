<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from "vue";
import OutlineEditor from "./OutlineEditor.vue";
import ContentGenerator from "./ContentGenerator.vue";
import Icon from "./Icon.vue";
import QualityCheckModal from "./QualityCheckModal.vue";
import "../styles/editor.css";
import {
  Sparkles,
  Loader2,
  CheckSquare,
  X,
  CheckCircle,
  ArrowUp,
} from "lucide-vue-next";
import { chineseNumbers } from "../constants/chineseNumbers.js";
import {
  MAX_CHAPTERS,
  MAX_SUBSECTIONS_PER_CHAPTER,
  MAX_TOTAL_SUBSECTIONS,
} from "../constants/limits.js";
import {
  generateFullMarkdown as generateMarkdown,
  exportMarkdown as exportMarkdownFile,
} from "../utils/exportUtils.js";

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update-project", "show-toast"]);

// 状态
const outline = ref([]);
const error = ref("");
const loading = ref(false);
const isEditingTitle = ref(false);
const editingTitle = ref("");
const editTitleWrapper = ref(null);
const titleInput = ref(null);
const hasGeneratedOutline = ref(false);
const hasGeneratedAllContent = ref(false);
const isGeneratingAll = ref(false);
const isPaused = ref(false);
const generatingSubsectionPath = ref(null);
const contentGeneratorRef = ref(null);
const editorRef = ref(null);
const showBackToTop = ref(false);
const currentGeneratingIndex = ref(0); // 当前正在生成的小节索引
const totalGeneratingCount = ref(0); // 总共需要生成的小节数

// 计算是否可以生成大纲
const canGenerateOutline = computed(() => {
  return outline.value.length === 0;
});

const generateOutlineTooltip = computed(() => {
  if (outline.value.length > 0) {
    return "大纲已存在，请先清空大纲";
  }
  return "";
});

// 计算当前小节总数
const totalSubsections = computed(() => {
  return outline.value.reduce((total, chapter) => {
    return total + (chapter.children ? chapter.children.length : 0);
  }, 0);
});

// 计算是否可以添加更多小节
const canAddMoreSubsections = computed(() => {
  return totalSubsections.value < MAX_TOTAL_SUBSECTIONS;
});

// 计算是否有空白内容（未生成的小节）
const hasEmptySubsections = computed(() => {
  for (const chapter of outline.value) {
    if (chapter.children) {
      for (const subsection of chapter.children) {
        if (!subsection.content) {
          return true;
        }
      }
    }
  }
  return false;
});

// 计算一键生成按钮的状态
const generateAllButtonState = computed(() => {
  if (isGeneratingAll.value && !isPaused.value) {
    return "generating"; // 生成中
  } else if (isPaused.value) {
    return "paused"; // 已暂停
  } else if (hasEmptySubsections.value) {
    return "ready"; // 可以生成
  } else if (outline.value.length > 0) {
    return "completed"; // 已完成
  }
  return "ready"; // 默认状态
});

// 计算是否有内容正在生成
const isGeneratingContent = computed(() => {
  // 如果有单独的小节正在生成，无论是否暂停，都阻止质检
  if (generatingSubsectionPath.value !== null) return true;

  // 如果一键生成正在进行中且未暂停，阻止质检
  if (isGeneratingAll.value && !isPaused.value) return true;

  // 其他情况允许质检（包括一键生成已暂停）
  return false;
});

// 质检组件引用
const qualityCheckModalRef = ref(null);

// 开始质检
const startQualityCheck = () => {
  if (qualityCheckModalRef.value) {
    qualityCheckModalRef.value.startQualityCheck();
  }
};

// 判断是否可以显示质检报告
const canShowQualityReport = computed(() => {
  if (qualityCheckModalRef.value) {
    return qualityCheckModalRef.value.canShowQualityReport;
  }
  return false;
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
      hasGeneratedOutline.value = data.hasGeneratedOutline || false;
      hasGeneratedAllContent.value = data.hasGeneratedAllContent || false;
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
        hasGeneratedOutline: hasGeneratedOutline.value,
        hasGeneratedAllContent: hasGeneratedAllContent.value,
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
    hasGeneratedOutline.value = false;
    hasGeneratedAllContent.value = false;
    loadFromStorage();
  },
);

// 大纲变化时自动保存
watch(outline, saveToStorage, { deep: true });

// 当大纲被清空时，重置生成状态
watch(
  () => outline.value.length,
  (newLength) => {
    if (newLength === 0) {
      hasGeneratedOutline.value = false;
      hasGeneratedAllContent.value = false;
    }
  },
);

// 生成大纲（一次性生成完整结构，流式显示）
const generateOutline = async () => {
  error.value = "";
  loading.value = true;

  emit("show-toast", "AI写作助手正在为您构建大纲，请稍候...", "info", 2000);

  try {
    const response = await fetch("/api/ai/generate-outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: props.project.name,
      }),
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

// 更新大纲
const updateOutline = (newOutline) => {
  outline.value = newOutline;
};

// 一键生成所有内容
const handleGenerateAllContent = async () => {
  // 如果正在生成且未暂停，则暂停
  if (isGeneratingAll.value && !isPaused.value) {
    isPaused.value = true;

    // 清除正在生成的小节内容
    if (generatingSubsectionPath.value) {
      const [i, j] = generatingSubsectionPath.value;
      if (
        outline.value[i] &&
        outline.value[i].children &&
        outline.value[i].children[j]
      ) {
        outline.value[i].children[j].content = "";
        outline.value = [...outline.value];
      }
      // 重置生成路径，允许质检
      generatingSubsectionPath.value = null;
    }

    emit("show-toast", "已暂停生成，点击继续生成", "warning", 2000);
    return;
  }

  // 如果已暂停，则继续生成（不return，继续执行生成循环）
  if (isPaused.value) {
    isPaused.value = false;
    emit("show-toast", "继续生成内容...", "info", 2000);
    // 不return，继续执行生成循环
  } else {
    // 开始新的生成
    isGeneratingAll.value = true;
    hasGeneratedAllContent.value = false;

    // 计算总共有多少个小节需要生成
    let emptyCount = 0;
    for (let i = 0; i < outline.value.length; i++) {
      const chapter = outline.value[i];
      if (chapter.children && chapter.children.length > 0) {
        for (let j = 0; j < chapter.children.length; j++) {
          const subsection = chapter.children[j];
          if (!subsection.content) {
            emptyCount++;
          }
        }
      }
    }
    totalGeneratingCount.value = emptyCount;
    currentGeneratingIndex.value = 0;

    emit("show-toast", "开始生成所有小节内容，请稍候...", "info", 3000);
  }

  try {
    for (let i = 0; i < outline.value.length; i++) {
      // 检查是否暂停
      if (isPaused.value) {
        return; // 暂停时退出循环
      }

      const chapter = outline.value[i];

      if (chapter.children && chapter.children.length > 0) {
        for (let j = 0; j < chapter.children.length; j++) {
          // 检查是否暂停
          if (isPaused.value) {
            return; // 暂停时退出循环
          }

          const subsection = chapter.children[j];

          if (!subsection.content) {
            generatingSubsectionPath.value = [i, j];
            currentGeneratingIndex.value++; // 更新当前生成的小节索引

            // 使用 Toast 提示当前正在生成哪一章节哪一小节
            emit(
              "show-toast",
              `正在生成第 ${i + 1} 章第 ${j + 1} 小节内容...`,
              "info",
              2000,
            );

            try {
              const response = await fetch("/api/ai/generate-content-simple", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  outline: outline.value,
                  path: [i, j],
                  contextInfo: {
                    articleTopic: props.project.name,
                    completedSections: [],
                    usedKeyPoints: [],
                    taskType: "first_generate",
                    isFirstContent: i === 0 && j === 0,
                    positionDescription: `第${i + 1}章第${j + 1}小节`,
                    isSubsection: true,
                  },
                }),
              });

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              const result = await response.json();

              if (result.success && result.data) {
                // 使用打字机效果逐字显示
                const content = result.data;
                for (let k = 0; k < content.length; k++) {
                  // 检查是否暂停
                  if (isPaused.value) {
                    // 暂停时清除当前正在生成的内容
                    outline.value[i].children[j].content = "";
                    outline.value = [...outline.value];
                    return; // 暂停时退出循环
                  }

                  outline.value[i].children[j].content = content.substring(
                    0,
                    k + 1,
                  );
                  outline.value = [...outline.value];
                  // 每10个字符暂停一下，模拟流式效果
                  if (k % 10 === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 20));
                  }
                }
              }
            } catch (error) {
              console.error(`生成小节 [${i}][${j}] 失败:`, error);
              // 继续生成下一个小节
            }

            generatingSubsectionPath.value = null;
          }
        }
      }
    }

    // 检查是否所有内容都生成完成
    if (!isPaused.value && !hasEmptySubsections.value) {
      hasGeneratedAllContent.value = true;
      emit(
        "show-toast",
        "所有小节内容生成完成！可以进行智能质检了",
        "success",
        5000,
      );
    }
  } catch (err) {
    console.error("一键生成失败:", err);
    emit("show-toast", "生成失败，请重试", "error", 3000);
  } finally {
    if (!isPaused.value) {
      isGeneratingAll.value = false;
    }
    generatingSubsectionPath.value = null;
  }
};

// 直接显示上次的质检结果
const showPreviousQualityCheck = () => {
  if (!lastQualityCheck.value.results || !lastQualityCheck.value.scores) return;

  showQualityCheck.value = true;
  showLoadingState.value = false;
  qualityCheckLoading.value = false;

  // 直接设置结果
  qualityResults.value = { ...lastQualityCheck.value.results };
  qualityScores.value = { ...lastQualityCheck.value.scores };

  // 确保有总分，如果没有就计算
  if (lastQualityCheck.value.totalScore !== undefined) {
    totalScore.value = lastQualityCheck.value.totalScore;
  } else {
    // 旧数据没有保存总分，计算一下
    totalScore.value =
      (qualityScores.value.structure || 0) +
      (qualityScores.value.content || 0) +
      (qualityScores.value.logic || 0) +
      (qualityScores.value.quality || 0) +
      (qualityScores.value.clarity || 0);
  }

  totalComment.value =
    lastQualityCheck.value.totalComment || "继续努力，提升文章质量！";
  currentStep.value = 5;

  // 加载建议
  if (
    lastQualityCheck.value.suggestions &&
    Array.isArray(lastQualityCheck.value.suggestions)
  ) {
    // 定义分类图标映射（与之前保持一致）
    const categoryIcons = {
      结构: "📋",
      内容: "📝",
      逻辑: "🔗",
      表达: "✍️",
      质量: "⭐",
    };
    const fallbackIcons = ["📋", "💡", "🔗"];

    suggestions.value = lastQualityCheck.value.suggestions
      .slice(0, 3)
      .map((s, index) => {
        // 处理新旧格式兼容
        if (typeof s === "string") {
          return {
            icon: fallbackIcons[index % fallbackIcons.length],
            text: s,
            category: "质量",
            priority: index + 1,
            issue: "",
            example: "",
          };
        } else if (s.text && !s.category) {
          // 中间格式
          return {
            icon: s.icon || fallbackIcons[index % fallbackIcons.length],
            text: s.text,
            category: "质量",
            priority: index + 1,
            issue: "",
            example: "",
          };
        } else {
          // 新格式
          return {
            icon:
              s.icon ||
              categoryIcons[s.category] ||
              fallbackIcons[index % fallbackIcons.length],
            text: s.suggestion || s.text || "",
            category: s.category || "质量",
            priority: s.priority || index + 1,
            issue: s.issue || "",
            example: s.example || "",
          };
        }
      });
  } else {
    // 如果没有保存suggestions，根据分数重新生成
    const autoSuggestions = [];
    const scores = lastQualityCheck.value.scores;

    if (scores && scores.structure <= 12) {
      autoSuggestions.push({
        icon: "📋",
        text: "补充缺失的章节内容，完善文章的整体结构框架",
        category: "结构",
        priority: autoSuggestions.length + 1,
        issue: "",
        example: "",
      });
    }
    if (scores && scores.content <= 12) {
      autoSuggestions.push({
        icon: "💡",
        text: "增加具体的案例和数据，提升章节内容的充实度",
        category: "内容",
        priority: autoSuggestions.length + 1,
        issue: "",
        example: "",
      });
    }
    if (scores && scores.logic <= 12) {
      autoSuggestions.push({
        icon: "🔗",
        text: "优化段落间的过渡衔接，增强文章的逻辑连贯性",
        category: "逻辑",
        priority: autoSuggestions.length + 1,
        issue: "",
        example: "",
      });
    }
    if (scores && scores.quality <= 12) {
      autoSuggestions.push({
        icon: "📝",
        text: "增加深度分析和专业内容，提升文章的内容质量",
        category: "质量",
        priority: autoSuggestions.length + 1,
        issue: "",
        example: "",
      });
    }
    if (scores && scores.clarity <= 12) {
      autoSuggestions.push({
        icon: "🎯",
        text: "简化复杂句式，让表达更简洁明了",
        category: "表达",
        priority: autoSuggestions.length + 1,
        issue: "",
        example: "",
      });
    }

    const defaultSuggestions = [
      {
        icon: "💡",
        text: "增加具体的数据或案例支持，提升说服力",
        category: "内容",
        priority: autoSuggestions.length + 1,
        issue: "",
        example: "",
      },
      {
        icon: "📝",
        text: "优化段落之间的过渡衔接，增强逻辑性",
        category: "逻辑",
        priority: autoSuggestions.length + 2,
        issue: "",
        example: "",
      },
      {
        icon: "🎯",
        text: "简化复杂句式，让表达更简洁明了",
        category: "表达",
        priority: autoSuggestions.length + 3,
        issue: "",
        example: "",
      },
    ];

    while (autoSuggestions.length < 3) {
      const randomIndex = Math.floor(Math.random() * defaultSuggestions.length);
      const suggestion = defaultSuggestions[randomIndex];
      autoSuggestions.push({
        ...suggestion,
        priority: autoSuggestions.length + 1,
      });
    }
    suggestions.value = autoSuggestions.slice(0, 3);
  }

  // 显示所有项目
  visibleItems.value = [true, true, true, true, true];
  visibleTotalScore.value = true;
  progressBarWidth.value = totalScore.value;

  // 同时显示建议（直接全部显示，不需要动画
  visibleSuggestions.value = true;
  visibleSuggestionItems.value = [true, true, true];
};

// 智能文章质检
const startQualityCheck = async () => {
  // 防止重复点击
  if (qualityCheckLoading.value) {
    return;
  }

  // 检查是否有内容正在生成
  if (isGeneratingContent.value) {
    emit("show-toast", "内容生成中，请稍后再试", "warning", 3000);
    return;
  }

  // 检查是否有文章内容
  const hasContent = outline.value.some(
    (section) =>
      section.content ||
      (section.children && section.children.some((sub) => sub.content)),
  );

  if (!hasContent) {
    emit("show-toast", "请先生成文章内容", "warning", 3000);
    return;
  }

  // 重置状态
  isQualityCheckCancelled.value = false;
  qualityCheckCompleted.value = false;

  // 如果内容未变且有结果，直接显示
  const fullMarkdown = generateMarkdown(props.project.name, outline.value);

  if (
    fullMarkdown === lastQualityCheck.value.articleContent &&
    lastQualityCheck.value.results &&
    lastQualityCheck.value.scores &&
    lastQualityCheck.value.suggestions &&
    Array.isArray(lastQualityCheck.value.suggestions)
  ) {
    showPreviousQualityCheck();
    return;
  }

  // 内容有变化，重新质检
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
  qualityScores.value = {
    structure: 0,
    content: 0,
    logic: 0,
    quality: 0,
    clarity: 0,
  };
  totalScore.value = 0;
  totalComment.value = "";
  visibleTotalScore.value = false;
  progressBarWidth.value = 0;
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

    // 检查是否成功
    if (!result.success) {
      throw new Error(result.error || "质检请求失败");
    }

    // 检查是否被中断
    if (isQualityCheckCancelled.value) return;

    // 等一小段时间让用户看到加载状态
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 检查是否被中断
    if (isQualityCheckCancelled.value) return;

    // 先淡出加载状态
    showLoadingState.value = false;

    // 等待淡出动画完成（0.4s）
    await new Promise((resolve) => setTimeout(resolve, 400));

    // 检查是否被中断
    if (isQualityCheckCancelled.value) return;

    // 显示第一项
    visibleItems.value[0] = true;
    currentStep.value = 0;

    // 开始依次处理每条评价
    const evaluations = result.data;

    // 定义分类图标映射
    const categoryIcons = {
      结构: "📋",
      内容: "📝",
      逻辑: "🔗",
      表达: "✍️",
      质量: "⭐",
    };
    const fallbackIcons = ["📋", "💡", "🔗"];

    let autoSuggestions = [];

    if (evaluations.suggestions && Array.isArray(evaluations.suggestions)) {
      autoSuggestions = evaluations.suggestions.slice(0, 3).map((s, index) => {
        // 处理新格式和旧格式的兼容
        if (typeof s === "string") {
          return {
            icon: fallbackIcons[index % fallbackIcons.length],
            text: s,
            category: "质量",
            priority: index + 1,
            issue: "",
            example: "",
          };
        } else {
          return {
            icon:
              categoryIcons[s.category] ||
              fallbackIcons[index % fallbackIcons.length],
            text: s.suggestion || s.text || "",
            category: s.category || "质量",
            priority: s.priority || index + 1,
            issue: s.issue || "",
            example: s.example || "",
          };
        }
      });
    }

    // 如果AI没有返回建议，使用备用建议
    if (autoSuggestions.length === 0) {
      const defaultSuggestions = [
        {
          icon: "📋",
          text: "优化章节间的层次关系，让大纲结构更清晰",
          category: "结构",
          priority: 1,
          issue: "",
          example: "",
        },
        {
          icon: "💡",
          text: "增加具体的案例和数据，提升内容的充实度",
          category: "内容",
          priority: 2,
          issue: "",
          example: "",
        },
        {
          icon: "🔗",
          text: "加强各部分之间的逻辑关联，让论证更严密",
          category: "逻辑",
          priority: 3,
          issue: "",
          example: "",
        },
      ];
      autoSuggestions = defaultSuggestions;
    }

    suggestions.value = autoSuggestions;

    for (let i = 0; i < dimensions.length; i++) {
      // 检查是否被中断
      if (isQualityCheckCancelled.value) return;

      const dim = dimensions[i];
      const text = evaluations[dim.key] || "评价加载失败";
      const scoreKey = `${dim.key}Score`;
      const score = evaluations[scoreKey] || 0;
      currentStep.value = i;

      // 先保存分数
      qualityScores.value[dim.key] = score;

      // 如果不是第一项，等200ms显示下一项
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        // 检查是否被中断
        if (isQualityCheckCancelled.value) return;
        visibleItems.value[i] = true;
        // 显示后立即滚动到底部
        await nextTick();
        scrollToBottom();
      }

      // 流式输出该条内容
      for (let j = 0; j < text.length; j++) {
        // 检查是否被中断
        if (isQualityCheckCancelled.value) return;
        qualityResults.value[dim.key] += text[j];
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    // 全部完成
    currentStep.value = 5;
    qualityCheckCompleted.value = true;

    // 直接在前端计算总分，不依赖后端！！
    totalScore.value =
      (qualityScores.value.structure || 0) +
      (qualityScores.value.content || 0) +
      (qualityScores.value.logic || 0) +
      (qualityScores.value.quality || 0) +
      (qualityScores.value.clarity || 0);

    // 根据总分生成评语
    if (totalScore.value >= 85) {
      totalComment.value = "文章优秀，继续保持！";
    } else if (totalScore.value >= 70) {
      totalComment.value = "文章良好，还有提升空间！";
    } else if (totalScore.value >= 50) {
      totalComment.value = "文章一般，需要继续完善！";
    } else {
      totalComment.value = "继续努力，提升文章质量！";
    }

    // 保存本次结果和文章内容
    lastQualityCheck.value = {
      articleContent: fullMarkdown,
      results: { ...qualityResults.value },
      scores: { ...qualityScores.value },
      totalScore: totalScore.value,
      totalComment: totalComment.value,
      suggestions: [...suggestions.value],
    };
    // 持久化到 localStorage
    saveQualityCheckRecord();

    // 等待300ms
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 先显示总分，让内容高度先确定
    visibleTotalScore.value = true;

    // 等DOM更新后，立即滚动到底部
    await nextTick();
    scrollToBottom();

    // 进度条动画
    const targetWidth = totalScore.value;
    for (let i = 0; i <= targetWidth; i += 2) {
      if (isQualityCheckCancelled.value) return;
      progressBarWidth.value = i;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    progressBarWidth.value = targetWidth;

    // 进度条完成后，显示修改建议
    await new Promise((resolve) => setTimeout(resolve, 400));
    // 先滚动到底部（准备显示建议区域
    visibleSuggestions.value = true;
    await nextTick();
    scrollToBottom();

    // 瀑布式显示每条建议
    for (let i = 0; i < suggestions.value.length; i++) {
      if (isQualityCheckCancelled.value) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
      visibleSuggestionItems.value[i] = true;
      // 每次显示后滚动到底部
      await nextTick();
      scrollToBottom();
    }
  } catch (error) {
    if (!isQualityCheckCancelled.value) {
      console.error("质检失败:", error);
      qualityCheckError.value = "质检暂时不可用，请稍后再试";
      showLoadingState.value = false;
    }
  } finally {
    qualityCheckLoading.value = false;
  }
};

// 滚动到弹窗底部
const scrollToBottom = () => {
  const modalBody = document.querySelector(".modal-body");
  if (!modalBody) return;

  // 使用直接赋值方式，兼容性更好
  modalBody.scrollTop = modalBody.scrollHeight;
};

// 关闭质检弹窗
const closeQualityCheck = () => {
  // 判断是否还在加载或生成过程中
  if (!qualityCheckCompleted.value && qualityCheckLoading.value) {
    isQualityCheckCancelled.value = true;
    qualityCheckLoading.value = false;

    // 清理错误的质检记录，防止下次显示错误数据
    lastQualityCheck.value = {
      articleContent: "",
      results: null,
      scores: null,
      totalScore: 0,
      totalComment: "",
      suggestions: null,
    };

    // 清理 localStorage
    localStorage.removeItem(getQualityCheckStorageKey());

    // 使用 Toast 提示中断信息
    emit("show-toast", "已中断质检", "warning", 2500);
  } else {
    // 正常关闭时重置中断标志
    isQualityCheckCancelled.value = false;
  }

  showQualityCheck.value = false;
  showLoadingState.value = true;
  qualityCheckError.value = "";
  visibleItems.value = [false, false, false, false, false];
  visibleTotalScore.value = false;
  visibleSuggestions.value = false;
  visibleSuggestionItems.value = [false, false, false];
  qualityResults.value = {
    structure: "",
    content: "",
    logic: "",
    quality: "",
    clarity: "",
  };
  totalScore.value = 0;
  totalComment.value = "";
  progressBarWidth.value = 0;
  currentStep.value = -1;
};

// 导出 Markdown
const exportMarkdown = () => {
  exportMarkdownFile(props.project.name, outline.value);
};

// 编辑标题
const startEditTitle = (e) => {
  e.stopPropagation(); // 阻止事件冒泡
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
    editorRef.value.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }
};

defineExpose({
  exportMarkdown,
  canExport,
});

onMounted(() => {
  loadFromStorage();
  loadQualityCheckRecord();
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

// 监听项目 ID 变化，重新加载质检记录
watch(
  () => props.project.id,
  () => {
    loadQualityCheckRecord();
    // 重置状态
    showQualityCheck.value = false;
    showLoadingState.value = true;
    visibleItems.value = [false, false, false, false, false];
    visibleTotalScore.value = false;
    qualityResults.value = {
      structure: "",
      content: "",
      logic: "",
      quality: "",
      clarity: "",
    };
    qualityScores.value = {
      structure: 0,
      content: 0,
      logic: 0,
      quality: 0,
      clarity: 0,
    };
    totalScore.value = 0;
    totalComment.value = "";
    progressBarWidth.value = 0;
    currentStep.value = -1;
  },
);
</script>

<template>
  <div class="editor" ref="editorRef">
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
            @click="startEditTitle($event)"
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

      <!-- 大纲编辑器 -->
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

    <!-- 智能质检弹窗 -->
    <QualityCheckModal
      ref="qualityCheckModalRef"
      :projectId="project.id"
      :projectName="project.name"
      :outline="outline"
      :isGeneratingContent="isGeneratingContent"
      :fullMarkdown="generateMarkdown(project.name, outline)"
      @show-toast="
        (message, type, duration) => emit('show-toast', message, type, duration)
      "
    />

    <!-- 回到顶部按钮 -->
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
