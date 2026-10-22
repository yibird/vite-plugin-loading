<script setup lang="ts">
export type ThemeMode = 'light' | 'dark' | 'system'

const modes: readonly ThemeMode[] = ['light', 'dark', 'system']
const labels: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}
const model = defineModel<ThemeMode>({ required: true })
</script>

<template>
  <div class="mode-control" aria-label="配色模式">
    <button
      v-for="mode in modes"
      :key="mode"
      type="button"
      :class="{ active: mode === model }"
      :aria-pressed="mode === model"
      @click="model = mode"
    >
      {{ labels[mode] }}
    </button>
  </div>
</template>

<style scoped>
.mode-control {
  display: inline-grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 3px;
  border: 1px solid var(--line);
  background: var(--paper);
}

.mode-control button {
  min-width: 68px;
  min-height: 32px;
  padding: 0 10px;
  color: var(--ink-muted);
  border: 0;
  background: transparent;
  cursor: pointer;
  font:
    500 11px/1 'IBM Plex Mono',
    monospace;
  text-transform: capitalize;
}

.mode-control button:hover,
.mode-control button.active {
  color: var(--ink);
  background: var(--panel);
  box-shadow: 0 1px 5px var(--shadow);
}
</style>
