<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import Input from "./Input.vue";
import Icon from "./Icon.vue";

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

// 移动端检测
const isMobile = ref(false);

const checkIsMobile = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isMobileUserAgent =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent,
    );
  isMobile.value = isTouchDevice && isMobileUserAgent;
};

// 状态
const showNewProject = ref(false);
const showItemMenuId = ref(null);
const itemMenuPosition = ref({ x: 0, y: 0 });
const newProjectName = ref("");
const editingId = ref(null);
const editingName = ref("");
const menuRef = ref(null);

// 过滤文章列表
const filteredProjects = computed(() => {
  if (!props.searchKeyword.trim()) return props.projects;
  const keyword = props.searchKeyword.toLowerCase();
  return props.projects.filter((p) => p.name.toLowerCase().includes(keyword));
});

// 重置所有编辑状态
const resetEditStates = () => {
  editingId.value = null;
  showItemMenuId.value = null;
  if (showNewProject.value) {
    showNewProject.value = false;
    newProjectName.value = "";
  }
};

// 点击外部区域处理
const handleClickOutside = (event) => {
  if (menuRef.value && menuRef.value.contains(event.target)) {
    return;
  }

  const newProjectBtn = event.target.closest(".new-project-btn");
  if (newProjectBtn && !showNewProject.value) {
    return;
  }

  if (showNewProject.value) {
    const newProjectInput = event.target.closest(".new-project-input");
    if (newProjectInput) {
      return;
    }
  }

  const menuBtn = event.target.closest(".item-menu-btn");
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

// 添加新文章
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

// 编辑文章
const startEdit = (project) => {
  editingId.value = project.id;
  editingName.value = project.name;
  showItemMenuId.value = null;
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

// 删除文章
const deleteProject = (id, event) => {
  event.stopPropagation();
  if (confirm("确定要删除这篇文章吗？")) {
    emit("delete-project", id);
    showItemMenuId.value = null;
  }
};

// 文章的三点菜单
const toggleItemMenu = (project, event) => {
  if (showItemMenuId.value === project.id) {
    showItemMenuId.value = null;
  } else {
    showItemMenuId.value = project.id;
    const rect = event.target.getBoundingClientRect();
    itemMenuPosition.value = {
      x: rect.right - 140,
      y: rect.bottom + 4,
    };
  }
};

// 点击文章
const handleProjectClick = (project) => {
  if (showItemMenuId.value !== null || editingId.value !== null) {
    resetEditStates();
  }
  emit("project-click", project);
};

onMounted(() => {
  checkIsMobile();
  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleEscKey);
  window.addEventListener("resize", checkIsMobile);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleEscKey);
  window.removeEventListener("resize", checkIsMobile);
});
</script>

<template>
  <div class="project-list" :class="{ 'is-mobile': isMobile }">
    <!-- 新建文章区域 -->
    <div class="new-project-section">
      <button
        v-if="!showNewProject"
        class="new-project-btn"
        @click="startNewProject"
      >
        <Icon name="Plus" :size="18" />
        <span>新建文章</span>
      </button>

      <!-- 新建文章输入框 -->
      <div v-else class="new-project-input">
        <Input
          v-model="newProjectName"
          placeholder="输入文章标题..."
          @keyup.enter="addProject"
          @keyup.esc="cancelNewProject"
          autofocus
        />
        <div class="new-project-actions">
          <button class="action-btn confirm" @click="addProject">创建</button>
          <button class="action-btn cancel" @click="cancelNewProject">
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 分隔线 -->
    <div class="divider"></div>

    <!-- 文章列表 -->
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
            autofocus
          />
        </div>

        <!-- 显示模式 -->
        <template v-else>
          <!-- 文章图标 -->
          <div class="item-icon">
            <Icon name="FileText" :size="18" />
          </div>

          <!-- 文章名称 -->
          <div class="item-content">
            <span class="item-title">{{ project.name }}</span>
          </div>

          <!-- 三点菜单按钮容器 -->
          <div class="item-actions" @click.stop>
            <div class="item-menu-btn" @click="toggleItemMenu(project, $event)">
              <Icon name="MoreVertical" :size="18" />
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 菜单浮层 - 独立渲染 -->
    <Transition name="menu-fade">
      <div
        v-if="showItemMenuId !== null"
        ref="menuRef"
        class="item-menu-dropdown"
        :style="{
          left: `${itemMenuPosition.x}px`,
          top: `${itemMenuPosition.y}px`,
        }"
      >
        <button
          class="menu-item"
          @click.stop="startEdit(projects.find((p) => p.id === showItemMenuId))"
        >
          <Icon name="Pencil" :size="16" />
          <span>重命名</span>
        </button>
        <button
          class="menu-item danger"
          @click.stop="deleteProject(showItemMenuId, $event)"
        >
          <Icon name="Trash2" :size="16" />
          <span>删除</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.project-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 新建文章区域 */
