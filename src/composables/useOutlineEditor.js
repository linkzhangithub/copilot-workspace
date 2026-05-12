import { ref, computed, nextTick } from "vue";
import { deepClone } from "../utils/deepClone.js";
import {
  MAX_CHAPTERS,
  MAX_SUBSECTIONS_PER_CHAPTER,
  MAX_TOTAL_SUBSECTIONS,
} from "../constants/limits.js";

export const useOutlineEditor = (options) => {
  const { outline, emit } = options;

  const editingPath = ref(null);
  const editingValue = ref("");
  const editInputRefs = ref({});
  const expandedState = ref({});
  const generatingPath = ref(null);

  const isDragging = ref(false);
  const dragIndex = ref(-1);
  const originalDragIndex = ref(-1);
  const dragStartY = ref(0);
  const currentDragY = ref(0);
  const itemOffsets = ref({});
  const itemRefs = ref([]);
  const outlineListRef = ref(null);
  const localOutline = ref([]);

  const articleStructure = computed(() => {
    const chapterCount = outline.value.length;
    let totalSubsections = 0;
    const chapterSubsectionCounts = outline.value.map((chapter) => {
      const count = chapter.children?.length || 0;
      totalSubsections += count;
      return count;
    });

    return {
      chapterCount,
      totalSubsections,
      chapterSubsectionCounts,
      canAddChapter: chapterCount < MAX_CHAPTERS,
      canAddSubsection: (chapterIndex) => {
        const chapterSubCount = chapterSubsectionCounts[chapterIndex] || 0;
        return (
          chapterSubCount < MAX_SUBSECTIONS_PER_CHAPTER &&
          totalSubsections < MAX_TOTAL_SUBSECTIONS
        );
      },
      getSubsectionTooltip: (chapterIndex) => {
        const chapterSubCount = chapterSubsectionCounts[chapterIndex] || 0;
        if (totalSubsections >= MAX_TOTAL_SUBSECTIONS) {
          return "文章结构已充实，建议专注内容创作";
        }
        if (chapterSubCount >= MAX_SUBSECTIONS_PER_CHAPTER) {
          return "AI 建议的小节已完善，可手动调整";
        }
        return "";
      },
    };
  });

  const flatOutline = computed(() => {
    const result = [];
    const outlineToUse =
      isDragging.value && localOutline.value.length > 0
        ? localOutline.value
        : outline.value;

    const flatten = (items, path = [], level = 0, parentCollapsed = false) => {
      items.forEach((item, index) => {
        const currentPath = [...path, index];
        const pathKey = getPathKey(currentPath);
        const hasChildren = item.children && item.children.length > 0;
        const isCollapsed = expandedState.value[pathKey] ?? false;

        result.push({
          ...item,
          path: currentPath,
          level,
          hasChildren,
          isCollapsed,
        });

        if (hasChildren && !isCollapsed && !parentCollapsed) {
          flatten(item.children, currentPath, level + 1, isCollapsed);
        }
      });
    };

    flatten(outlineToUse);
    return result;
  });

  const getPathKey = (path) => path.join("-");

  const toggleExpand = (path, event) => {
    if (event) event.stopPropagation();
    const key = getPathKey(path);
    const current = expandedState.value[key] ?? true;
    expandedState.value[key] = !current;
  };

  const expandAll = () => {
    const newExpandedState = {};
    const setExpanded = (items, path = []) => {
      items.forEach((item, index) => {
        const currentPath = [...path, index];
        if (item.children && item.children.length > 0) {
          newExpandedState[getPathKey(currentPath)] = false;
          setExpanded(item.children, currentPath);
        }
      });
    };
    setExpanded(outline.value);
    expandedState.value = newExpandedState;
  };

  const collapseAll = () => {
    const newExpandedState = {};
    const setCollapsed = (items, path = []) => {
      items.forEach((item, index) => {
        const currentPath = [...path, index];
        if (item.children && item.children.length > 0) {
          newExpandedState[getPathKey(currentPath)] = true;
          setCollapsed(item.children, currentPath);
        }
      });
    };
    setCollapsed(outline.value);
    expandedState.value = newExpandedState;
  };

  const isAllExpanded = computed(() => {
    let hasChildren = false;
    for (const item of flatOutline.value) {
      if (item.hasChildren) {
        hasChildren = true;
        if (item.isCollapsed) return false;
      }
    }
    return hasChildren;
  });

  const getAllExistingTitles = () => {
    const titles = new Set();
    const collect = (items) => {
      items.forEach((item) => {
        if (item.title) {
          titles.add(item.title.trim().toLowerCase());
        }
        if (item.children && item.children.length > 0) {
          collect(item.children);
        }
      });
    };
    collect(outline.value);
    return titles;
  };

  const getSectionByPath = (path) => {
    let current = outline.value;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children;
    }
    return current[path[path.length - 1]];
  };

  const updateSectionByPath = (path, updates) => {
    const newOutline = deepClone(outline.value);
    let current = newOutline;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children;
    }
    current[path[path.length - 1]] = {
      ...current[path[path.length - 1]],
      ...updates,
    };
    emit("update:outline", newOutline);
  };

  const deleteSectionByPath = (path, event) => {
    event.stopPropagation();
    const newOutline = deepClone(outline.value);
    let current = newOutline;
    if (path.length === 1) {
      const updated = newOutline.filter((_, i) => i !== path[0]);
      emit("update:outline", updated);
    } else {
      for (let i = 0; i < path.length - 2; i++) {
        current = current[path[i]].children;
      }
      const parent = current[path[path.length - 2]].children;
      parent.splice(path[path.length - 1], 1);
      emit("update:outline", newOutline);
    }
  };

  const addSection = () => {
    if (!articleStructure.value.canAddChapter) {
      emit("show-toast", "文章结构已完善，建议专注内容创作", "warning", 3000);
      return;
    }

    const newOutline = [
      ...outline.value,
      {
        id: `section-${Date.now()}`,
        title: "新章节",
        children: [],
      },
    ];
    emit("update:outline", newOutline);
  };

  const startEdit = (path) => {
    editingPath.value = path;
    editingValue.value = getSectionByPath(path).title;
    nextTick(() => {
      const key = getPathKey(path);
      const input = editInputRefs.value[key];
      if (input && input.focus) {
        input.focus();
        if (input.select) input.select();
      }
    });
  };

  const saveEdit = () => {
    if (editingPath.value === null) return;
    updateSectionByPath(editingPath.value, {
      title: editingValue.value.trim(),
    });
    editingPath.value = null;
  };

  const cancelEdit = () => {
    editingPath.value = null;
  };

  const handleDragStart = (path, event) => {
    if (isDragging.value) return;
    collapseAll();
    dragIndex.value = path[0];
    originalDragIndex.value = path[0];
    localOutline.value = deepClone(outline.value);
    nextTick(() => {
      dragStartY.value = event.clientY;
      currentDragY.value = 0;
      isDragging.value = true;
    });
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragMove = (event) => {
    if (!isDragging.value || dragIndex.value === -1) return;
    const deltaY = event.clientY - dragStartY.value;
    const listRect = outlineListRef.value?.getBoundingClientRect();
    if (!listRect) return;
    const items = document.querySelectorAll(".outline-item-wrapper-level-0");
    if (items.length === 0) return;

    let totalHeight = 0;
    items.forEach((item) => {
      totalHeight += item.getBoundingClientRect().height + 10;
    });
    totalHeight -= 10;

    const draggedItemHeight =
      items[originalDragIndex.value]?.getBoundingClientRect().height || 56;
    const minY = -originalDragIndex.value * (draggedItemHeight + 10);
    const maxY =
      (localOutline.value.length - 1 - originalDragIndex.value) *
      (draggedItemHeight + 10);

    currentDragY.value = Math.max(minY, Math.min(maxY, deltaY));

    const avgItemHeight = totalHeight / localOutline.value.length;
    const movedItems = Math.round(deltaY / avgItemHeight);
    let targetPosition = originalDragIndex.value + movedItems;
    targetPosition = Math.max(
      0,
      Math.min(targetPosition, localOutline.value.length - 1),
    );

    const newOffsets = {};
    const draggedHeight = draggedItemHeight + 10;

    for (let i = 0; i < localOutline.value.length; i++) {
      if (i === originalDragIndex.value) {
        newOffsets[i] = 0;
      } else {
        if (targetPosition < originalDragIndex.value) {
          if (i >= targetPosition && i < originalDragIndex.value) {
            newOffsets[i] = draggedHeight;
          } else {
            newOffsets[i] = 0;
          }
        } else if (targetPosition > originalDragIndex.value) {
          if (i > originalDragIndex.value && i <= targetPosition) {
            newOffsets[i] = -draggedHeight;
          } else {
            newOffsets[i] = 0;
          }
        } else {
          newOffsets[i] = 0;
        }
      }
    }
    itemOffsets.value = newOffsets;
  };

  const handleDragEnd = () => {
    if (!isDragging.value) return;
    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);

    if (localOutline.value.length > 0) {
      let targetPosition = originalDragIndex.value;
      for (let i = 0; i < localOutline.value.length; i++) {
        if (itemOffsets.value[i] !== 0) {
          if (itemOffsets.value[i] > 0) {
            targetPosition = i;
            break;
          } else if (itemOffsets.value[i] < 0) {
            targetPosition = i;
          }
        }
      }

      if (targetPosition !== originalDragIndex.value) {
        const [removed] = localOutline.value.splice(originalDragIndex.value, 1);
        localOutline.value.splice(targetPosition, 0, removed);
      }
      emit("update:outline", localOutline.value);
    }

    isDragging.value = false;
    dragIndex.value = -1;
    originalDragIndex.value = -1;
    currentDragY.value = 0;
    itemOffsets.value = {};
    localOutline.value = [];
  };

  const getItemStyle = (item) => {
    if (!item || item.level !== 0) return {};
    if (isDragging.value && item.path[0] === originalDragIndex.value) {
      return {
        position: "relative",
        zIndex: 1000,
        transform: `translateY(${currentDragY.value}px) scale(1.02)`,
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        border: "2px solid var(--primary)",
        backgroundColor: "var(--selected-bg)",
        transition:
          "box-shadow 0.15s ease, transform 0s, border 0.15s ease, background-color 0.15s ease",
      };
    }
    if (isDragging.value && itemOffsets.value[item.path[0]]) {
      return {
        transform: `translateY(${itemOffsets.value[item.path[0]]}px)`,
      };
    }
    return {};
  };

  const getDisplayNumber = (path) => path.map((p) => p + 1).join(".");

  return {
    editingPath,
    editingValue,
    editInputRefs,
    expandedState,
    generatingPath,
    isDragging,
    dragIndex,
    originalDragIndex,
    currentDragY,
    itemOffsets,
    itemRefs,
    outlineListRef,
    localOutline,
    articleStructure,
    flatOutline,
    getPathKey,
    toggleExpand,
    expandAll,
    collapseAll,
    isAllExpanded,
    getAllExistingTitles,
    getSectionByPath,
    updateSectionByPath,
    deleteSectionByPath,
    addSection,
    startEdit,
    saveEdit,
    cancelEdit,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    getItemStyle,
    getDisplayNumber,
  };
};
