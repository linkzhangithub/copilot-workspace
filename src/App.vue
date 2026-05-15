<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import ProjectList from "./components/ProjectList.vue";
import ProjectSearch from "./components/ProjectSearch.vue";
import Editor from "./components/Editor.vue";
import ToastContainer from "./components/ToastContainer.vue";
import Icon from "./components/Icon.vue";
import { useTheme } from "./composables/useTheme";
import "./styles/app.css";

const { currentTheme, toggleTheme } = useTheme();

const toastRef = ref(null);
const showSwitchConfirm = ref(false);
const pendingProject = ref(null);

const showToast = (message, type = "info", duration = 3000) => {
  if (toastRef.value) {
    toastRef.value.show(message, type, duration);
  }
};

const projects = ref([]);
const selectedProject = ref(null);
const searchKeyword = ref("");
const sidebarOpen = ref(true);
const editorRef = ref(null);

const STORAGE_KEY = "vue-projects";

const loadProjects = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      projects.value = JSON.parse(saved);
    } else {
      projects.value = [
        { id: 1, name: "AI 写作助手", createdAt: new Date().toISOString() },
        { id: 2, name: "AI 剧本创作助手", createdAt: new Date().toISOString() },
        { id: 3, name: "AI 故事工坊", createdAt: new Date().toISOString() },
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
  // 检查是否正在生成内容
  const editor = editorRef.value;
  const isGenerating = editor?.getIsGenerating?.();

  console.log("handleProjectClick:", {
    hasEditor: !!editor,
    hasGetIsGenerating: typeof editor?.getIsGenerating,
    isGenerating,
    project: project.name,
  });

  if (isGenerating) {
    // 正在生成，先中断并清理状态，显示提示
    if (editor?.cleanupGeneratingState) {
      editor.cleanupGeneratingState();
      showToast("已中断生成", "warning", 2000);
    }

    // 然后显示确认弹窗
    pendingProject.value = project;
    showSwitchConfirm.value = true;
  } else {
    // 没有正在生成，直接切换
    selectedProject.value = project;
    if (window.innerWidth < 768) {
      sidebarOpen.value = false;
    }
  }
};

// 确认切换项目
const confirmSwitchProject = () => {
  // 切换到新项目
  selectedProject.value = pendingProject.value;
  pendingProject.value = null;
  showSwitchConfirm.value = false;

  if (window.innerWidth < 768) {
    sidebarOpen.value = false;
  }
};

// 取消切换项目
const cancelSwitchProject = () => {
  pendingProject.value = null;
  showSwitchConfirm.value = false;
  // 不需要额外操作，状态已经在handleProjectClick时清理了
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

const checkScreen = () => {
  if (window.innerWidth < 768) {
    sidebarOpen.value = false;
  } else {
    sidebarOpen.value = true;
  }
};

onMounted(() => {
  loadProjects();
  checkScreen();
  window.addEventListener("resize", checkScreen);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkScreen);
});
</script>

<template>
  <div class="app">
    <aside
      :class="[
        'sidebar',
        { open: sidebarOpen, 'light-mode': currentTheme === 'light' },
      ]"
    >
      <div class="sidebar-header">
        <button class="logo" @click="handleLogoClick">
          <Icon name="PenTool" :size="24" />
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

    <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false"></div>

    <main class="main">
      <header :class="['topbar', { 'light-mode': currentTheme === 'light' }]">
        <button class="toggle-btn" @click="toggleSidebar">
          <Icon name="Menu" :size="20" />
        </button>

        <div class="breadcrumb">
          <div v-if="!selectedProject" class="breadcrumb-logo">
            <Icon name="PenTool" :size="20" />
            <span>AI 写作助手</span>
          </div>
          <template v-else>
            <Icon name="PenTool" :size="20" />
            <span>{{ selectedProject.name }}</span>
          </template>
        </div>

        <div class="topbar-actions">
          <button
            class="theme-toggle"
            @click="toggleTheme"
            :title="
              currentTheme === 'dark' ? '切换到浅色模式' : '切换到深色模式'
            "
          >
            <Icon v-if="currentTheme === 'dark'" name="Sun" :size="18" />
            <Icon v-else name="Moon" :size="18" />
          </button>

          <button
            v-if="selectedProject"
            class="export-btn"
            :class="{ 'light-mode': currentTheme === 'light' }"
            @click="editorRef?.exportMarkdown()"
          >
            <Icon name="Download" :size="16" />
            <span>导出</span>
          </button>
        </div>
      </header>

      <div class="editor-area">
        <Editor
          v-if="selectedProject"
          ref="editorRef"
          :project="selectedProject"
          @update-project="handleUpdateProject"
          @show-toast="showToast"
        />
        <div v-else class="empty-state">
          <div class="empty-icon">
            <Icon name="FileText" :size="40" />
          </div>
          <h2 class="empty-title">选择或创建一个项目</h2>
          <p class="empty-desc">从左侧列表选择一个项目开始写作，或创建新项目</p>
        </div>
      </div>
    </main>

    <ToastContainer ref="toastRef" />

    <!-- 切换项目确认弹窗 -->
    <Transition name="modal-fade">
      <div
        v-if="showSwitchConfirm"
        class="modal-overlay"
        @click="cancelSwitchProject"
      >
        <div
          :class="['modal-content', { 'light-mode': currentTheme === 'light' }]"
          @click.stop
        >
          <div class="modal-header">
            <Icon name="AlertCircle" :size="24" />
            <h3>已中断生成</h3>
          </div>
          <div class="modal-body">
            <p>生成内容已中断，当前文章状态已重置。</p>
            <p class="modal-hint">确定要切换项目吗？</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-cancel" @click="cancelSwitchProject">
              取消
            </button>
            <button class="btn btn-confirm" @click="confirmSwitchProject">
              确认切换
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
