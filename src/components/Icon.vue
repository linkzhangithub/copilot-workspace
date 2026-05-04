<script setup>
import { computed } from 'vue';
import * as icons from 'lucide-vue-next';

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 20,
  },
  color: {
    type: String,
    default: 'currentColor',
  },
  strokeWidth: {
    type: [Number, String],
    default: 2,
  },
});

const iconComponent = computed(() => icons[props.name]);
</script>

<template>
  <component
    :is="iconComponent"
    :size="size"
    :color="color"
    :stroke-width="strokeWidth"
    v-if="iconComponent"
  />
</template>
