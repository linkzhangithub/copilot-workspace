<script setup>
import { ref, onMounted, computed } from "vue";
import ProjectList from "./components/ProjectList.vue";
import ProjectSearch from "./components/ProjectSearch.vue";
import Editor from "./components/Editor.vue";
import { useTheme } from "./composables/useTheme";

const { currentTheme, toggleTheme } = useTheme();

// 状态
const projects = ref([]);
const selectedProject = ref(null);
const searchKeyword = ref("");
const sidebarOpen = ref(true);
const editorRef = ref(null);

// 本地存储
const STORAGE_KEY = "vue-projects";

// 加载项目
const loadProjects = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      projects.value = JSON.parse(saved);
    } else {
      // 默认数据
      projects.value = [
        { id: 1, name: "AI 写作助手", createdAt: new Date().toISOString() },
        { id: 2, name: "任务管理系统", createdAt: new Date().toISOString() },
        { id: 3, name: "数据分析仪表盘", createdAt: new Date().toISOString() },
      ];
      saveProjects();
    }
  } catch (e) {
    console.error("加载项目失败:", e);
  }
};

const saveProjects = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.value));
  } catch (e) {
    console.error("保存项目失败:", e);
  }
};

const handleProjectClick = (project) => {
  selectedProject.value = project;
  
  // 在移动端时，点击项目后自动关闭侧边栏
  if (window.innerWidth < 768) {
    sidebarOpen.value = false;
  }
};

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

const handleLogoClick = () => {
  selectedProject.value = null;
};

const handleAddProject = (name) => {
  const newProject = {
    id: Date.now(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  projects.value.unshift(newProject);
  saveProjects();
  selectedProject.value = newProject;
};

const handleUpdateProject = (id, name) => {
  const project = projects.value.find((p) => p.id === id);
  if (project) {
    project.name = name.trim();
    saveProjects();
    // 如果更新的是当前选中的项目，也要更新引用
    if (selectedProject.value && selectedProject.value.id === id) {
      selectedProject.value.name = name.trim();
    }
  }
};

const handleDeleteProject = (id) => {
  projects.value = projects.value.filter((p) => p.id !== id);
  saveProjects();
  if (selectedProject.value && selectedProject.value.id === id) {
    selectedProject.value = null;
  }
};

// 检测屏幕尺寸
onMounted(() => {
  loadProjects();
  const checkScreen = () => {
    if (window.innerWidth < 768) {
      sidebarOpen.value = false;
    } else {
      sidebarOpen.value = true;
    }
  };

  checkScreen();
  window.addEventListener("resize", checkScreen);
});
</script>

<template>
  <div class="app">
    <!-- 侧边栏 -->
    <aside
      :class="[
        'sidebar',
        { open: sidebarOpen, 'light-mode': currentTheme === 'light' },
      ]"
    >
      <div class="sidebar-header">
        <button class="logo" @click="handleLogoClick">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
          </svg>
          <span class="logo-text">AI 写作助手</span>
        </button>
      </div>

      <div class="sidebar-content">
        <ProjectSearch v-model="searchKeyword" />
        <div class="list-wrapper">
          <ProjectList
            :projects="projects"
            :search-keyword="searchKeyword"
            :selected-id="selectedProject?.id"
            @project-click="handleProjectClick"
            @add-project="handleAddProject"
            @update-project="handleUpdateProject"
            @delete-project="handleDeleteProject"
          />
        </div>
      </div>
    </aside>

    <!-- 移动端遮罩 -->
    <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false"></div>

    <!-- 主内容区 -->
    <main class="main">
      <!-- 顶部栏 -->
      <header :class="['topbar', { 'light-mode': currentTheme === 'light' }]">
        <button class="toggle-btn" @click="toggleSidebar">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div class="breadcrumb">
          <!-- 显示完整logo+文字 -->
          <div v-if="!selectedProject" class="breadcrumb-logo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
            <span>AI 写作助手</span>
          </div>
          <!-- 只显示项目名 -->
          <span v-else>{{ selectedProject.name }}</span>
        </div>

        <div class="topbar-actions">
          <button class="theme-toggle" @click="toggleTheme">
            <svg
              v-if="currentTheme === 'dark'"
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <div v-if="selectedProject">
            <button
              ref="exportBtn"
              :class="[
                'export-btn',
                {
                  'light-mode': currentTheme === 'light',
                  disabled: !editorRef?.canExport,
                },
              ]"
              :disabled="!editorRef?.canExport"
              @click="editorRef?.exportMarkdown"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>导出 Markdown</span>
            </button>
          </div>
        </div>
      </header>

      <!-- 编辑器区域 -->
      <div class="editor-area">
        <Editor
          v-if="selectedProject"
          ref="editorRef"
          :key="selectedProject.id"
          :project="selectedProject"
          @update-project="handleUpdateProject"
        />
        <div v-else class="empty-state">
          <div class="empty-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              ></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h2 class="empty-title">开始创作</h2>
          <p class="empty-desc">
            选择左侧文章或创建新文章，AI 将帮助你生成专业文章
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 侧边栏 */
.sidebar {
  width: 240px;
  background-color: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar.light-mode {
  border-right: 1px solid #e5e7eb;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -280px;
    top: 0;
    bottom: 0;
    z-index: 200;
    transition: left 0.2s ease;
  }

  .sidebar.open {
    left: 0;
  }
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: 16px;
  font-weight: 600;
  transition: opacity 0.15s ease;
}

