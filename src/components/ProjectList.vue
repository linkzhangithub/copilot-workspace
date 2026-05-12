<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import Input from "./Input.vue";
import Icon from "./Icon.vue";
import "../styles/project-list.css";

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

const showNewProject = ref(false);
const showItemMenuId = ref(null);
const itemMenuPosition = ref({ x: 0, y: 0 });
const newProjectName = ref("");
const editingId = ref(null);
const editingName = ref("");
const menuRef = ref(null);

const filteredProjects = computed(() => {
  if (!props.searchKeyword.trim()) return props.projects;
  const keyword = props.searchKeyword.toLowerCase();
  return props.projects.filter((p) => p.name.toLowerCase().includes(keyword));
});

const resetEditStates = () => {
  editingId.value = null;
  showItemMenuId.value = null;
  if (showNewProject.value) {
    showNewProject.value = false;
    newProjectName.value = "";
  }
};

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

const handleEscKey = (event) => {
  if (event.key === "Escape") {
    resetEditStates();
  }
};

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

const deleteProject = (id, event) => {
  event.stopPropagation();
  if (confirm("确定要删除这篇文章吗？")) {
    emit("delete-project", id);
    showItemMenuId.value = null;
  }
};

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
    <div class="new-project-section">
      <button
        v-if="!showNewProject"
        class="new-project-btn"
        @click="startNewProject"
      >
        <Icon name="Plus" :size="18" />
        <span>新建文章</span>
      </button>

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

    <div class="divider"></div>

    <div class="projects">
      <div
        v-for="project in filteredProjects"
        :key="project.id"
        :class="['project-item', { selected: selectedId === project.id }]"
        @click="handleProjectClick(project)"
      >
        <div v-if="editingId === project.id" class="edit-mode" @click.stop>
          <Input
            v-model="editingName"
            @keyup.enter="saveEdit"
            @keyup.esc="cancelEdit"
            autofocus
          />
        </div>

        <template v-else>
          <div class="item-icon">
            <Icon name="FileText" :size="18" />
          </div>

          <div class="item-content">
            <span class="item-title">{{ project.name }}</span>
          </div>

          <div class="item-actions" @click.stop>
            <div class="item-menu-btn" @click="toggleItemMenu(project, $event)">
              <Icon name="MoreVertical" :size="18" />
            </div>
          </div>
        </template>
      </div>
    </div>

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
</style>
