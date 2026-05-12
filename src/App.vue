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
  selectedProject.value = project;
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
  </div>
</template>
