<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { createAnimationPreviews } from '../animation-previews'
import { replayAppLoading } from '../loading-preview'
import ThemeControl from './ThemeControl.vue'
import ThemeModeControl, { type ThemeMode } from './ThemeModeControl.vue'

const colors = [
  { label: '翡翠', value: '#00c781' },
  { label: '青蓝', value: '#0891b2' },
  { label: '湖蓝', value: '#2f7bff' },
  { label: '靛紫', value: '#7c4dff' },
  { label: '品红', value: '#ff2e93' },
  { label: '珊瑚红', value: '#ff4d6d' },
  { label: '亮橙', value: '#ff7a00' },
  { label: '柠檬黄', value: '#ffd60a' },
  { label: '青柠', value: '#b8f000' },
  { label: '松石绿', value: '#0d9488' },
]
const themeModeLabels: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}
const selectedColor = shallowRef(
  colors.find((color) => color.value === localStorage.getItem('vite-plugin-loading:vue-color'))
    ?.value ?? colors[0].value,
)
const themeMode = shallowRef(resolveThemeMode())
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
const { css: previewCss, previews } = createAnimationPreviews('vue-loader')
const previewStyle = document.createElement('style')
previewStyle.textContent = previewCss
document.head.append(previewStyle)

watch(
  selectedColor,
  (color) => {
    document.documentElement.style.setProperty('--example-primary', color)
    localStorage.setItem('vite-plugin-loading:vue-color', color)
  },
  { immediate: true },
)

watch(themeMode, applyTheme, { immediate: true })

onMounted(() => systemTheme.addEventListener('change', handleSystemThemeChange))

onUnmounted(() => systemTheme.removeEventListener('change', handleSystemThemeChange))

function applyTheme(mode: ThemeMode): void {
  const resolvedMode = mode === 'system' ? (systemTheme.matches ? 'dark' : 'light') : mode
  const root = document.documentElement
  root.dataset.theme = resolvedMode
  root.style.colorScheme = resolvedMode
  root.style.setProperty('--vue-loader-mask-color', resolvedMode === 'dark' ? '#101714' : '#fff')
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', resolvedMode === 'dark' ? '#101714' : '#f7f9f8')
  localStorage.setItem('vite-plugin-loading:vue-theme', mode)
}

function handleSystemThemeChange(): void {
  if (themeMode.value === 'system') applyTheme('system')
}

function resolveThemeMode(): ThemeMode {
  const mode = localStorage.getItem('vite-plugin-loading:vue-theme')
  return mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system'
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">V</span><span>Vue 示例</span></div>
      <code>virtual:app-loading</code>
    </header>

    <main class="workspace">
      <section class="intro">
        <p class="kicker">Vite HTML 转换 / Vue 3</p>
        <h1>在 Vue 接管之前<br />先显示 Loading。</h1>
        <p class="summary">
          插件把首屏直接注入 HTML。Vue 挂载并完成引导后，调用
          <code>hideAppLoading()</code>。
        </p>
        <button class="replay-button" type="button" @click="replayAppLoading()">
          <span aria-hidden="true">↻</span>
          重放 Loading
        </button>
      </section>

      <section class="control-panel" aria-labelledby="controls-title">
        <div class="panel-heading">
          <div>
            <p class="kicker">实时配置</p>
            <h2 id="controls-title">当前引导状态</h2>
          </div>
          <span class="status"><i /> 就绪</span>
        </div>

        <dl class="config-list">
          <div>
            <dt>type</dt>
            <dd>beat</dd>
          </div>
          <div>
            <dt>classPrefix</dt>
            <dd>vue-loader</dd>
          </div>
          <div>
            <dt>title</dt>
            <dd>Vue 工作区</dd>
          </div>
          <div>
            <dt>mask</dt>
            <dd>渐变 / {{ themeModeLabels[themeMode] }}</dd>
          </div>
        </dl>

        <div class="theme-section">
          <span class="field-label">动态主题色</span>
          <ThemeControl v-model="selectedColor" :colors="colors" />
          <span class="field-label mode-label">配色模式</span>
          <ThemeModeControl v-model="themeMode" />
        </div>
      </section>

      <section class="type-strip" aria-labelledby="types-title">
        <div class="type-heading">
          <p class="kicker">内置动画</p>
          <h2 id="types-title">全部动画</h2>
          <p>所有内置动画，均使用插件注入的同一套模板渲染。</p>
        </div>
        <div class="animation-grid">
          <div v-for="preview in previews" :key="preview.type" class="animation-card">
            <div
              class="animation-stage"
              :data-app-loading="preview.type"
              data-app-loading-preview
              v-html="preview.html"
            />
            <span>{{ preview.type }}</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
