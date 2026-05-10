<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'info',
    validator: (value) => ['info', 'success', 'warning', 'error'].includes(value)
  },
  duration: {
    type: Number,
    default: 3000
  }
})

const emit = defineEmits(['close'])

const visible = ref(false)

onMounted(() => {
  setTimeout(() => {
    visible.value = true
  }, 10)
  
  if (props.duration > 0) {
    setTimeout(() => {
      visible.value = false
      setTimeout(() => {
        emit('close')
      }, 300)
    }, props.duration)
  }
})

const getIcon = () => {
  const icons = {
    info: 'Info',
    success: 'CheckCircle',
    warning: 'AlertTriangle',
    error: 'XCircle'
  }
  return icons[props.type] || 'Info'
}
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" :class="['toast', `toast-${type}`]">
      <div class="toast-icon">
        <Icon :name="getIcon()" :size="20" />
      </div>
      <div class="toast-message">{{ message }}</div>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  min-width: 300px;
  max-width: 500px;
  pointer-events: auto;
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.5;
}

.toast-info {
  border-left: 3px solid var(--primary);
  background: #ffffff;
}

.toast-info .toast-icon {
  color: var(--primary);
}

.toast-success {
  border-left: 3px solid var(--success);
  background: #ffffff;
}

.toast-success .toast-icon {
  color: var(--success);
}

.toast-warning {
  border-left: 3px solid var(--warning);
  background: #ffffff;
}

.toast-warning .toast-icon {
  color: var(--warning);
}

.toast-error {
  border-left: 3px solid var(--danger);
  background: #ffffff;
}

.toast-error .toast-icon {
  color: var(--danger);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
