import { ref } from "vue";

/**
 * 大纲生成和一键生成相关逻辑的 Composable
 */
export const useOutlineAndGenerate = (options) => {
  const {
    emit,
    getProjectName,
    getOutline,
    setOutline,
    getHasGeneratedOutline,
    setHasGeneratedOutline,
    getHasGeneratedAllContent,
    setHasGeneratedAllContent,
    getHasEmptySubsections,
  } = options;

  const error = ref("");
  const loading = ref(false);
  const isGeneratingAll = ref(false);
  const isPaused = ref(false);
  const generatingSubsectionPath = ref(null);
  const currentGeneratingIndex = ref(0);
  const totalGeneratingCount = ref(0);

  /**
   * 生成大纲
   */
  const generateOutline = async () => {
    error.value = "";
    loading.value = true;

    emit("show-toast", "AI写作助手正在为您构建大纲，请稍候...", "info", 2000);

    try {
      const response = await fetch("/api/ai/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: getProjectName(),
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
      setOutline([]);

      for (let i = 0; i < outlineData.length; i++) {
        const chapter = outlineData[i];

        const chapterWithEmptyChildren = {
          id: `section-${timestamp}-${i}`,
          title: chapter.title,
          children: [],
        };

        const currentOutline = getOutline();
        setOutline([...currentOutline, chapterWithEmptyChildren]);

        await new Promise((resolve) => setTimeout(resolve, 200));

        if (chapter.children && chapter.children.length > 0) {
          for (let j = 0; j < chapter.children.length; j++) {
            const subsectionTitle = chapter.children[j];

            const outline = getOutline();
            outline[i].children.push({
              id: `subsection-${timestamp}-${i}-${j}`,
              title: subsectionTitle,
              children: [],
            });

            setOutline([...outline]);

            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      setHasGeneratedOutline(true);

      emit(
        "show-toast",
        "大纲生成完成！当前已是AI推荐的最优结构，如有需要可手动调整",
        "success",
        3000,
      );
    } catch (err) {
      console.error("请求失败:", err);
      error.value = "生成大纲失败，请确保后端服务已启动";

      const outline = getOutline();
      if (outline.length === 0) {
        const fallbackOutline = [
          { title: "概述", children: ["背景介绍", "核心概念"] },
          { title: "技术原理", children: ["基础架构", "关键技术"] },
          { title: "应用场景", children: ["典型场景", "最佳实践"] },
          { title: "未来展望", children: ["发展趋势", "总结"] },
        ];

        const timestamp = Date.now();
        for (let i = 0; i < fallbackOutline.length; i++) {
          const chapter = fallbackOutline[i];

          const chapterWithEmptyChildren = {
            id: `section-${timestamp}-${i}`,
            title: chapter.title,
            children: [],
          };

          const currentOutline = getOutline();
          currentOutline.push(chapterWithEmptyChildren);
          setOutline([...currentOutline]);
          await new Promise((resolve) => setTimeout(resolve, 200));

          if (chapter.children && chapter.children.length > 0) {
            for (let j = 0; j < chapter.children.length; j++) {
              const subsectionTitle = chapter.children[j];

              const outline = getOutline();
              outline[i].children.push({
                id: `subsection-${timestamp}-${i}-${j}`,
                title: subsectionTitle,
                children: [],
              });

              setOutline([...outline]);
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
        }
      }
    } finally {
      loading.value = false;
    }
  };

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
      setHasGeneratedAllContent(false);

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
                      outline: getOutline(),
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
        setHasGeneratedAllContent(true);
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
    error,
    loading,
    isGeneratingAll,
    isPaused,
    generatingSubsectionPath,
    currentGeneratingIndex,
    totalGeneratingCount,
    generateOutline,
    handleGenerateAllContent,
  };
};
