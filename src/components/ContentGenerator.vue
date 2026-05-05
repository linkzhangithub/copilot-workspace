<script setup>
import { ref, computed } from "vue";
import Icon from "./Icon.vue";
import { Play, Loader2, Sparkles, ZoomIn, ZoomOut, RotateCcw, FileText } from "lucide-vue-next";

const props = defineProps({
  outline: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["update:outline"]);

const generatingPath = ref(null);
const operatingPath = ref(null);
const currentOperation = ref("");
const typingController = ref(null); // 用于中断打字效果

// 存储每个 textarea 的高度
const textareaHeights = ref({});

// 打字机效果函数
const typeWriter = async (fullText, onUpdate, speed = 30) => {
  return new Promise((resolve) => {
    let index = 0;
    let currentText = "";
    
    const type = () => {
      if (index < fullText.length) {
        // 每次可以多打几个字符，让效果更流畅
        const charsToType = Math.min(3, fullText.length - index);
        currentText += fullText.slice(index, index + charsToType);
        index += charsToType;
        onUpdate(currentText);
        
        // 随机延迟一点点，让打字更自然
        const randomDelay = speed + Math.random() * 20;
        setTimeout(type, randomDelay);
      } else {
        resolve();
      }
    };
    
    type();
  });
};

// 将嵌套数组扁平化为带路径的数组
const flatContent = computed(() => {
  const result = [];
  
  const flatten = (items, path = [], level = 0) => {
    items.forEach((item, index) => {
      const currentPath = [...path, index];
      result.push({
        ...item,
        path: currentPath,
        level,
      });
      if (item.children && item.children.length > 0) {
        flatten(item.children, currentPath, level + 1);
      }
    });
  };
  
  flatten(props.outline);
  return result;
});

// 路径转字符串 key
const getPathKey = (path) => path.join("-");

// 清理标题中的 markdown 标记
const cleanTitle = (title) => {
  if (!title) return title;
  return title.replace(/^#+\s*/, "").trim();
};

// 清理内容中重复的标题 - 更激进的清理
const cleanDuplicateTitleInContent = (content, title) => {
  if (!content) return content;

  let cleaned = content.trim();

  // 准备标题的各种变体（去掉标点、空格等）用于匹配
  const cleanForMatch = (text) => {
    return text.replace(/[、\(\)\[\]（）【】\.\,，。\s\-]/g, '').toLowerCase();
  };
  
  const targetTitleClean = title ? cleanForMatch(title) : '';
  
  // 按行分割，查找并移除匹配的标题行
  const lines = cleaned.split('\n');
  const filteredLines = [];
  let removedCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTrim = line.trim();
    
    // 前5行，或者前2行（如果行数少），进行严格清理
    if (i < Math.min(5, Math.max(2, lines.length * 0.3)) && removedCount < 3) {
      
      // 1. 直接移除所有以#开头的行（不管是不是标题）
      if (lineTrim.startsWith('#')) {
        removedCount++;
        continue;
      }
      
      // 2. 如果有title，检查是否包含title相关内容
      if (title && targetTitleClean) {
        const lineClean = cleanForMatch(lineTrim);
        
        // 完全匹配或者部分匹配都移除
        if (lineClean.length > 0) {
          if (lineClean.includes(targetTitleClean) || targetTitleClean.includes(lineClean)) {
            removedCount++;
            continue;
          }
          
          // 检查关键词匹配
          const titleWords = title.split(/[、\s]+/);
          for (const word of titleWords) {
            if (word.length >= 2 && lineClean.includes(cleanForMatch(word))) {
              removedCount++;
              continue;
            }
          }
        }
      }
      
      // 3. 如果行很短（小于15个字符）并且看起来像标题，也移除
      if (lineTrim.length > 0 && lineTrim.length < 15) {
        // 检查是否有常见的标题特征
        const titlePatterns = [
          /^第[一二三四五六七八九十\d]+[章节部分条]/,
          /^[一二三四五六七八九十]+[、\.]/,
          /^\d+[\.\)、]/,
          /^概述|简介|前言|结论|总结|参考文献/
        ];
        
        for (const pattern of titlePatterns) {
          if (pattern.test(lineTrim)) {
            removedCount++;
            continue;
          }
        }
      }
    }
    
    filteredLines.push(line);
  }
  
  cleaned = filteredLines.join('\n').trim();

  return cleaned;
};

