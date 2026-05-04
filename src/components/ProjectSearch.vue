<script setup>
import Icon from "./Icon.vue";

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
    <Icon name="Search" :size="16" class="search-icon" />
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
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--bg-input);
  border-radius: 6px;
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.search-box input::placeholder {
  color: var(--text-muted);
}
</style>
