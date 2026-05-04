<script setup>
import Icon from './Icon.vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="search-box">
    <Icon name="Search" :size="18" class="search-icon" />
    <input
      :value="modelValue"
      type="text"
      placeholder="搜索文章..."
      @input="$emit('update:modelValue', $event.target.value)"
    />
  </div>
</template>

<style scoped>
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background-color: var(--bg-input);
  border-radius: 12px;
  border: 1.5px solid transparent;
  transition: all 0.2s ease;
}

.search-box:focus-within {
  border-color: var(--primary);
  background-color: var(--bg-sidebar);
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.search-box:focus-within .search-icon {
  color: var(--primary);
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 400;
  outline: none;
  line-height: 1.5;
}

.search-box input::placeholder {
  color: var(--text-muted);
}
</style>