// 获取显示编号
const chineseNumbers = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

const getDisplayNumber = (path) => {
  if (path.length === 1) {
    return chineseNumbers[path[0]] + "、";
  } else if (path.length === 2) {
    return "(" + (path[1] + 1) + ")";
  } else {
    return (path[2] + 1) + ")";
  }
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

// 通过路径更新章节内容
const updateSectionByPath = (path, content) => {
  const deepClone = (arr) => {
    return arr.map(item => ({
      ...item,
      children: item.children ? deepClone(item.children) : [],
    }));
  };
  const newOutline = deepClone(props.outline);
  let current = newOutline;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]].children;
  }
  current[path[path.length - 1]] = { ...current[path[path.length - 1]], content };
  emit("update:outline", newOutline);
};

// 流式请求工具函数
const streamRequest = async (url, body, onData, onComplete, onError) => {
  try {
    console.log("正在调用流式API:", url);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log("响应状态:", response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }

    // 检查是否是流式响应
    const contentType = response.headers.get('content-type');
    console.log("响应类型:", contentType);
    
    if (!contentType || !contentType.includes('text/event-stream')) {
      console.log("不是流式响应，使用普通响应");
      const result = await response.json();
      if (result.success && result.data) {
        onData(result.data);
        onComplete(result.data);
      } else {
        throw new Error("响应格式错误");
      }
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      // 保留最后一个不完整的行在 buffer 中
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6).trim();
          
          if (data === "[DONE]") {
            continue;
          }
          
          try {
            const json = JSON.parse(data);
            if (json.content) {
              fullText += json.content;
              onData(fullText);
            }
          } catch (e) {
            // 可能不是完整的JSON，继续等待
          }
        }
      }
    }

    onComplete(fullText);
  } catch (err) {
    console.error("流式请求失败:", err);
    onError(err);
  }
};

// 生成章节内容（带打字机效果）
const generateSection = async (path) => {
  if (generatingPath.value !== null) return;
  if (operatingPath.value !== null) return;

  const pathKey = getPathKey(path);
  generatingPath.value = pathKey;

  // 获取当前section的title
  const getCurrentSection = () => {
    let current = props.outline;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children;
    }
    return current[path[path.length - 1]];
  };
  const currentSection = getCurrentSection();
  const sectionTitle = currentSection.title;

  const updateContent = (content) => {
    const deepClone = (arr) => {
      return arr.map(item => ({
        ...item,
        children: item.children ? deepClone(item.children) : [],
      }));
    };

    const newOutline = deepClone(props.outline);
    let current = newOutline;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children;
    }

    current[path[path.length - 1]].content = content;
    emit("update:outline", newOutline);
  };

  try {
    console.log("开始生成内容，path:", path);
    const response = await fetch("/api/ai/generate-content-simple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outline: props.outline,
        sectionIndex: path[0] // 使用第一个路径索引作为sectionIndex
      }),
    });

    console.log("API响应状态:", response.status);
    const result = await response.json();
    console.log("API响应数据:", result);
    
    let fullContent = "";
    if (result.success && result.data) {
      fullContent = result.data;
      // 清理内容中可能重复的标题
      fullContent = cleanDuplicateTitleInContent(fullContent, sectionTitle);
    } else {
      // 最终fallback
      fullContent = `这是关于"${sectionTitle}"的详细内容。

在这里可以展开说明相关的细节、例子、和注意事项等。`;
    }
    
    // 使用打字机效果逐字显示
    updateContent(""); // 先清空
    await typeWriter(fullContent, (partialText) => {
      updateContent(partialText);
    });
    
  } catch (err) {
    console.error("生成失败，使用fallback:", err);
    
    // 最后fallback，也用打字机效果
    const fullContent = `这是关于"${sectionTitle}"的详细内容。

在这里可以展开说明相关的细节、例子、和注意事项等。`;
    
    updateContent("");
    await typeWriter(fullContent, (partialText) => {
      updateContent(partialText);
    });
    
  } finally {
    generatingPath.value = null;
  }
};

