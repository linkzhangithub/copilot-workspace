<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import Input from "./Input.vue";
import Icon from "./Icon.vue";
import {
  Plus,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  FolderOpen,
} from "lucide-vue-next";

const props = defineProps({
  projects: {
    type: Array,
    default: () => [],
  },
  searchKeyword: {
    type: String,
    default: "",
  },
  selectedId: {
    type: [Number, null],
    default: null,
  },
});

const emit = defineEmits([
  "project-click",
  "add-project",
  "update-project",
  "delete-project",
]);

// 状态
const showNewProject = ref(false);
const showMenu = ref(false);
const newProjectName = ref("");
const editingId = ref(null);
const editingName = ref("");
const showMenuId = ref(null);
const currentMenuProject = ref(null);
const menuPosition = ref({ x: 0, y: 0 });
const menuRef = ref(null);

const filteredProjects = computed(() => {
  if (!props.searchKeyword.trim()) return props.projects;
  const keyword = props.searchKeyword.toLowerCase();
  return props.projects.filter((p) => p.name.toLowerCase().includes(keyword));
});

// 重置所有编辑状态
const resetEditStates = () => {
  editingId.value = null;
  showMenuId.value = null;
  currentMenuProject.value = null;
  if (showNewProject.value) {
    showNewProject.value = false;
    newProjectName.value = "";
  }
};

// 点击外部区域处理
const handleClickOutside = (event) => {
  // 检查是否点击在菜单区域
  if (menuRef.value && menuRef.value.contains(event.target)) {
    return;
  }

  // 检查是否点击在新建项目按钮上
  const newProjectBtn = event.target.closest(".new-project-btn");
  if (newProjectBtn && !showNewProject.value) {
    return;
  }

  // 检查是否点击在新建项目输入框上
  if (showNewProject.value) {
    const newProjectInput = event.target.closest(".new-project-input");
    if (newProjectInput) {
      return;
    }
  }

  // 检查是否点击在更多按钮上
  const menuBtn = event.target.closest(".menu-btn");
  if (menuBtn) {
    return;
  }

  resetEditStates();
};

// Esc 键处理
const handleEscKey = (event) => {
  if (event.key === "Escape") {
    resetEditStates();
  }
};

// 添加新项目
const addProject = () => {
  if (!newProjectName.value.trim()) {
    showNewProject.value = false;
    return;
  }
  emit("add-project", newProjectName.value.trim());
  newProjectName.value = "";
  showNewProject.value = false;
};

const cancelNewProject = () => {
  showNewProject.value = false;
  newProjectName.value = "";
};

const startNewProject = (e) => {
  e.stopPropagation();
  showNewProject.value = true;
};

// 编辑项目
const startEdit = (project) => {
  editingId.value = project.id;
  editingName.value = project.name;
  showMenuId.value = null;
};

const saveEdit = () => {
  const project = props.projects.find((p) => p.id === editingId.value);
  if (project && editingName.value.trim()) {
    emit("update-project", project.id, editingName.value.trim());
  }
  editingId.value = null;
};

const cancelEdit = () => {
  editingId.value = null;
};

// 删除项目
const deleteProject = (id, event) => {
  event.stopPropagation();
  if (confirm("确定要删除这个项目吗？")) {
    emit("delete-project", id);
    showMenuId.value = null;
  }
};

// 显示菜单
const toggleMenu = (project, event) => {
  event.stopPropagation();
  if (showMenuId.value === project.id) {
    showMenuId.value = null;
    currentMenuProject.value = null;
  } else {
    showMenuId.value = project.id;
    currentMenuProject.value = project;
    editingId.value = null;
    // 计算菜单位置
    const rect = event.target.getBoundingClientRect();
    menuPosition.value = {
      x: rect.left,
      y: rect.bottom + 4,
    };
  }
};

// 点击项目
const handleProjectClick = (project) => {
  if (showMenuId.value !== null || editingId.value !== null) {
    resetEditStates();
  }
  emit("project-click", project);
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleEscKey);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleEscKey);
});
</script>

