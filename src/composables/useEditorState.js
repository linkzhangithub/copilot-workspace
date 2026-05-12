import { ref, computed } from "vue";
import { MAX_TOTAL_SUBSECTIONS } from "../constants/limits.js";

export const useEditorState = (options) => {
  const { projectId, emit } = options;

  const outline = ref([]);
  const error = ref("");
  const loading = ref(false);
  const hasGeneratedOutline = ref(false);
  const hasGeneratedAllContent = ref(false);

  const canGenerateOutline = computed(() => outline.value.length === 0);

  const generateOutlineTooltip = computed(() => {
    if (outline.value.length > 0) {
      return "大纲已存在，请先清空大纲";
    }
    return "";
  });

  const totalSubsections = computed(() => {
    return outline.value.reduce((total, chapter) => {
      return total + (chapter.children ? chapter.children.length : 0);
    }, 0);
  });

  const canAddMoreSubsections = computed(() => {
    return totalSubsections.value < MAX_TOTAL_SUBSECTIONS;
  });

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

  const getStorageKey = () => `project-${projectId.value}`;

  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem(getStorageKey());
      if (saved) {
        const data = JSON.parse(saved);
        outline.value = data.outline || [];
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

  const updateOutline = (newOutline) => {
    outline.value = newOutline;
  };

  return {
    outline,
    error,
    loading,
    hasGeneratedOutline,
    hasGeneratedAllContent,
    canGenerateOutline,
    generateOutlineTooltip,
    totalSubsections,
    canAddMoreSubsections,
    hasEmptySubsections,
    loadFromStorage,
    saveToStorage,
    updateOutline,
  };
};
