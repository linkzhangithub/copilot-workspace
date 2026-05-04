<script setup>
import { ref } from "vue";
import Icon from "./Icon.vue";
import { Play, Loader2, Sparkles, ZoomIn, ZoomOut, RotateCcw, FileText } from "lucide-vue-next";

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
          <div class="header-left">
            <div class="section-number">{{ index + 1 }}</div>
            <h3 class="section-title">{{ cleanTitle(section.title) }}</h3>
          </div>
          <div class="header-actions">
            <button 
              v-if="!section.content && generatingIndex !== index" 
              class="action-btn generate-btn" 
              @click="generateSection(index)"
            >
              <Icon name="Play" :size="16" />
              <span class="btn-label">生成内容</span>
            </button>
            <button 
              v-else-if="generatingIndex === index" 
              class="action-btn generating-btn" 
              disabled
            >
              <Icon name="Loader2" :size="16" class="spinner" />
              <span class="btn-label">生成中...</span>
            </button>
            <template v-else-if="section.content">
              <button 
                v-if="operatingIndex !== index"
                class="action-btn polish-btn" 
                @click="rewriteSection(index, 'polish')" 
                title="润色优化内容"
              >
                <Icon name="Sparkles" :size="16" />
                <span class="btn-label">润色</span>
              </button>
              <button 
                v-else
                class="action-btn operating-btn" 
                disabled
              >
                <Icon name="Loader2" :size="16" class="spinner" />
                <span class="btn-label">{{ getOperationDesc(currentOperation) }}</span>
              </button>
              <button 
                v-if="operatingIndex !== index"
                class="action-btn expand-btn" 
                @click="rewriteSection(index, 'expand')" 
                title="扩写丰富内容"
              >
                <Icon name="ZoomIn" :size="16" />
                <span class="btn-label">扩写</span>
              </button>
              <button 
                v-if="operatingIndex !== index"
                class="action-btn shorten-btn" 
                @click="rewriteSection(index, 'shorten')" 
                title="缩写精简内容"
              >
                <Icon name="ZoomOut" :size="16" />
                <span class="btn-label">缩写</span>
              </button>
              <button 
                v-if="operatingIndex !== index"
                class="action-btn regenerate-btn" 
                @click="generateSection(index)" 
                title="重新生成内容"
              >
                <Icon name="RotateCcw" :size="16" />
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
              :style="{ height: (textareaHeights[index] || 240) + 'px' }"
            ></textarea>
          </div>
          <div v-else class="content-placeholder">
            <div class="placeholder-icon">
              <Icon name="FileText" :size="48" />
            </div>
            <div class="placeholder-text">
              <h4>开始创作这个章节</h4>
              <p>点击上方的「生成内容」按钮，让 AI 帮你创作</p>
            </div>
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
  gap: 32px;
}

.section-item {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.section-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: white;
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  border: 2px solid var(--border);
  background-color: var(--bg-sidebar);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.action-btn:active {
  transform: translateY(0);
}

.action-btn:disabled {
  opacity: 0.6;
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
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.3);
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
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
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
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.3);
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
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.3);
}

/* 重新生成按钮 */
.regenerate-btn {
  border-color: #6b7280;
  color: #6b7280;
  background-color: transparent;
  padding: 10px 12px;
}

.regenerate-btn:hover {
  background-color: #6b7280;
  color: white;
  box-shadow: 0 6px 16px rgba(107, 114, 128, 0.3);
}

/* Loading spinner */
.spinner {
  animation: spin 0.8s linear infinite;
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
  padding-left: 48px;
}

/* textarea 容器 */
.textarea-wrapper {
  position: relative;
}

.content-textarea {
  width: 100%;
  min-height: 240px;
  padding: 18px 20px;
  border: 2px solid var(--border);
  background-color: var(--bg-sidebar);
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.8;
  outline: none;
  resize: none;
  overflow: auto;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.content-textarea:hover {
  border-color: var(--text-muted);
  background-color: var(--bg-hover);
}

.content-textarea:focus {
  border-color: var(--primary);
  background-color: var(--bg-sidebar);
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.15);
}

.content-placeholder {
  padding: 48px 32px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 24px;
  border: 2px dashed var(--border);
  border-radius: 16px;
  background: linear-gradient(135deg, var(--bg-sidebar) 0%, var(--bg-hover) 100%);
  transition: all 0.3s ease;
}

.content-placeholder:hover {
  border-color: var(--primary);
  background: linear-gradient(135deg, var(--bg-hover) 0%, var(--bg-sidebar) 100%);
}

.placeholder-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  opacity: 0.6;
  background-color: var(--bg-input);
  border-radius: 16px;
  flex-shrink: 0;
}

.placeholder-text {
  flex: 1;
  min-width: 0;
}

.placeholder-text h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.placeholder-text p {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
}
</style>
