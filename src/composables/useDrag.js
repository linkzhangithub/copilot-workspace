import { ref, nextTick } from "vue";

/**
 * 拖拽相关逻辑的 Composable
 * @param {Object} options - 配置选项
 * @param {Function} options.emit - Vue emit 函数
 * @param {Function} options.getLocalOutline - 获取本地大纲数据的函数
 * @param {Function} options.setLocalOutline - 设置本地大纲数据的函数
 * @param {Function} options.getOutlineListRef - 获取大纲列表引用的函数
 * @param {Function} options.collapseAll - 收起所有展开的小节的函数
 * @param {Function} options.deepClone - 深拷贝函数
 * @param {Function} options.getPropsOutline - 获取 props.outline 的函数
 * @returns {Object} - 拖拽相关的状态和方法
 */
export const useDrag = (options) => {
  const {
    emit,
    getLocalOutline,
    setLocalOutline,
    getOutlineListRef,
    collapseAll,
    deepClone,
    getPropsOutline,
  } = options;

  const isDragging = ref(false);
  const dragIndex = ref(-1);
  const originalDragIndex = ref(-1);
  const dragStartY = ref(0);
  const currentDragY = ref(0);
  const itemOffsets = ref({});

  /**
   * 处理拖拽开始
   */
  const handleDragStart = (path, event) => {
    if (isDragging.value) return;

    collapseAll();

    dragIndex.value = path[0];
    originalDragIndex.value = path[0];

    setLocalOutline(deepClone(getPropsOutline()));

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

  /**
   * 处理拖拽移动
   */
  const handleDragMove = (event) => {
    if (!isDragging.value || dragIndex.value === -1) return;

    const deltaY = event.clientY - dragStartY.value;

    const listRect = getOutlineListRef()?.getBoundingClientRect();
    if (!listRect) return;

    const items = document.querySelectorAll(".outline-item-wrapper-level-0");
    if (items.length === 0) return;

    let totalHeight = 0;
    items.forEach((item) => {
      totalHeight += item.getBoundingClientRect().height + 10;
    });
    totalHeight -= 10;

    const localOutline = getLocalOutline();
    const draggedItemHeight =
      items[originalDragIndex.value]?.getBoundingClientRect().height || 56;
    const minY = -originalDragIndex.value * (draggedItemHeight + 10);
    const maxY =
      (localOutline.length - 1 - originalDragIndex.value) *
      (draggedItemHeight + 10);

    currentDragY.value = Math.max(minY, Math.min(maxY, deltaY));

    const avgItemHeight = totalHeight / localOutline.length;
    const movedItems = Math.round(deltaY / avgItemHeight);
    let targetPosition = originalDragIndex.value + movedItems;
    targetPosition = Math.max(0, Math.min(targetPosition, localOutline.length - 1));

    const newOffsets = {};
    const draggedHeight = draggedItemHeight + 10;

    for (let i = 0; i < localOutline.length; i++) {
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

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = (event) => {
    if (!isDragging.value) return;

    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);

    const localOutline = getLocalOutline();
    if (localOutline.length > 0) {
      let targetPosition = originalDragIndex.value;

      for (let i = 0; i < localOutline.length; i++) {
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
        const [removed] = localOutline.splice(originalDragIndex.value, 1);
        localOutline.splice(targetPosition, 0, removed);
      }

      emit("update:outline", localOutline);
    }

    isDragging.value = false;
    dragIndex.value = -1;
    originalDragIndex.value = -1;
    currentDragY.value = 0;
    itemOffsets.value = {};
    setLocalOutline([]);
  };

  /**
   * 清理拖拽事件监听器
   */
  const cleanupDragListeners = () => {
    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);
  };

  /**
   * 获取拖拽样式
   */
  const getDragStyle = (item) => {
    if (isDragging.value && item.path[0] === originalDragIndex.value) {
      return {
        transform: `translateY(${currentDragY.value}px) scale(1.02)`,
        "z-index": 100,
      };
    }
    return {};
  };

  /**
   * 获取偏移样式
   */
  const getOffsetStyle = (item) => {
    if (isDragging.value && itemOffsets.value[item.path[0]]) {
      return {
        transform: `translateY(${itemOffsets.value[item.path[0]]}px)`,
      };
    }
    return {};
  };

  return {
    isDragging,
    dragIndex,
    originalDragIndex,
    dragStartY,
    currentDragY,
    itemOffsets,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    cleanupDragListeners,
    getDragStyle,
    getOffsetStyle,
  };
};
