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
  ArrowUp,
} from "lucide-vue-next";

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update-project", "show-toast"]);

// 章节限制常量
const MAX_CHAPTERS = 8;
const MAX_SUBSECTIONS_PER_CHAPTER = 10;
const MAX_TOTAL_SUBSECTIONS = 50;

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

// 质检弹窗相关
const showQualityCheck = ref(false);
const qualityCheckLoading = ref(false);
const qualityCheckError = ref(""); // 质检错误提示
const showLoadingState = ref(true); // 控制显示加载状态还是评价系统
const visibleItems = ref([false, false, false, false, false]); // 控制每一项的可见性
const qualityResults = ref({
  structure: "",
  content: "",
  logic: "",
  quality: "",
  clarity: "",
});
const qualityScores = ref({
  structure: 0,
  content: 0,
  logic: 0,
  quality: 0,
  clarity: 0,
});
const totalScore = ref(0);
const totalComment = ref("");
const visibleTotalScore = ref(false);
const progressBarWidth = ref(0);
const currentStep = ref(-1); // -1=未开始, 0-4=当前步骤
const isQualityCheckCancelled = ref(false); // 标记是否被中断
const qualityCheckCompleted = ref(false); // 标记是否完成

// 修改建议相关状态
const visibleSuggestions = ref(false);
const visibleSuggestionItems = ref([false, false, false]);
const suggestions = ref([]);

// 保存上一次的质检结果和文章内容 - 按项目ID持久化
const getQualityCheckStorageKey = () => `quality-check-${props.project.id}`;
const lastQualityCheck = ref({
  articleContent: "",
  results: null,
  scores: null,
  totalScore: 0,
  totalComment: "",
  suggestions: null,
});

// 加载项目质检记录
const loadQualityCheckRecord = () => {
  try {
    const saved = localStorage.getItem(getQualityCheckStorageKey());
    if (saved) {
      let data = JSON.parse(saved);

      // 给旧数据补全缺失的字段
      if (data.totalScore === undefined && data.scores) {
        // 旧数据没有总分，计算5个维度的得分之和
        data.totalScore =
          (data.scores.structure || 0) +
          (data.scores.content || 0) +
          (data.scores.logic || 0) +
          (data.scores.quality || 0) +
          (data.scores.clarity || 0);
        data.totalComment = "继续努力，提升文章质量！";
      }

      // 给旧数据补全suggestions
      if (!data.suggestions) {
        data.suggestions = [
          {
            icon: "💡",
            text: "增加2-3个具体案例或数据支持，提升内容的说服力和充实度",
          },
          {
            icon: "📝",
            text: "优化段落之间的过渡语句，让文章逻辑更加连贯自然",
          },
          { icon: "🎯", text: "简化部分冗长复杂的句子，让表达更加清晰易懂" },
        ];
      }

      lastQualityCheck.value = data;
      console.log("已加载项目质检记录:", props.project.id, data);
    } else {
      // 没有记录时重置
      lastQualityCheck.value = {
        articleContent: "",
        results: null,
        scores: null,
        totalScore: 0,
        totalComment: "",
        suggestions: null,
      };
    }
  } catch (e) {
    console.error("加载质检记录失败:", e);
    lastQualityCheck.value = {
      articleContent: "",
      results: null,
      scores: null,
      totalScore: 0,
      totalComment: "",
      suggestions: null,
    };
  }
};

// 根据总分获取样式和颜色
const getTotalScoreColor = (score) => {
  if (score >= 85) return "#10b981"; // 绿色 - 优秀
  if (score >= 70) return "#3b82f6"; // 蓝色 - 良好
  if (score >= 50) return "#f59e0b"; // 橙色 - 中等
  return "#ef4444"; // 红色 - 需改进
};

// 保存项目质检记录
const saveQualityCheckRecord = () => {
  try {
    localStorage.setItem(
      getQualityCheckStorageKey(),
      JSON.stringify(lastQualityCheck.value),
    );
    console.log(
      "已保存项目质检记录:",
      props.project.id,
      lastQualityCheck.value,
    );
  } catch (e) {
    console.error("保存质检记录失败:", e);
  }
};

// 判断是否可以显示质检报告（内容未变化且有结果）
const canShowQualityReport = computed(() => {
  if (!lastQualityCheck.value.results || !lastQualityCheck.value.scores)
    return false;
  const currentContent = generateFullMarkdown();
  return currentContent === lastQualityCheck.value.articleContent;
});

