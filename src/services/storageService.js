/**
 * 存储服务 - 统一管理 localStorage 操作
 */

const STORAGE_KEYS = {
  PROJECTS: "ai-copilot-projects",
  QUALITY_CHECK: "quality-check",
};

/**
 * 保存项目列表
 * @param {Array} projects - 项目列表
 */
export const saveProjects = (projects) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  } catch (e) {
    console.error("保存项目列表失败:", e);
  }
};

/**
 * 加载项目列表
 * @returns {Array} - 项目列表
 */
export const loadProjects = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("加载项目列表失败:", e);
    return [];
  }
};

/**
 * 保存质检记录
 * @param {string} projectId - 项目 ID
 * @param {Object} data - 质检数据
 */
export const saveQualityCheck = (projectId, data) => {
  try {
    const key = `${STORAGE_KEYS.QUALITY_CHECK}-${projectId}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("保存质检记录失败:", e);
  }
};

/**
 * 加载质检记录
 * @param {string} projectId - 项目 ID
 * @returns {Object|null} - 质检数据
 */
export const loadQualityCheck = (projectId) => {
  try {
    const key = `${STORAGE_KEYS.QUALITY_CHECK}-${projectId}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error("加载质检记录失败:", e);
    return null;
  }
};

/**
 * 删除质检记录
 * @param {string} projectId - 项目 ID
 */
export const deleteQualityCheck = (projectId) => {
  try {
    const key = `${STORAGE_KEYS.QUALITY_CHECK}-${projectId}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.error("删除质检记录失败:", e);
  }
};

/**
 * 清空所有存储
 */
export const clearAllStorage = () => {
  try {
    localStorage.clear();
  } catch (e) {
    console.error("清空存储失败:", e);
  }
};
