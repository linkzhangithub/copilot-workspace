import { ref, nextTick } from "vue";

/**
 * 标题编辑相关逻辑的 Composable
 * @param {Object} options - 配置选项
 * @param {Function} options.emit - Vue emit 函数
 * @param {Function} options.getProjectId - 获取项目 ID 的函数
 * @param {Function} options.getProjectName - 获取项目名称的函数
 * @returns {Object} - 标题编辑相关的状态和方法
 */
export const useTitleEdit = (options) => {
  const { emit, getProjectId, getProjectName } = options;

  // 状态
  const isEditingTitle = ref(false);
  const editingTitle = ref("");
  const editTitleWrapper = ref(null);
  const titleInput = ref(null);

  /**
   * 开始编辑标题
   * @param {Event} e - 点击事件
   */
  const startEditTitle = (e) => {
    e.stopPropagation();
    if (isEditingTitle.value) return;
    isEditingTitle.value = true;
    editingTitle.value = getProjectName();
    nextTick(() => {
      if (titleInput.value) {
        titleInput.value.focus();
        titleInput.value.select();
      }
    });
  };

  /**
   * 保存编辑的标题
   */
  const saveEditTitle = () => {
    if (editingTitle.value.trim()) {
      emit("update-project", getProjectId(), editingTitle.value.trim());
    }
    isEditingTitle.value = false;
  };

  /**
   * 取消编辑标题
   */
  const cancelEditTitle = () => {
    isEditingTitle.value = false;
  };

  /**
   * 处理全局点击，在编辑区域外点击时取消编辑
   * @param {Event} e - 点击事件
   */
  const handleGlobalClick = (e) => {
    if (isEditingTitle.value && editTitleWrapper.value) {
      if (!editTitleWrapper.value.contains(e.target)) {
        cancelEditTitle();
      }
    }
  };

  return {
    // 状态
    isEditingTitle,
    editingTitle,
    editTitleWrapper,
    titleInput,

    // 方法
    startEditTitle,
    saveEditTitle,
    cancelEditTitle,
    handleGlobalClick,
  };
};