// 根据分数获取样式类
const getScoreClass = (score) => {
  if (score >= 17) return "score-excellent";
  if (score >= 13) return "score-good";
  if (score >= 9) return "score-medium";
  if (score >= 5) return "score-poor";
  return "score-bad";
};

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
      emit("show-toast", "所有小节内容生成完成！", "success", 3000);
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

  console.log("=== 质检内容检查 ===");
  console.log("outline长度:", outline.value.length);
  console.log("outline完整数据:", JSON.stringify(outline.value, null, 2));

  // 检查是否有文章内容
  const hasContent = outline.value.some(
    (section) =>
      section.content ||
      (section.children && section.children.some((sub) => sub.content)),
  );

  console.log("hasContent结果:", hasContent);

  if (!hasContent) {
    emit("show-toast", "请先生成文章内容", "warning", 3000);
    return;
  }

  // 重置状态
  isQualityCheckCancelled.value = false;
  qualityCheckCompleted.value = false;

  // 如果内容未变且有结果，直接显示
  const fullMarkdown = generateFullMarkdown();

  console.log("=== 前端质检 ===");
  console.log("fullMarkdown长度:", fullMarkdown.length);
  console.log("fullMarkdown前200字符:", fullMarkdown.substring(0, 200));
  console.log("outline:", outline.value);

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

    console.log("=== 后端返回的完整数据 ===");
    console.log("result:", result);
    console.log("result.success:", result.success);
    console.log("result.error:", result.error);
    console.log("result.data:", result.data);
    console.log("result.data 结构:", JSON.stringify(result.data, null, 2));

    // 检查是否成功
    if (!result.success) {
      throw new Error(result.error || "质检请求失败");
    }

    // 检查数据是否有效
    if (!result.data || result.data.totalScore === 0) {
      console.error("质检数据无效，可能是 AI 返回格式错误");
      emit("show-toast", "质检失败，请稍后重试", "error", 3000);
      qualityCheckLoading.value = false;
      return;
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
    let shouldSkip = false;

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
          shouldSkip = true;
        }

        // 检查是否有部分关键词匹配（比如"概述"匹配"AI写作助手概述"）
        if (!shouldSkip) {
          const titleWords = title.split(/[、\s]+/);
          for (const word of titleWords) {
            if (word.length >= 2 && lineClean.includes(cleanForMatch(word))) {
              shouldSkip = true;
              break;
            }
          }
        }
      }
    }

    if (shouldSkip) {
      removedCount++;
      continue;
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
const startEditTitle = (e) => {
  console.log("startEditTitle 被调用", e);
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
    console.log("项目 ID 变化，重新加载质检记录:", props.project.id);
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
              <!-- 错误提示 -->
              <div v-if="qualityCheckError" class="quality-error-message">
                <Icon name="AlertCircle" :size="18" />
                <span>{{ qualityCheckError }}</span>
              </div>
              <template v-else>
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
                      <span class="quality-result-content">{{
                        qualityResults.structure
                      }}</span>
                    </div>
                    <div
                      class="quality-score"
                      :class="getScoreClass(qualityScores.structure)"
                    >
                      {{ qualityScores.structure
                      }}<span class="score-total">/20</span>
                    </div>
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
                    <div class="quality-result">
                      <span class="quality-result-content">{{
                        qualityResults.content
                      }}</span>
                    </div>
                    <div
                      class="quality-score"
                      :class="getScoreClass(qualityScores.content)"
                    >
                      {{ qualityScores.content
                      }}<span class="score-total">/20</span>
                    </div>
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
                    <div class="quality-result">
                      <span class="quality-result-content">{{
                        qualityResults.logic
                      }}</span>
                    </div>
                    <div
                      class="quality-score"
                      :class="getScoreClass(qualityScores.logic)"
                    >
                      {{ qualityScores.logic
                      }}<span class="score-total">/20</span>
                    </div>
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
                    <div class="quality-result">
                      <span class="quality-result-content">{{
                        qualityResults.quality
                      }}</span>
                    </div>
                    <div
                      class="quality-score"
                      :class="getScoreClass(qualityScores.quality)"
                    >
                      {{ qualityScores.quality
                      }}<span class="score-total">/20</span>
                    </div>
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
                    <div class="quality-result">
                      <span class="quality-result-content">{{
                        qualityResults.clarity
                      }}</span>
                    </div>
                    <div
                      class="quality-score"
                      :class="getScoreClass(qualityScores.clarity)"
                    >
                      {{ qualityScores.clarity
                      }}<span class="score-total">/20</span>
                    </div>
                  </div>
                </TransitionGroup>

                <!-- 总分显示 -->
                <Transition name="slide-fade">
                  <div
                    v-if="visibleTotalScore"
                    key="total"
                    class="total-score-section"
                  >
                    <div class="total-score-header">
                      <span class="total-score-label">文章综合评分</span>
                      <span
                        class="total-score-value"
                        :style="{ color: getTotalScoreColor(totalScore) }"
                      >
                        {{ totalScore
                        }}<span class="total-score-suffix">/100</span>
                      </span>
                    </div>
                    <div class="progress-bar-container">
                      <div
                        class="progress-bar"
                        :style="{
                          width: `${progressBarWidth}%`,
                          backgroundColor: getTotalScoreColor(totalScore),
                        }"
                      ></div>
                    </div>
                    <p class="total-comment">{{ totalComment }}</p>
                  </div>
                </Transition>

                <!-- 修改建议区域 -->
                <Transition name="slide-fade">
                  <div
                    v-if="visibleSuggestions"
                    key="suggestions"
                    class="suggestions-section"
                  >
                    <div class="suggestions-header">
                      <span class="suggestions-title">📋 优先改进建议</span>
                    </div>
                    <div class="suggestions-list">
                      <TransitionGroup name="item-fade">
                        <div
                          v-for="(suggestion, index) in suggestions"
                          :key="index"
                          v-show="visibleSuggestionItems[index]"
                          class="suggestion-item"
                        >
                          <div class="suggestion-left">
                            <span class="suggestion-icon">{{
                              suggestion.icon
                            }}</span>
                          </div>
                          <div class="suggestion-content">
                            <div class="suggestion-header">
                              <span class="suggestion-category">{{
                                suggestion.category
                              }}</span>
                              <span class="suggestion-priority"
                                >优先级 {{ suggestion.priority }}</span
                              >
                            </div>
                            <div
                              v-if="suggestion.issue"
                              class="suggestion-issue"
                            >
                              问题：{{ suggestion.issue }}
                            </div>
                            <div class="suggestion-text">
                              {{ suggestion.text }}
                            </div>
                            <div
                              v-if="suggestion.example"
                              class="suggestion-example"
                            >
                              示例：{{ suggestion.example }}
                            </div>
                          </div>
                        </div>
                      </TransitionGroup>
                    </div>
                  </div>
                </Transition>
              </template>
            </div>
          </Transition>
        </div>
      </div>
    </div>

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
  cursor: pointer;
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
  justify-content: center;
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

.generate-btn.disabled-btn {
  opacity: 0.5;
  background-color: var(--text-muted);
  cursor: not-allowed;
}

.generate-btn.disabled-btn:hover {
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
  justify-content: center;
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

/* 质检报告模式 - 绿色系 */
.quality-check-btn.quality-report-mode {
  border-color: #10b981;
  color: #10b981;
}

.quality-check-btn.quality-report-mode:hover:not(:disabled) {
  background-color: rgba(16, 185, 129, 0.1);
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

/* 质检错误提示样式 */
.quality-error-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--danger);
  border-radius: 12px;
  color: var(--danger);
  font-size: 15px;
  font-weight: 500;
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
  line-height: 1.5;
}

.quality-result {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  min-height: 3em;
  max-height: 3em;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.quality-result-content {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.quality-score {
  width: 70px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 16px;
  font-weight: 700;
  color: var(--primary);
}

.score-total {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 2px;
}

.score-excellent {
  color: #10b981;
}

.score-good {
  color: #3b82f6;
}

.score-medium {
  color: #f59e0b;
}

.score-poor {
  color: #ef4444;
}

.score-bad {
  color: #dc2626;
}

/* 总分显示样式 */
.total-score-section {
  margin-top: 16px;
  padding: 20px 24px;
  background-color: var(--bg-secondary);
  border-radius: 16px;
  border: 1px solid var(--border);
}

.total-score-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.total-score-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.total-score-value {
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
}

.total-score-suffix {
  font-size: 18px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 2px;
}

.progress-bar-container {
  width: 100%;
  height: 10px;
  background-color: var(--bg-tertiary);
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.1s ease-out;
}

.total-comment {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  text-align: center;
}

/* 修改建议区域样式 */
.suggestions-section {
  margin-top: 16px;
  padding: 20px 24px;
  background-color: var(--bg-secondary);
  border-radius: 16px;
  border: 1px solid var(--border);
}

.suggestions-header {
  margin-bottom: 16px;
}

.suggestions-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suggestion-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background-color: var(--bg-tertiary);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.suggestion-left {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  padding-top: 2px;
}

.suggestion-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.suggestion-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.suggestion-category {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  background-color: var(--bg-input);
  color: var(--primary);
}

.suggestion-priority {
  font-size: 12px;
  color: var(--text-muted);
}

.suggestion-issue {
  font-size: 13px;
  color: var(--danger);
  font-weight: 500;
}

.suggestion-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.suggestion-example {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 8px 12px;
  background-color: var(--bg-input);
  border-radius: 8px;
  font-style: italic;
  border-left: 3px solid var(--primary);
}

/* 建议项淡入动画 */
.item-fade-enter-active,
.item-fade-leave-active {
  transition: all 0.3s ease;
}

.item-fade-enter-from,
.item-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
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

  .generate-btn,
  .quality-check-btn {
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

/* 回到顶部按钮 */
.back-to-top-btn {
  position: fixed;
  right: 28px;
  bottom: 28px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--bg-sidebar);
  border: 2px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
}

.back-to-top-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(14, 165, 233, 0.2);
}

.back-to-top-btn:active {
  transform: translateY(-1px);
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .back-to-top-btn {
    right: 20px;
    bottom: 20px;
    width: 44px;
    height: 44px;
  }
}

@media (max-width: 480px) {
  .back-to-top-btn {
    right: 16px;
    bottom: 16px;
    width: 40px;
    height: 40px;
  }
}
</style>
