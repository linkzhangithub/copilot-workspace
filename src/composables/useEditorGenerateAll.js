import { ref } from "vue";

export const useEditorGenerateAll = (options) => {
  const { outline, projectName, emit, hasGeneratedAllContent } = options;

  const isGeneratingAll = ref(false);
  const isPaused = ref(false);
  const generatingSubsectionPath = ref(null);
  const currentGeneratingIndex = ref(0);
  const totalGeneratingCount = ref(0);
  let isProcessing = false;

  // AbortController 用于中断 API 请求
  let currentAbortController = null;

  // 强制中断标志 - 用于切换项目时立即中断
  let shouldForceStop = false;

  const hasEmptySubsections = () => {
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
  };

  /**
   * 清理生成状态 - 用于切换项目时中断生成
   */
  const cleanupGeneratingState = () => {
    // 设置强制中断标志
    shouldForceStop = true;

    // 中断当前正在进行的 API 请求
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }

    // 清空正在生成的小节内容
    if (generatingSubsectionPath.value) {
      const [i, j] = generatingSubsectionPath.value;
      if (outline.value[i]?.children?.[j]) {
        outline.value[i].children[j].content = "";
        outline.value = [...outline.value];
      }
    }

    // 重置所有生成状态
    isGeneratingAll.value = false;
    isPaused.value = false;
    generatingSubsectionPath.value = null;
    currentGeneratingIndex.value = 0;
    totalGeneratingCount.value = 0;
    isProcessing = false;
  };

  const handleGenerateAllContent = async () => {
    // 如果正在生成且未暂停，则暂停
    if (isGeneratingAll.value && !isPaused.value) {
      isPaused.value = true;
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
        generatingSubsectionPath.value = null;
      }
      emit("show-toast", "已暂停生成，点击继续生成", "warning", 2000);
      return;
    }

    // 如果已暂停，则继续生成（不return，继续执行后面的逻辑）
    const isResuming = isPaused.value;
    if (isResuming) {
      isPaused.value = false;
      emit("show-toast", "继续生成内容...", "info", 2000);
    }

    // 如果正在处理中（非暂停状态），则拒绝
    if (isProcessing && !isResuming) {
      emit("show-toast", "正在处理中，请稍候...", "warning", 1000);
      return;
    }

    isProcessing = true;

    // 重置强制中断标志
    shouldForceStop = false;

    try {
      isGeneratingAll.value = true;
      hasGeneratedAllContent.value = false;

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

      if (!isResuming) {
        emit("show-toast", "开始生成所有小节内容，请稍候...", "info", 3000);
      }

      for (let i = 0; i < outline.value.length; i++) {
        if (isPaused.value || shouldForceStop) return;

        const chapter = outline.value[i];

        if (chapter.children && chapter.children.length > 0) {
          for (let j = 0; j < chapter.children.length; j++) {
            if (isPaused.value || shouldForceStop) return;

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
                // 创建新的 AbortController
                currentAbortController = new AbortController();

                const response = await fetch(
                  "/api/ai/generate-content-simple",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      outline: outline.value,
                      path: [i, j],
                      contextInfo: {
                        articleTopic: projectName.value,
                        completedSections: [],
                        usedKeyPoints: [],
                        taskType: "first_generate",
                        isFirstContent: i === 0 && j === 0,
                        positionDescription: `第${i + 1}章第${j + 1}小节`,
                        isSubsection: true,
                      },
                    }),
                    signal: currentAbortController.signal,
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
                      outline.value[i].children[j].content = "";
                      outline.value = [...outline.value];
                      return;
                    }

                    outline.value[i].children[j].content = content.substring(
                      0,
                      k + 1,
                    );
                    outline.value = [...outline.value];
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

      if (!isPaused.value && !hasEmptySubsections()) {
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
      isProcessing = false;
    }
  };

  return {
    isGeneratingAll,
    isPaused,
    generatingSubsectionPath,
    currentGeneratingIndex,
    totalGeneratingCount,
    handleGenerateAllContent,
    cleanupGeneratingState,
  };
};
