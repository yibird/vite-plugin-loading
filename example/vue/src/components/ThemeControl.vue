<script setup lang="ts">
interface ThemeColor {
  label: string
  value: string
}

defineProps<{
  colors: ThemeColor[]
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="theme-control" aria-label="Loading 主题色">
    <button
      v-for="color in colors"
      :key="color.value"
      class="color-button"
      :class="{ active: color.value === model }"
      type="button"
      :aria-label="color.label"
      :aria-pressed="color.value === model"
      :style="{ '--swatch-color': color.value }"
      @click="model = color.value"
    >
      <span class="swatch" />
      <span>{{ color.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.theme-control {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 12px;
  color: var(--ink-muted);
  border: 1px solid var(--line);
  background: transparent;
  font:
    500 12px/1 'IBM Plex Mono',
    monospace;
  cursor: pointer;
}

.color-button:hover,
.color-button.active {
  color: var(--ink);
  border-color: var(--example-primary);
}

.swatch {
  width: 13px;
  height: 13px;
  background: var(--swatch-color);
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 45%);
}
</style>