.logo:hover {
  opacity: 0.8;
}

.logo svg {
  color: var(--primary);
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
}

.sidebar-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  flex: 1;
}

.list-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 移动端遮罩 */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
}

@media (min-width: 769px) {
  .overlay {
    display: none;
  }
}

/* 主内容区 */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部栏 */
.topbar {
  height: 48px;
  background-color: var(--bg-sidebar);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  flex-shrink: 0;
}

.topbar.light-mode {
  border-bottom: 1px solid #e5e7eb;
}

.toggle-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.toggle-btn:hover {
  background-color: var(--bg-hover);
}

@media (max-width: 768px) {
  .toggle-btn {
    display: flex;
  }
}

.breadcrumb {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
}

.breadcrumb-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breadcrumb-logo svg {
  color: var(--primary);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.theme-toggle:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.export-btn.light-mode {
  background-color: #f3f4f6;
  border-color: #e5e7eb;
  color: #4b5563;
}

.export-btn.light-mode:hover {
  background-color: #e5e7eb;
}

.export-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--text-muted);
  color: var(--text-primary);
}

.export-btn:disabled,
.export-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 编辑器区域 */
.editor-area {
  flex: 1;
  overflow: hidden;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
  box-sizing: border-box;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  color: var(--primary);
  margin-bottom: 8px;
}

.empty-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.empty-desc {
  font-size: 15px;
  color: var(--text-muted);
  margin: 0;
}

/* ===== 响应式设计 - 移动端适配 ===== */
@media (max-width: 768px) {
  /* 侧边栏 */
  .sidebar {
    width: 280px;
  }

  .sidebar-header {
    padding: 14px;
  }

  .logo-text {
    font-size: 15px;
  }

  .sidebar-content {
    padding: 10px;
  }

  /* 顶部栏 */
  .topbar {
    padding: 0 12px;
    gap: 10px;
  }

  .breadcrumb {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .breadcrumb span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .breadcrumb-logo span {
    display: none;
  }

  .export-btn svg {
    display: none;
  }

  .export-btn {
    padding: 8px 10px;
  }

  .theme-toggle {
    width: 34px;
    height: 34px;
  }

  /* 空状态 */
  .empty-state {
    padding: 32px 20px;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
  }

  .empty-title {
    font-size: 20px;
  }

  .empty-desc {
    font-size: 14px;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .sidebar {
    width: 100%;
    max-width: 300px;
    left: -300px;
  }

  .sidebar.open {
    left: 0;
  }

  .topbar {
    height: 52px;
    padding: 0 10px;
    gap: 8px;
  }

  .toggle-btn {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .breadcrumb {
    font-size: 13px;
  }

  .topbar-actions {
    gap: 6px;
    flex-shrink: 0;
  }

  .empty-state {
    padding: 24px 16px;
  }

  .empty-icon {
    width: 56px;
    height: 56px;
  }

  .empty-title {
    font-size: 18px;
  }

  .empty-desc {
    font-size: 13px;
  }
}
</style>
