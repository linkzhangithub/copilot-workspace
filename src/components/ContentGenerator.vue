<script setup>
import { ref } from "vue";
import Icon from "./Icon.vue";
import { Play, Loader, Wand2, ZoomIn, ZoomOut, RotateCcw, FileText } from "lucide-vue-next";

const props = defineProps({
  outline: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["update:outline"]);

const generatingIndex = ref(null);
const operatingIndex = ref(null);
const currentOperation = ref("");

// 存储每个 textarea 的高度
const textareaHeights = ref({});

// 清理标题中的 markdown 标记
const cleanTitle = (title) => {
  if (!title) return title;
  return title.replace(/^#+\s*/, "").trim();
};

// 获取操作描述
const getOperationDesc = (op) => {
  const map = {
    polish: "润色中",
    expand: "扩写中",
    shorten: "缩写中",
    regenerate: "重新生成中"
  };
  return map[op] || "处理中";
};

// 生成章节内容（接入真实 API）
const generateSection = async (index) => {
  if (generatingIndex.value !== null) return;
  if (operatingIndex.value !== null) return;

  generatingIndex.value = index;

  try {
    const response = await fetch("/api/ai/generate-content-simple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        outline: props.outline, 
        sectionIndex: index 
      }),
    });

    const result = await response.json();

    let content;
    if (result.success) {
      content = result.data;
    } else {
      content = `${cleanTitle(props.outline[index].title)}\n\n这是一段示例内容，用于演示编辑和生成功能。`;
    }
    
    const newOutline = [...props.outline];
    newOutline[index] = { ...newOutline[index], content };
    emit("update:outline", newOutline);
  } catch (err) {
    console.error("生成失败:", err);
    const mockContent = `${cleanTitle(props.outline[index].title)}\n\n这是一段示例内容，用于演示编辑和生成功能。`;
    
    const newOutline = [...props.outline];
    newOutline[index] = { ...newOutline[index], content: mockContent };
    emit("update:outline", newOutline);
  } finally {
    generatingIndex.value = null;
  }
};

// 改写内容（接入真实 API）
const rewriteSection = async (index, operation) => {
  const section = props.outline[index];
  if (!section.content) return;
  if (generatingIndex.value !== null) return;
  if (operatingIndex.value !== null) return;

  operatingIndex.value = index;
  currentOperation.value = operation;

  try {
    const response = await fetch("/api/ai/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        content: section.content, 
        operation 
      }),
    });

    const result = await response.json();

    let newContent = section.content;
    if (result.success) {
      newContent = result.data;
    } else {
      if (operation === "polish") {
        newContent = section.content + "\n\n（已润色）";
      } else if (operation === "expand") {
        newContent = section.content + "\n\n（已扩写）这段是新增的扩展内容。";
      } else if (operation === "shorten") {
        newContent = section.content.slice(0, 50) + "...\n（已缩写）";
      }
    }
    
    const newOutline = [...props.outline];
    newOutline[index] = { ...newOutline[index], content: newContent };
    emit("update:outline", newOutline);
  } catch (err) {
    console.error("改写失败:", err);
  } finally {
    operatingIndex.value = null;
    currentOperation.value = "";
  }
};

// 更新章节内容
const updateSectionContent = (index, content) => {
  const newOutline = [...props.outline];
  newOutline[index] = { ...newOutline[index], content };
  emit("update:outline", newOutline);
};

// 自定义拖拽功能
const isDragging = ref(false);
const dragStartY = ref(0);
const dragIndex = ref(null);
const dragStartHeight = ref(0);

const startDrag = (e, index) => {
  isDragging.value = true;
  dragIndex.value = index;
  dragStartY.value = e.clientY;
  dragStartHeight.value = textareaHeights.value[index] || 200;
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};

const onDrag = (e) => {
  if (!isDragging.value || dragIndex.value === null) return;
  
  const deltaY = e.clientY - dragStartY.value;
  const newHeight = Math.max(200, dragStartHeight.value + deltaY);
  textareaHeights.value[dragIndex.value] = newHeight;
};

const stopDrag = () => {
  isDragging.value = false;
  dragIndex.value = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};
</script>