<template>
  <div class="project-list">
    <!-- 标题区域 -->
    <div class="section-header">
      <h3 class="section-title">
        <Icon name="FolderOpen" :size="16" />
        <span>我的项目</span>
      </h3>
      <button class="menu-trigger" @click="showMenu = !showMenu">
        <Icon name="MoreVertical" :size="16" />
      </button>
      <!-- 菜单浮窗 -->
      <Transition name="menu-fade">
        <div v-if="showMenu" class="menu-dropdown">
          <button class="menu-item" @click="startEditAll">
            <Icon name="Pencil" :size="14" />
            <span>重命名</span>
          </button>
          <button class="menu-item delete" @click="deleteAllProjects">
            <Icon name="Trash2" :size="14" />
            <span>删除</span>
          </button>
        </div>
      </Transition>
    </div>

    <!-- 新建项目按钮 -->
    <div class="new-project-section">
      <div v-if="!showNewProject">
        <button class="new-project-btn" @click="startNewProject">
          <Icon name="Plus" :size="16" />
          <span>新建项目</span>
        </button>
      </div>

      <!-- 新建项目输入框 -->
      <div v-else class="new-project-input">
        <div class="new-project-form">
          <Input
            v-model="newProjectName"
            placeholder="项目名称"
            @keyup.enter="addProject"
            @keyup.esc="cancelNewProject"
          />
          <div class="new-project-actions">
            <button class="action-btn confirm" @click="addProject">确认</button>
            <button class="action-btn cancel" @click="cancelNewProject">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 项目列表 -->
    <div class="projects">
      <div
        v-for="project in filteredProjects"
        :key="project.id"
        :class="['project-item', { selected: selectedId === project.id }]"
        @click="handleProjectClick(project)"
      >
        <!-- 编辑模式 -->
        <div v-if="editingId === project.id" class="edit-mode" @click.stop>
          <Input
            v-model="editingName"
            @keyup.enter="saveEdit"
            @keyup.esc="cancelEdit"
          />
        </div>

        <!-- 显示模式 -->
        <template v-else>
          <!-- 文档图标 -->
          <Icon name="FileText" :size="16" class="doc-icon" />

          <span class="project-name">{{ project.name }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: all 0.2s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-header {
  padding: 8px 4px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.menu-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background-color: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.menu-trigger:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 120px;
  background-color: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 100;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.menu-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.menu-item.delete:hover {
  color: #ef4444;
  background-color: #fef2f2;
}

:deep(.dark) .menu-item.delete:hover {
  background-color: #450a0a;
}

.new-project-section {
  padding: 0 4px 12px;
}

.new-project-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px dashed var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
  width: 100%;
}

.new-project-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  border-style: solid;
  background-color: var(--bg-hover);
}

.new-project-input {
  padding: 8px 0;
}

.new-project-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(
    135deg,
    var(--bg-hover) 0%,
    var(--bg-primary) 100%
  );
  border: 2px solid var(--border);
  border-radius: 12px;
}

.new-project-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.new-project-actions .action-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.new-project-actions .action-btn.confirm {
  background-color: var(--primary);
  color: white;
}

.new-project-actions .action-btn.confirm:hover {
  background-color: var(--primary);
  filter: brightness(1.1);
}

.new-project-actions .action-btn.cancel {
  background-color: var(--bg-input);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.new-project-actions .action-btn.cancel:hover {
  background-color: var(--bg-hover);
}

.projects {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
  overflow-y: auto;
  flex: 1;
}

.project-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-left: 2px solid transparent;
}

.project-item:hover {
  background-color: var(--bg-hover);
}

.project-item.selected {
  background-color: var(--selected-bg);
  border-left-color: var(--primary);
}

.project-item.selected .doc-icon {
  color: var(--primary);
}

.project-item.selected .project-name {
  color: var(--text-primary);
  font-weight: 500;
}

.doc-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.project-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-btn:hover {
  background-color: var(--bg-input);
  color: var(--text-secondary);
}

.menu-dropdown {
  position: absolute;
  min-width: 140px;
  background-color: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.menu-item.delete {
  color: var(--danger);
}

.menu-item.delete:hover {
  background-color: rgba(239, 68, 68, 0.1);
}
</style>
