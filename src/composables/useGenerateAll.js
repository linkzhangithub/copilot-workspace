import { ref, computed } from "vue";

/**
 * 一键生成相关逻辑的 Composable
 * @param {Object} options - 配置选项
 * @param {Function} options.emit - Vue emit 函数
 * @param {Function} options.getProjectName - 获取项目名称的函数
 * @param {Function} options.getOutline - 获取大纲数据的函数localStorage.setItem('test-key', 'test-value')
 * @param {Function} options.setOutline - 设置大纲数据的函数
 * @param {Function} options.getHasEmptySubsections - 获取是否有空白小节的函数
 * @returns {Object} - 一键生成相关的状态和方法
 */
export const useGenerateAll = (options) => {
  const {
    emit,
    getProjectName,
    getOutline,
    setOutline,
    getHasEmptySubsections,
  } = options;

  const isGeneratingAll = ref(false);
  const isPaused = ref(false);
  const generatingSubsectionPath = ref(null);
  const currentGeneratingIndex = ref(0);
  const totalGeneratingCount = ref(0);
  const hasGeneratedAllContent = ref(false);

  /**
   * 计算一键生成按钮的状态
   */
  const generateAllButtonState = computed(() => {
    if (isGeneratingAll.value && !isPaused.value) {
      return "generating";
    } else if (isPaused.value) {
      return "paused";
    } else if (getHasEmptySubsections()) {
      return "ready";
    } else {
      return "completed";
    }
  });

  /**
   * 计算是否有内容正在生成
   */
  const isGeneratingContent = computed(() => {
    if (generatingSubsectionPath.value !== null) return true;
    if (isGeneratingAll.value && !isPaused.value) return true;
    return false;
  });

  /**
   * 一键生成所有内容
   */
  const handleGenerateAllContent = async () => {
    if (isGeneratingAll.value && !isPaused.value) {
      isPaused.value = true;

      if (generatingSubsectionPath.value) {
        const [i, j] = generatingSubsectionPath.value;
        const outline = getOutline();
        if (outline[i] && outline[i].children && outline[i].children[j]) {
          outline[i].children[j].content = "";
          setOutline([...outline]);
        }
        generatingSubsectionPath.value = null;
      }

      emit("show-toast", "已暂停生成，点击继续生成", "warning", 2000);
      return;
    }

    if (isPaused.value) {
      isPaused.value = false;
      emit("show-toast", "继续生成内容...", "info", 2000);
    } else {
      isGeneratingAll.value = true;
      hasGeneratedAllContent.value = false;

      let emptyCount = 0;
      const outline = getOutline();
      for (let i = 0; i < outline.length; i++) {
        const chapter = outline[i];
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
      const outline = getOutline();
      for (let i = 0; i < outline.length; i++) {
        if (isPaused.value) return;

        const chapter = outline[i];

        if (chapter.children && chapter.children.length > 0) {
          for (let j = 0; j < chapter.children.length; j++) {
            if (isPaused.value) return;

            const subsection = chapter.children[j];

            if (!subsection.content) {
              generatingSubsectionPath.value = [i, j];
              currentGeneratingIndex.value++;

              emit(
                "show-toast",
                `正在生成第 ${i + 1} 章第 ${j + 1} 小节内容...`,
                "info",
                2000,
              );

              try {
                const response = await fetch(
                  "/api/ai/generate-content-simple",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      outline: outline,
                      path: [i, j],
                      contextInfo: {
                        articleTopic: getProjectName(),
                        completedSections: [],
                        usedKeyPoints: [],
                        taskType: "first_generate",
                        isFirstContent: i === 0 && j === 0,
                        positionDescription: `第${i + 1}章第${j + 1}小节`,
                        isSubsection: true,
                      },
                    }),
                  },
                );

                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                if (result.success && result.data) {
                  const content = result.data;
                  for (let k = 0; k < content.length; k++) {
                    if (isPaused.value) {
                      const currentOutline = getOutline();
                      currentOutline[i].children[j].content = "";
                      setOutline([...currentOutline]);
                      return;
                    }

                    const currentOutline = getOutline();
                    currentOutline[i].children[j].content = content.substring(
                      0,
                      k + 1,
                    );
                    setOutline([...currentOutline]);

                    if (k % 10 === 0) {
                      await new Promise((resolve) => setTimeout(resolve, 20));
                    }
                  }
                }
              } catch (error) {
                console.error(`生成小节 [${i}][${j}] 失败:`, error);
              }

              generatingSubsectionPath.value = null;
            }
          }
        }
      }

      if (!isPaused.value && !getHasEmptySubsections()) {
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

  return {
    isGeneratingAll,
    isPaused,
    generatingSubsectionPath,
    currentGeneratingIndex,
    totalGeneratingCount,
    hasGeneratedAllContent,
    generateAllButtonState,
    isGeneratingContent,
    handleGenerateAllContent,
  };
};
