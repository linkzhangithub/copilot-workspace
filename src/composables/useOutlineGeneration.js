import { ref } from "vue";

/**
 * 大纲生成相关逻辑的 Composable
 * @param {Object} options - 配置选项
 * @param {Function} options.emit - Vue emit 函数
 * @param {Function} options.getProjectName - 获取项目名称的函数
 * @param {Function} options.getOutline - 获取大纲数据的函数
 * @param {Function} options.setOutline - 设置大纲数据的函数
 * @param {Function} options.setHasGeneratedOutline - 设置是否已生成大纲的函数
 * @returns {Object} - 大纲生成相关的状态和方法
 */
export const useOutlineGeneration = (options) => {
  const { emit, getProjectName, getOutline, setOutline, setHasGeneratedOutline } = options;

  const error = ref("");
  const loading = ref(false);

  /**
   * 给 outline 项目添加唯一 id
   */
  const addIdsToOutline = (outline, timestamp = Date.now()) => {
    return outline.map((item, index) => {
      const newItem = {
        ...item,
        id: `section-${timestamp}-${index}`,
      };

      if (item.children && Array.isArray(item.children)) {
        newItem.children = item.children.map((child, childIndex) => {
          if (typeof child === "string") {
            return {
              id: `subsection-${timestamp}-${index}-${childIndex}`,
              title: child,
              children: [],
            };
          } else {
            return {
              ...child,
              id: `subsection-${timestamp}-${index}-${childIndex}`,
              children: child.children || [],
            };
          }
        });
      } else {
        newItem.children = [];
      }

      return newItem;
    });
  };

  /**
   * 获取默认大纲
   */
  const getDefaultOutline = () => {
    return [
      { title: "概述", children: ["背景介绍", "核心概念"] },
      { title: "技术原理", children: ["基础架构", "关键技术"] },
      { title: "应用场景", children: ["典型场景", "最佳实践"] },
      { title: "未来展望", children: ["发展趋势", "总结"] },
    ];
  };

  /**
   * 生成大纲（一次性生成完整结构，流式显示）
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
        outlineData = getDefaultOutline();
      }

      const timestamp = Date.now();
      const currentOutline = [];

      for (let i = 0; i < outlineData.length; i++) {
        const chapter = outlineData[i];

        const chapterWithEmptyChildren = {
          id: `section-${timestamp}-${i}`,
          title: chapter.title,
          children: [],
        };

        currentOutline.push(chapterWithEmptyChildren);
        setOutline([...currentOutline]);

        await new Promise((resolve) => setTimeout(resolve, 200));

        if (chapter.children && chapter.children.length > 0) {
          for (let j = 0; j < chapter.children.length; j++) {
            const subsectionTitle = chapter.children[j];

            currentOutline[i].children.push({
              id: `subsection-${timestamp}-${i}-${j}`,
              title: subsectionTitle,
              children: [],
            });

            setOutline([...currentOutline]);

            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      setHasGeneratedOutline(true);

      emit(
        "show-toast",
        "大纲生成完成！当前已是AI推荐的最优结构，如有需要可手动调整",
        "success",
        3000
      );
    } catch (err) {
      console.error("请求失败:", err);
      error.value = "生成大纲失败，请确保后端服务已启动";

      const currentOutline = getOutline();
      if (currentOutline.length === 0) {
        const fallbackOutline = getDefaultOutline();
        const timestamp = Date.now();

        for (let i = 0; i < fallbackOutline.length; i++) {
          const chapter = fallbackOutline[i];
          currentOutline.push({
            id: `section-${timestamp}-${i}`,
            title: chapter.title,
            children: chapter.children,
          });
          setOutline([...currentOutline]);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } finally {
      loading.value = false;
    }
  };

  return {
    error,
    loading,
    generateOutline,
    addIdsToOutline,
    getDefaultOutline,
  };
};