// 改写内容（接入真实 API）
const rewriteSection = async (path, operation) => {
  const pathKey = getPathKey(path);
  
  // 找到对应章节
  let current = props.outline;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]].children;
  }
  const section = current[path[path.length - 1]];
  const sectionTitle = section.title;
  
  if (!section.content) return;
  if (generatingPath.value !== null) return;
  if (operatingPath.value !== null) return;

  operatingPath.value = pathKey;
  currentOperation.value = operation;

  try {
    // 调用API
    const response = await fetch("/api/ai/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: section.content,
        operation: operation
      }),
    });

    const result = await response.json();
    
    let newContent = section.content;
    if (result.success && result.data) {
      newContent = result.data;
      // 清理内容中可能重复的标题
      newContent = cleanDuplicateTitleInContent(newContent, sectionTitle);
    } else {
      // 如果API失败，使用fallback
      if (operation === "polish") {
        newContent = section.content + "\n\n（已润色）";
      } else if (operation === "expand") {
        newContent = section.content + "\n\n（已扩写）这段是新增的扩展内容。";
      } else if (operation === "shorten") {
        newContent = section.content.slice(0, 50) + "...\n（已缩写）";
      }
    }
    
    // 用打字机效果展示改写后的内容
    updateSectionByPath(path, ""); // 先清空
    await typeWriter(newContent, (partialText) => {
      updateSectionByPath(path, partialText);
    });
  } catch (err) {
    console.error("改写失败:", err);
    // 如果API失败，使用fallback
    let newContent = section.content;
    if (operation === "polish") {
      newContent = section.content + "\n\n（已润色）";
    } else if (operation === "expand") {
      newContent = section.content + "\n\n（已扩写）这段是新增的扩展内容。";
    } else if (operation === "shorten") {
      newContent = section.content.slice(0, 50) + "...\n（已缩写）";
    }
    
    // 也用打字机效果
    updateSectionByPath(path, "");
    await typeWriter(newContent, (partialText) => {
      updateSectionByPath(path, partialText);
    });
  } finally {
    operatingPath.value = null;
    currentOperation.value = "";
  }
};

// 自定义拖拽功能
const isDragging = ref(false);
const dragStartY = ref(0);
const dragPathKey = ref(null);
const dragStartHeight = ref(0);

const startDrag = (e, pathKey) => {
  isDragging.value = true;
  dragPathKey.value = pathKey;
  dragStartY.value = e.clientY;
  dragStartHeight.value = textareaHeights.value[pathKey] || 200;
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
};

const onDrag = (e) => {
  if (!isDragging.value || dragPathKey.value === null) return;
  
  const deltaY = e.clientY - dragStartY.value;
  const newHeight = Math.max(200, dragStartHeight.value + deltaY);
  textareaHeights.value[dragPathKey.value] = newHeight;
};

const stopDrag = () => {
  isDragging.value = false;
  dragPathKey.value = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
};
</script>

