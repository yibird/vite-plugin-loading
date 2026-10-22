import { useEffect, useState } from 'react'
import { createAnimationPreviews } from '../animation-previews'
import { replayAppLoading } from '../loading-preview'
import ThemeControl from './ThemeControl'
import ThemeModeControl, { type ThemeMode } from './ThemeModeControl'

const { css: previewCss, previews } = createAnimationPreviews('react-loader')

const colors = [
  { label: '琥珀', value: '#ffb300' },
  { label: '亮橙', value: '#ff7a00' },
  { label: '珊瑚', value: '#ff5c5c' },
  { label: '品红', value: '#ff2d8d' },
  { label: '紫罗兰', value: '#a855f7' },
  { label: '靛蓝', value: '#4f7cff' },
  { label: '天蓝', value: '#00b4ff' },
  { label: '青绿', value: '#00d1b2' },
  { label: '青柠', value: '#a3e635' },
  { label: '亮粉', value: '#ff6ec7' },
]
const themeModeLabels: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')

function resolveThemeMode(): ThemeMode {
  const mode = localStorage.getItem('vite-plugin-loading:react-theme')
  return mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system'
}

function applyTheme(mode: ThemeMode): void {
  const resolvedMode = mode === 'system' ? (systemTheme.matches ? 'dark' : 'light') : mode
  const root = document.documentElement
  root.dataset.theme = resolvedMode
  root.style.colorScheme = resolvedMode
  root.style.setProperty('--react-loader-mask-color', resolvedMode === 'dark' ? '#101316' : '#fff')
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', resolvedMode === 'dark' ? '#101316' : '#f5f7f4')
  localStorage.setItem('vite-plugin-loading:react-theme', mode)
}

export default function LoadingDemo() {
  const [selectedColor, setSelectedColor] = useState(
    () =>
      colors.find(
        (color) => color.value === localStorage.getItem('vite-plugin-loading:react-color'),
      )?.value ?? colors[0].value,
  )
  const [themeMode, setThemeMode] = useState<ThemeMode>(resolveThemeMode)

  useEffect(() => {
    document.documentElement.style.setProperty('--example-primary', selectedColor)
    localStorage.setItem('vite-plugin-loading:react-color', selectedColor)
  }, [selectedColor])

  useEffect(() => {
    applyTheme(themeMode)
    const handleChange = () => themeMode === 'system' && applyTheme('system')
    systemTheme.addEventListener('change', handleChange)
    return () => systemTheme.removeEventListener('change', handleChange)
  }, [themeMode])

  return (
    <div className="app-shell">
      <style>{previewCss}</style>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <span>React 示例</span>
        </div>
        <span className="runtime">React 19 / Vite 8</span>
      </header>

      <main className="dashboard">
        <section className="overview">
          <div className="eyebrow">
            <span className="live-dot" /> HTML 阶段完成
          </div>
          <h1>
            引导
            <br />
            控制台
          </h1>
          <p>
            Loading 遮罩在 React 渲染之前就已存在。只有应用挂载并调用
            <code>hideAppLoading()</code> 后，这个页面才会出现。
          </p>
          <button type="button" className="replay-button" onClick={() => replayAppLoading()}>
            <span aria-hidden="true">↻</span>
            重放 Loading
          </button>
        </section>

        <section className="metrics" aria-label="Loading 配置">
          <div className="metric accent">
            <span>当前类型</span>
            <strong>beat</strong>
          </div>
          <div className="metric">
            <span>主题来源</span>
            <strong>CSS 变量</strong>
          </div>
          <div className="metric">
            <span>类名前缀</span>
            <strong>react-loader</strong>
          </div>
          <div className="metric">
            <span>遮罩表面</span>
            <strong>{themeModeLabels[themeMode]}</strong>
          </div>
        </section>

        <section className="theme-panel" aria-labelledby="theme-title">
          <div>
            <span className="section-index">01</span>
            <h2 id="theme-title">动态主题</h2>
            <p>Loading 颜色、渐变表面与应用主题会同步更新。</p>
          </div>
          <div className="theme-tools">
            <ThemeControl colors={colors} value={selectedColor} onChange={setSelectedColor} />
            <ThemeModeControl value={themeMode} onChange={setThemeMode} />
          </div>
        </section>

        <section className="type-panel" aria-labelledby="types-title">
          <div className="section-heading">
            <div>
              <span className="section-index">02</span>
              <h2 id="types-title">全部动画</h2>
            </div>
            <span className="runtime-state">8 种内置动画</span>
          </div>
          <div className="animation-grid">
            {previews.map((preview) => (
              <div className="animation-card" key={preview.type}>
                <div
                  className="animation-stage"
                  data-app-loading={preview.type}
                  data-app-loading-preview
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
                <span>{preview.type}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
