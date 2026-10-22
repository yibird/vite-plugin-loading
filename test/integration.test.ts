import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vite-plus/test'
import { build } from 'vite'
import { appLoading, loadingTypes, type AppLoadingOptions } from '../src/index.ts'

const fixtures: string[] = []

afterAll(() => {
  for (const root of fixtures) fs.rmSync(root, { recursive: true, force: true })
})

const defaultHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>fixture</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`

const defaultMain = `import { hideAppLoading } from 'virtual:app-loading'

document.querySelector('#app').textContent = 'ready'
hideAppLoading()
`

interface Fixture {
  html?: string
  files?: Record<string, string>
}

interface BuildResult {
  html: string
  js: string
}

async function buildFixture(
  option: AppLoadingOptions | undefined,
  { html = defaultHtml, files = {} }: Fixture = {},
): Promise<BuildResult> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-plugin-loading-'))
  fixtures.push(root)
  fs.writeFileSync(path.join(root, 'index.html'), html)
  fs.writeFileSync(path.join(root, 'main.js'), defaultMain)
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), content)
  }

  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [appLoading(option)],
    build: { outDir: 'dist', minify: false, modulePreload: false },
  })

  const dist = path.join(root, 'dist')
  const js = fs
    .readdirSync(path.join(dist, 'assets'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => fs.readFileSync(path.join(dist, 'assets', name), 'utf8'))
    .join('\n')

  return { html: fs.readFileSync(path.join(dist, 'index.html'), 'utf8'), js }
}

describe('vite build integration', () => {
  it('injects the stylesheet into the head and the mask before the app root', async () => {
    const { html } = await buildFixture(undefined, {
      html: defaultHtml.replace('</body>', '<div id="before-parent"></div></body>'),
    })

    expect(html).toContain('<div class="v-loader-mask"')
    // 严格 CSP：遮罩不能靠 style 属性定位/上色，nonce 管不到属性。
    expect(html).not.toMatch(/class="v-loader-mask"[^>]*\sstyle=/)
    expect(html).toContain('.v-loader-mask{')
    expect(html.indexOf('v-loader-beat-a')).toBeGreaterThan(html.indexOf('<head'))
    expect(html.indexOf('v-loader-beat-a')).toBeLessThan(html.indexOf('</head>'))
    expect(html.indexOf('class="v-loader-mask"')).toBeLessThan(html.indexOf('id="app"'))
    expect(html.match(/class="v-loader-mask"/g)).toHaveLength(1)
  })

  it('bundles the runtime with the error fallback enabled by default', async () => {
    const { js } = await buildFixture(undefined)
    expect(js).toContain('hideAppLoading')
    expect(js).toContain('unhandledrejection')
    expect(js).toContain('data-app-loading')
  })

  it('ships only the selected animation and prunes the rest', async () => {
    const { html } = await buildFixture({ type: 'bars' })
    expect(html).toContain('@keyframes v-loader-bars-a')
    expect(html).not.toContain('@keyframes v-loader-flip-a')
    expect(html).not.toContain('@keyframes v-loader-progress-a')
    expect(html).toContain('data-app-loading="bars"')
  })

  it('ships no paint-bound animation in the built page', async () => {
    for (const type of loadingTypes) {
      const { html } = await buildFixture({ type })
      expect(html).toContain('aria-hidden="true"><i></i><i></i><i></i>')
      expect(html).not.toContain('background-size:')
      expect(html).not.toContain('background-position')
      expect(html).not.toContain('will-change:background')
    }
  })

  it('keeps the injected stylesheet small', async () => {
    const extractStyle = (html: string): string =>
      html.slice(html.indexOf('<style>'), html.indexOf('</style>'))

    const single = extractStyle((await buildFixture({ type: 'beat' })).html)

    // 只输出所选动画的回归防线。阈值比早期高：遮罩的定位/背景声明从 style 属性挪进了样式表（为了
    // 严格 CSP 下 nonce 能覆盖），页面总量没变，只是记账位置换了。
    expect(single.length).toBeLessThan(2304)
    expect(single).not.toContain('@keyframes v-loader-dot-a')
  })

  it('ships no DOM observation in the built runtime', async () => {
    // fixture 入口是不带任何框架的纯 JS，所以产物里这些字符串只可能来自我们的运行时。
    const { js } = await buildFixture(undefined)
    expect(js).not.toContain('MutationObserver')
    expect(js).not.toContain('requestAnimationFrame')
    expect(js).toContain('hideAppLoading')
  })

  it('resolves a custom template relative to the Vite root and honors the other options', async () => {
    const { html } = await buildFixture(
      { template: 'custom.html', classPrefix: 'acme-loader', themeColor: '#ff0000' },
      { files: { 'custom.html': '<p class="custom-marker">hola</p>' } },
    )
    expect(html).toContain('class="custom-marker"')
    expect(html).toContain('class="acme-loader-mask"')
    expect(html).toContain('data-app-loading="custom"')
    expect(html).toContain('--acme-loader-theme-color:#ff0000')
  })

  it('fails the build when the custom template is missing', async () => {
    await expect(buildFixture({ template: 'nope.html' })).rejects.toThrow(
      /custom template not found/,
    )
  })
})