<template>
  <div class="content-generator">
    <div class="sections-list">
      <div 
        v-for="(item, idx) in flatContent" 
        :key="getPathKey(item.path)" 
        class="section-item"
        :class="`level-${item.level}`"
      >
        <div class="section-header">
          <div class="header-left">
            <div class="content-number">{{ getDisplayNumber(item.path) }}</div>
            <h3 
              v-if="item.level === 0" 
              class="main-title"
            >
              {{ cleanTitle(item.title) }}
            </h3>
            <h4 
              v-else 
              class="subsection-title"
            >
              {{ cleanTitle(item.title) }}
            </h4>
          </div>
          <div v-if="item.level > 0" class="header-actions">
            <button 
              v-if="!item.content && generatingPath !== getPathKey(item.path)" 
              class="action-btn generate-btn" 
              @click="generateSection(item.path)"
            >
              <Icon name="Play" :size="16" />
              <span class="btn-label">生成内容</span>
            </button>
            <button 
              v-else-if="generatingPath === getPathKey(item.path)" 
              class="action-btn generating-btn" 
              disabled
            >
              <Icon name="Loader2" :size="16" class="spinner" />
              <span class="btn-label">生成中...</span>
            </button>
            <template v-else-if="item.content">
              <button 
                v-if="operatingPath !== getPathKey(item.path)"
                class="action-btn polish-btn" 
                @click="rewriteSection(item.path, 'polish')" 
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
                v-if="operatingPath !== getPathKey(item.path)"
                class="action-btn expand-btn" 
                @click="rewriteSection(item.path, 'expand')" 
                title="扩写丰富内容"
              >
                <Icon name="ZoomIn" :size="16" />
                <span class="btn-label">扩写</span>
              </button>
              <button 
                v-if="operatingPath !== getPathKey(item.path)"
                class="action-btn shorten-btn" 
                @click="rewriteSection(item.path, 'shorten')" 
                title="缩写精简内容"
              >
                <Icon name="ZoomOut" :size="16" />
                <span class="btn-label">缩写</span>
              </button>
              <button 
                v-if="operatingPath !== getPathKey(item.path)"
                class="action-btn regenerate-btn" 
                @click="generateSection(item.path)" 
                title="重新生成内容"
              >
                <Icon name="RotateCcw" :size="16" />
              </button>
            </template>
          </div>
        </div>
        <div v-if="item.level > 0" class="section-content">
          <div v-if="item.content" class="textarea-wrapper">
            <textarea 
              :value="item.content" 
              @input="(e) => updateSectionByPath(item.path, e.target.value)" 
              class="content-textarea" 
              placeholder="该章节暂无内容..."
              :style="{ height: (textareaHeights[getPathKey(item.path)] || 240) + 'px' }"
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

/* 层级缩进 */
.level-1 {
  margin-left: 24px;
}

.level-2 {
  margin-left: 48px;
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

.content-number {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
}

.level-1 .content-number {
  color: var(--text-secondary);
  font-size: 16px;
  font-weight: 600;
}

.level-2 .content-number {
  color: var(--text-tertiary);
  font-size: 14px;
  font-weight: 500;
}

.section-number {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: auto;
  width: auto;
  height: auto;
  padding: 0;
  border-radius: 0;
  background-color: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.level-1 .section-number {
  color: var(--text-secondary);
  font-size: 13px;
}

.level-2 .section-number {
  color: var(--text-tertiary);
  font-size: 12px;
}

/* 主标题样式 */
.main-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 8px 0;
}

/* 子标题样式 */
.subsection-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-secondary);
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
  padding-left: 60px;
}

/* textarea 容器 */
.textarea-wrapper {
  position: relative;
}

.content-textarea {
  width: 100%;
  min-height: 240px;
  padding: 20px 28px 20px 24px;
  border: 1px solid var(--border);
  background-color: var(--bg-sidebar);
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1.85;
  font-weight: 400;
  letter-spacing: 0.02em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  outline: none;
  resize: vertical;
  overflow-y: scroll;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

/* 自定义滚动条 - 一直显示，更细更淡，完全在圆角内 */
.content-textarea::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.content-textarea::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 0 16px 16px 0;
  margin: 16px 0;
}

.content-textarea::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 6px;
  border: 2px solid transparent;
  background-clip: content-box;
  transition: all 0.2s ease;
}

.content-textarea::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.8);
}