<template>
  <div class="content-generator">
    <div class="sections-list">
      <div v-for="(section, index) in outline" :key="section.id || index" class="section-item">
        <div class="section-header">
          <h3 class="section-title">{{ cleanTitle(section.title) }}</h3>
          <div class="header-actions">
            <button 
              v-if="!section.content && generatingIndex !== index" 
              class="action-btn generate-btn" 
              @click="generateSection(index)"
            >
              <Icon name="Play" :size="16" />
              生成
            </button>
            <button 
              v-else-if="generatingIndex === index" 
              class="action-btn generating-btn" 
              disabled
            >
              <Icon name="Loader" :size="16" class="spinner" />
              生成中...
            </button>
            <template v-else-if="section.content">
              <button 
                v-if="operatingIndex !== index"
                class="action-btn polish-btn" 
                @click="rewriteSection(index, 'polish')" 
                title="润色优化内容"
              >
                <Icon name="Wand2" :size="18" />
                <span class="btn-label">润色</span>
              </button>
              <button 
                v-else
                class="action-btn operating-btn" 
                disabled
              >
                <Icon name="Loader" :size="16" class="spinner" />
                <span class="btn-label">{{ getOperationDesc(currentOperation) }}</span>
              </button>
              <button 
                v-if="operatingIndex !== index"
                class="action-btn expand-btn" 
                @click="rewriteSection(index, 'expand')" 
                title="扩写丰富内容"
              >
                <Icon name="ZoomIn" :size="18" />
                <span class="btn-label">扩写</span>
              </button>
              <button 
                v-if="operatingIndex !== index"
                class="action-btn shorten-btn" 
                @click="rewriteSection(index, 'shorten')" 
                title="缩写精简内容"
              >
                <Icon name="ZoomOut" :size="18" />
                <span class="btn-label">缩写</span>
              </button>
              <button 
                v-if="operatingIndex !== index"
                class="action-btn regenerate-btn" 
                @click="generateSection(index)" 
                title="重新生成内容"
              >
                <Icon name="RotateCcw" :size="18" />
                <span class="btn-label">重新生成</span>
              </button>
            </template>
          </div>
        </div>
        <div class="section-content">
          <div v-if="section.content" class="textarea-wrapper">
            <textarea 
              :value="section.content" 
              @input="(e) => updateSectionContent(index, e.target.value)" 
              class="content-textarea" 
              placeholder="该章节暂无内容..."
              :style="{ height: (textareaHeights[index] || 200) + 'px' }"
            ></textarea>
            <!-- 自定义拖拽手柄 -->
            <div class="custom-resizer" @mousedown="startDrag($event, index)">
              <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 16 16">
                <polygon points="16,16 16,6 6,16" fill="#6b7280"/>
              </svg>
            </div>
          </div>
          <div v-else class="content-placeholder">
            <div class="placeholder-icon">
              <Icon name="FileText" :size="48" />
            </div>
            <p class="placeholder-text">点击「生成」按钮来创作此章节</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-generator {
  padding-top: 8px;
}

.sections-list {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.section-item {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  background-color: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.action-btn:hover::before {
  opacity: 1;
}

.action-btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.btn-label {
  display: inline-block;
}

/* 生成按钮 */
.generate-btn {
  border-color: var(--primary);
  background-color: transparent;
  color: var(--primary);
}

.generate-btn:hover {
  background-color: var(--primary);
  color: white;
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.35);
}

/* 生成中按钮 */
.generating-btn,
.operating-btn {
  border-color: var(--primary);
  background-color: rgba(14, 165, 233, 0.1);
  color: var(--primary);
}

/* 润色按钮 */
.polish-btn {
  border-color: #10b981;
  color: #10b981;
  background-color: transparent;
}

.polish-btn:hover {
  background-color: #10b981;
  color: white;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
}

/* 扩写按钮 */
.expand-btn {
  border-color: #8b5cf6;
  color: #8b5cf6;
  background-color: transparent;
}

.expand-btn:hover {
  background-color: #8b5cf6;
  color: white;
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.35);
}

/* 缩写按钮 */
.shorten-btn {
  border-color: #f59e0b;
  color: #f59e0b;
  background-color: transparent;
}

.shorten-btn:hover {
  background-color: #f59e0b;
  color: white;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);
}

/* 重新生成按钮 */
.regenerate-btn {
  border-color: #6b7280;
  color: #6b7280;
  background-color: transparent;
}

.regenerate-btn:hover {
  background-color: #6b7280;
  color: white;
  box-shadow: 0 4px 16px rgba(107, 114, 128, 0.35);
}

/* Loading spinner */
.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.section-content {
  padding-left: 20px;
}

/* textarea 容器 */
.textarea-wrapper {
  position: relative;
}

.content-textarea {
  width: 100%;
  min-height: 200px;
  padding: 16px;
  padding-bottom: 30px;
  border: 1px solid var(--border);
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.8;
  outline: none;
  resize: none;
  overflow: auto;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.15s ease;
}

.content-textarea:hover {
  border-color: var(--text-muted);
  background-color: var(--bg-hover);
}

.content-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 自定义拖拽手柄 */
.custom-resizer {
  position: absolute;
  bottom: 9.5px;
  right: 0px;
  width: 16px;
  height: 16px;
  display: block;
  cursor: ns-resize;
  background-color: transparent;
  transition: all 0.15s ease;
  opacity: 1;
  z-index: 10;
}

:deep(.dark) .custom-resizer svg polygon {
  fill: #9ca3af;
}

.content-placeholder {
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  border: 2px dashed var(--border);
  border-radius: 16px;
  background: linear-gradient(135deg, var(--bg-hover) 0%, var(--bg-primary) 100%);
  transition: all 0.3s ease;
}

.content-placeholder:hover {
  border-color: var(--primary);
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-hover) 100%);
}

.placeholder-icon {
  color: var(--text-muted);
  opacity: 0.6;
  padding: 16px;
  background-color: var(--bg-primary);
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.placeholder-text {
  margin: 0;
  color: var(--text-secondary);
  font-size: 15px;
  text-align: center;
  line-height: 1.6;
}
</style>