.new-project-section {
  padding: 0 8px 12px;
}

.new-project-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: 1.5px dashed var(--border);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.new-project-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background-color: var(--primary);
  background-color: rgba(14, 165, 233, 0.1);
}

.new-project-input {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--bg-input);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.new-project-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
  text-align: center;
}

.action-btn.confirm {
  background-color: var(--primary);
  color: white;
}

.action-btn.confirm:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.action-btn.cancel {
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.action-btn.cancel:hover {
  background-color: var(--bg-hover);
}

/* 分隔线 */
.divider {
  height: 1px;
  background: var(--border);
  margin: 0 8px 12px;
}

/* 文章列表 */
.projects {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 4px;
  overflow-y: auto;
  flex: 1;
}

.project-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.project-item:hover {
  background-color: var(--bg-hover);
}

.project-item.selected {
  background: linear-gradient(
    135deg,
    rgba(14, 165, 233, 0.15) 0%,
    rgba(14, 165, 233, 0.08) 100%
  );
  border-left: 3px solid var(--primary);
}

/* 文章图标 */
.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.project-item.selected .item-icon {
  background: rgba(14, 165, 233, 0.2);
  color: var(--primary);
}

/* 文章内容 */
.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.project-item:hover .item-title,
.project-item.selected .item-title {
  color: var(--text-primary);
}

/* 三点菜单按钮容器 */
.item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

/* PC端hover显示 */
.project-item:hover .item-actions {
  opacity: 1;
}

/* 三点菜单按钮 - 完全照搬章节区域的action-btn样式 */
.item-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 6px;
  flex-shrink: 0;
}

.item-menu-btn:hover {
  color: var(--text-primary);
  background: var(--bg-input);
}

/* 移动端常显 */
.project-list.is-mobile .item-actions {
  opacity: 1;
}

/* 菜单浮层 */
.item-menu-dropdown {
  position: fixed;
  min-width: 150px;
  background-color: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.15),
    0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 9999;
  padding: 6px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.menu-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.menu-item.danger {
  color: var(--danger);
}

.menu-item.danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

/* 编辑模式 */
.edit-mode {
  flex: 1;
}

/* ===== 响应式设计 - 移动端适配 ===== */
@media (max-width: 768px) {
  .new-project-section {
    padding: 0 6px 10px;
  }

  .new-project-btn {
    padding: 10px 12px;
    font-size: 13px;
    gap: 8px;
  }

  .new-project-btn svg {
    width: 16px;
    height: 16px;
  }

  .divider {
    margin: 10px 6px;
  }

  .projects {
    gap: 4px;
  }

  .project-item {
    padding: 10px 10px;
    gap: 10px;
  }

  .item-icon {
    width: 30px;
    height: 30px;
  }

  .item-icon svg {
    width: 16px;
    height: 16px;
  }

  .item-title {
    font-size: 13px;
  }

  /* 小屏幕下常显 */
  .item-actions {
    opacity: 1 !important;
  }

  .item-menu-btn {
    width: 36px;
    height: 36px;
  }

  .item-menu-btn svg {
    width: 20px;
    height: 20px;
  }

  .item-menu-dropdown {
    min-width: 140px;
    padding: 4px;
    border-radius: 10px;
  }

  .menu-item {
    padding: 9px 10px;
    font-size: 13px;
    gap: 8px;
  }

  .menu-item svg {
    width: 14px;
    height: 14px;
  }
}

@media (max-width: 480px) {
  .new-project-section {
    padding: 0 4px 8px;
  }

  .new-project-btn {
    padding: 9px 10px;
    font-size: 12px;
  }

  .divider {
    margin: 8px 4px;
  }

  .projects {
    gap: 3px;
  }

  .project-item {
    padding: 9px 8px;
    gap: 8px;
  }

  .item-icon {
    width: 28px;
    height: 28px;
  }

  .item-title {
    font-size: 12px;
  }

  /* 小屏幕下常显 */
  .item-actions {
    opacity: 1 !important;
  }

  .item-menu-btn {
    width: 26px;
    height: 26px;
  }

  .item-menu-btn svg {
    width: 13px;
    height: 13px;
  }

  .item-menu-dropdown {
    min-width: 130px;
  }

  .menu-item {
    padding: 8px 9px;
    font-size: 12px;
    gap: 7px;
  }
}
</style>