/* 滚动条角落 - 透明，不干扰手柄 */
.content-textarea::-webkit-scrollbar-corner {
  background: transparent;
}

/* 调整手柄样式 - 三角形样式，视觉上更大 */
.content-textarea::-webkit-resizer {
  background: 
    linear-gradient(135deg, transparent 45%, #374151 45%),
    linear-gradient(135deg, transparent 55%, #374151 55%),
    linear-gradient(135deg, transparent 65%, #374151 65%);
  background-size: 100% 100%, 85% 85%, 70% 70%;
  background-position: bottom right, bottom right, bottom right;
  background-repeat: no-repeat;
  cursor: ns-resize;
  opacity: 0.95;
}

.content-textarea:hover {
  border-color: var(--text-tertiary);
}

.content-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 8px 24px rgba(14, 165, 233, 0.1);
}

.content-placeholder {
  padding: 56px 40px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 28px;
  border: 2px dashed var(--border);
  border-radius: 20px;
  background: linear-gradient(145deg, var(--bg-sidebar) 0%, var(--bg-hover) 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.content-placeholder:hover {
  border-color: var(--primary);
  background: linear-gradient(145deg, var(--bg-hover) 0%, var(--bg-sidebar) 100%);
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background-color: var(--bg-hover);
  border-radius: 14px;
  flex-shrink: 0;
}

.placeholder-text {
  flex: 1;
  min-width: 0;
}

.placeholder-text h4 {
  margin: 0 0 6px 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.placeholder-text p {
  margin: 0;
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ===== 响应式设计 - 移动端适配 ===== */
@media (max-width: 768px) {
  .sections-list {
    gap: 24px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 6px;
  }

  .header-left {
    gap: 8px;
  }

  .content-number {
    font-size: 18px;
  }

  .level-1 .content-number {
    font-size: 14px;
  }

  .level-2 .content-number {
    font-size: 13px;
  }

  .main-title {
    font-size: 20px;
  }

  .subsection-title {
    font-size: 16px;
  }

  .action-btn {
    padding: 8px 12px;
    font-size: 12px;
    gap: 4px;
  }

  .section-content {
    padding-left: 40px;
  }

  .content-textarea {
    padding: 16px 20px 16px 18px;
    font-size: 15px;
    line-height: 1.75;
    min-height: 200px;
    border-radius: 14px;
  }

  .content-placeholder {
    padding: 40px 24px;
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }

  .placeholder-icon {
    width: 56px;
    height: 56px;
  }

  .placeholder-text h4 {
    font-size: 15px;
  }

  .placeholder-text p {
    font-size: 14px;
  }

  .level-1 {
    margin-left: 20px;
  }

  .level-2 {
    margin-left: 32px;
  }
}

@media (max-width: 480px) {
  .sections-list {
    gap: 20px;
  }

  .section-header {
    gap: 8px;
  }

  .header-actions {
    gap: 4px;
  }

  .content-number {
    font-size: 16px;
  }

  .level-1 .content-number {
    font-size: 13px;
  }

  .level-2 .content-number {
    font-size: 12px;
  }

  .main-title {
    font-size: 18px;
  }

  .subsection-title {
    font-size: 15px;
  }

  .action-btn {
    padding: 7px 10px;
    font-size: 12px;
  }

  .action-btn .btn-label {
    display: none;
  }

  .section-content {
    padding-left: 28px;
  }

  .content-textarea {
    padding: 14px 16px 14px 14px;
    font-size: 14px;
    line-height: 1.7;
    min-height: 180px;
    border-radius: 12px;
  }

  .content-placeholder {
    padding: 32px 20px;
    gap: 16px;
  }

  .placeholder-icon {
    width: 48px;
    height: 48px;
  }

  .placeholder-text h4 {
    font-size: 14px;
  }

  .placeholder-text p {
    font-size: 13px;
  }

  .level-1 {
    margin-left: 12px;
  }

  .level-2 {
    margin-left: 20px;
  }
}
</style>
