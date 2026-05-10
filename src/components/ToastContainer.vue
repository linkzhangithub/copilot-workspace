<script setup>
import { ref } from 'vue'
import Toast from './Toast.vue'

const toasts = ref([])
let toastId = 0

const show = (message, type = 'info', duration = 3000) => {
  const id = toastId++
  toasts.value.push({ id, message, type, duration })
}

const remove = (id) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

defineExpose({
  show,
  info: (message, duration) => show(message, 'info', duration),
  success: (message, duration) => show(message, 'success', duration),
  warning: (message, duration) => show(message, 'warning', duration),
  error: (message, duration) => show(message, 'error', duration)
})
</script>

<template>
  <div class="toast-container">
    <Toast
      v-for="toast in toasts"
      :key="toast.id"
      :message="toast.message"
      :type="toast.type"
      :duration="toast.duration"
      @close="remove(toast.id)"
    />
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 200px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}
</style>
