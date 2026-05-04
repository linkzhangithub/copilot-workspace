<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Input from './Input.vue'
import Icon from './Icon.vue'

const props = defineProps({
  projects: {
    type: Array,
    default: () => []
  },
  searchKeyword: {
    type: String,
    default: ''
  },
  selectedId: {
    type: [Number, null],
    default: null
  }
})

const emit = defineEmits([
  'project-click',
  'add-project',
  'update-project',
  'delete-project'
])

// 状态
const showNewProject = ref(false)
const showItemMenuId = ref(null)
const itemMenuPosition = ref({ x: 0, y: 0 })
const newProjectName = ref('')
const editingId = ref(null)
const editingName = ref('')
const menuRef = ref(null)

// 过滤文章列表
const filteredProjects = computed(() => {
  if (!props.searchKeyword.trim()) return props.projects
  const keyword = props.searchKeyword.toLowerCase()
  return props.projects.filter((p) => p.name.toLowerCase().includes(keyword))
})

// 重置所有编辑状态
const resetEditStates = () => {
  editingId.value = null
  showItemMenuId.value = null
  if (showNewProject.value) {
    showNewProject.value = false
    newProjectName.value = ''
  }
}

// 点击外部区域处理
const handleClickOutside = (event) => {
  if (menuRef.value && menuRef.value.contains(event.target)) {
    return
  }

  const newProjectBtn = event.target.closest('.new-project-btn')
  if (newProjectBtn && !showNewProject.value) {
    return
  }

  if (showNewProject.value) {
    const newProjectInput = event.target.closest('.new-project-input')
    if (newProjectInput) {
      return
    }
  }

  const menuBtn = event.target.closest('.item-menu-btn')
  if (menuBtn) {
    return
  }

  resetEditStates()
}

// Esc 键处理
const handleEscKey = (event) => {
  if (event.key === 'Escape') {
    resetEditStates()
  }
}

// 添加新文章
const addProject = () => {
  if (!newProjectName.value.trim()) {
    showNewProject.value = false
    return
  }
  emit('add-project', newProjectName.value.trim())
  newProjectName.value = ''
  showNewProject.value = false
}

const cancelNewProject = () => {
  showNewProject.value = false
  newProjectName.value = ''
}

const startNewProject = (e) => {
  e.stopPropagation()
  showNewProject.value = true
}

// 编辑文章
const startEdit = (project) => {
  editingId.value = project.id
  editingName.value = project.name
  showItemMenuId.value = null
}

const saveEdit = () => {
  const project = props.projects.find((p) => p.id === editingId.value)
  if (project && editingName.value.trim()) {
    emit('update-project', project.id, editingName.value.trim())
  }
  editingId.value = null
}

const cancelEdit = () => {
  editingId.value = null
}

// 删除文章
const deleteProject = (id, event) => {
  event.stopPropagation()
  if (confirm('确定要删除这篇文章吗？')) {
    emit('delete-project', id)
    showItemMenuId.value = null
  }
}

// 文章的三点菜单
const toggleItemMenu = (project, event) => {
  if (showItemMenuId.value === project.id) {
    showItemMenuId.value = null
  } else {
    showItemMenuId.value = project.id
    const rect = event.target.getBoundingClientRect()
    itemMenuPosition.value = {
      x: rect.right - 140,
      y: rect.bottom + 4
    }
  }
}

// 点击文章
const handleProjectClick = (project) => {
  if (showItemMenuId.value !== null || editingId.value !== null) {
    resetEditStates()
  }
  emit('project-click', project)
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscKey)
})
</script>

<template>
  <div class="project-list">
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
          <button class="action-btn confirm" @click="addProject">
            <Icon name="Check" :size="14" />
            创建
          </button>
          <button class="action-btn cancel" @click="cancelNewProject">
            <Icon name="X" :size="14" />
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

          <!-- 三点菜单按钮 -->
          <button
            class="item-menu-btn"
            @click.stop="toggleItemMenu(project, $event)"
          >
            <Icon name="MoreVertical" :size="16" />
          </button>
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
          top: `${itemMenuPosition.y}px`
        }"
      >
        <button
          class="menu-item"
          @click.stop="startEdit(projects.find(p => p.id === showItemMenuId))"
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
  justify-content: flex-end;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
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

/* 三点菜单按钮 */
.item-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background-color: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
  flex-shrink: 0;
  opacity: 0;
}

.project-item:hover .item-menu-btn,
.item-menu-btn:focus {
  opacity: 1;
}

.item-menu-btn:hover {
  background-color: var(--bg-input);
  color: var(--text-primary);
}

/* 菜单浮层 */
.item-menu-dropdown {
  position: fixed;
  min-width: 150px;
  background-color: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
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
</style>
