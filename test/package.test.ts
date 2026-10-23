import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

/**
 * 打包端到端：拿 `npm pack` 真正的发布文件清单，还原成 node_modules 布局，在一个全新项目里跑一次
 * 真实构建。
 *
 * 这一层覆盖的是其它测试碰不到的地方：`files` 字段漏文件、`exports` 映射解析不到、子路径把
 * `node:fs` 拖进客户端产物。publint 只校验映射本身，示例项目走的是 workspace 软链，都不经过打包产物。
 */

const repoRoot = path.resolve(import.meta.dirname, '..')
const packageName = '@starweave-lab/vite-plugin-loading'
const scratchDirs: string[] = []

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    // Windows 上 npm/pnpm 是 .cmd，直接 execFile 起不来。
    shell: process.platform === 'win32',
  })
}

interface PackedFile {
  path: string
  size: number
}

let publishedFiles: PackedFile[] = []

function readPublishedFiles(): PackedFile[] {
  // `--ignore-scripts` 不能省：否则会触发 package.json 的 prepare（往 .git 里装 git hooks）。
  const output = run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], repoRoot)
  // npm 偶尔会在 JSON 前后夹一些输出，按最外层方括号切。
  const json = output.slice(output.indexOf('['), output.lastIndexOf(']') + 1)
  const parsed = JSON.parse(json) as [{ files: PackedFile[] }]
  const files = parsed[0]?.files
  if (!files) throw new Error(`npm pack 没有返回文件清单：${output.slice(0, 200)}`)
  return files
}

beforeAll(() => {
  // 发布的是 dist 的产物，先重建一次，否则测的是上一次构建的残留。
  run('pnpm', ['exec', 'tsdown'], repoRoot)
  publishedFiles = readPublishedFiles()
}, 120_000)

afterAll(() => {
  for (const directory of scratchDirs) fs.rmSync(directory, { recursive: true, force: true })
})

describe('发布产物', () => {
  it('把每个入口与共享 chunk 都打进了包里', () => {
    const paths = publishedFiles.map((file) => file.path)

    expect(paths).toContain('package.json')
    expect(paths).toContain('client.d.ts')
    expect(paths).toContain('README.md')
    expect(paths).toContain('LICENSE')
    expect(paths).toContain('dist/index.mjs')
    expect(paths).toContain('dist/index.d.mts')
    expect(paths).toContain('dist/animation.mjs')
    expect(paths).toContain('dist/animation.d.mts')

    // rolldown 会把共享模块抽成一个带内容哈希的 chunk，入口 import 它。漏掉它的话发布出去的包
    // 一 import 就 404 —— `files` 写的是整个 dist，所以这里守的是"别把 dist 改成白名单"。
    const chunk = paths.filter((file) => /^dist\/animation-[\w-]+\.mjs$/.test(file))
    expect(chunk).toHaveLength(1)
  })

  it('插件入口不在运行时依赖 vite', () => {
    const index = fs.readFileSync(path.join(repoRoot, 'dist/index.mjs'), 'utf8')
    // `import type { Plugin } from 'vite'` 必须在构建时被抹掉，否则消费方得先装 vite 才能加载配置。
    expect(index).not.toMatch(/from\s+["']vite["']/)
    expect(index).toMatch(/from\s+["']node:fs["']/)
  })
})

/** 把发布文件按 npm 安装后的布局解到临时项目里。整个过程不需要联网。 */
function createConsumerProject(): string {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'vpl-consumer-'))
  scratchDirs.push(project)
  const installed = path.join(project, 'node_modules', packageName)

  for (const file of publishedFiles) {
    const target = path.join(installed, file.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(repoRoot, file.path), target)
  }

  fs.writeFileSync(
    path.join(project, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module' }, null, 2),
  )
  return project
}

/** 用仓库自带的 vite 构建临时项目，返回产物 HTML 与客户端 JS。 */
function buildConsumer(project: string): { html: string; js: string } {
  // root 是临时目录，所以配置里的 `vite-plugin-loading` 从临时项目的 node_modules 解析 ——
  // 也就是发布文件本身。
  run('node', [path.join(repoRoot, 'node_modules/vite/bin/vite.js'), 'build'], project)

  const html = fs.readFileSync(path.join(project, 'dist/index.html'), 'utf8')
  const js = fs
    .readdirSync(path.join(project, 'dist/assets'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => fs.readFileSync(path.join(project, 'dist/assets', name), 'utf8'))
    .join('\n')
  return { html, js }
}

describe('在全新项目里安装并构建', () => {
  it('装得上，且构建产出的 HTML 与运行时都正确', async () => {
    const project = createConsumerProject()
    fs.writeFileSync(
      path.join(project, 'index.html'),
      '<!doctype html><html><head><title>consumer</title></head>' +
        '<body><div id="app"></div><script type="module" src="/main.js"></script></body></html>',
    )
    // 应用代码同时用虚拟模块和子路径：子路径能被解析并打进产物，才算 exports 映射真的通。
    fs.writeFileSync(
      path.join(project, 'main.js'),
      "import { hideAppLoading } from 'virtual:app-loading'\n" +
        "import { loadingTypes } from '@starweave-lab/vite-plugin-loading/animation'\n" +
        'document.title = `${loadingTypes.length} types`\n' +
        "document.querySelector('#app').textContent = 'ready'\n" +
        'hideAppLoading()\n',
    )
    // 配置文件把两个入口都 import 一遍：任何一个 exports 映射写错，构建就会在打包配置时报错，
    // 所以"构建能过"本身就是这两条入口的解析证明。
    fs.writeFileSync(
      path.join(project, 'vite.config.mjs'),
      "import { appLoading, loadingTypes } from '@starweave-lab/vite-plugin-loading'\n" +
        "import { isLoadingType } from '@starweave-lab/vite-plugin-loading/animation'\n" +
        'export const entries = [loadingTypes.length, isLoadingType]\n' +
        'export default {\n' +
        // 标题带 `&`：用来验证最终 HTML 里的属性只被转义一次（双重转义会把实体文本念给读屏）。
        "  plugins: [appLoading({ type: 'ring', title: 'consumer & ready' })],\n" +
        '  build: { outDir: ' +
        "'dist'" +
        ', minify: false },\n' +
        '}\n',
    )

    const { html, js } = buildConsumer(project)
    expect(html).toContain('data-app-loading="ring"')
    expect(html).toContain('@keyframes v-loader-ring-a')
    expect(html.indexOf('@keyframes')).toBeLessThan(html.indexOf('</head>'))
    expect(html.indexOf('data-app-loading="ring"')).toBeLessThan(html.indexOf('id="app"'))
    // 属性值由 Vite 序列化时转义一次：最终 HTML 里是 `&amp;`，浏览器解析后是 `&`。
    expect(html).toContain('aria-label="consumer &amp; ready"')
    expect(html).not.toContain('&amp;#38;')
    // 标题文字按传入值原样渲染，转义由使用者负责。
    expect(html).toContain('<p class="v-loader-title">consumer & ready</p>')

    expect(js).toContain('hideAppLoading')
    // 应用代码从子路径拿到了 `loadingTypes`（数组里含 ripple），说明 `animation` 这个 exports
    // 映射在打包产物上真的解析成功 —— 示例项目走的是 workspace 软链，覆盖不到这里。
    expect(js).toContain('ripple')
    // 只导入枚举/校验不该拖着 8 套模板字符串：名称列表与模板注册表是分开定义的，所以能摇掉。
    expect(js).not.toContain('rippleTemplate')
  }, 120_000)
})
