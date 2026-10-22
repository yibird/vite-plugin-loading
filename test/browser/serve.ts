import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

export const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

/** 浏览器里要渲染的类型，顺序与 `loadingTypes` 一致。 */
export const fixtureTypes = [
  'bars',
  'flip',
  'beat',
  'dot',
  'spinner',
  'progress',
  'ring',
  'ripple',
] as const

const fixtureRoot = path.join(repoRoot, 'test/browser/.fixture')

/**
 * 用真实插件为每种动画各跑一次 Vite 构建，得到 8 个注入了遮罩的页面。
 *
 * 这样浏览器里跑的就是发布路径产出物：插件注入的 HTML + CSS，而不是手工拼的标记。插件每次只输出
 * 所选动画，所以每种类型需要独立构建，不能再靠运行时切换共用一份样式表。
 */
export async function buildFixture(): Promise<void> {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })

  for (const type of fixtureTypes) {
    const root = path.join(fixtureRoot, type)
    fs.mkdirSync(root, { recursive: true })

    fs.writeFileSync(
      path.join(root, 'index.html'),
      '<!doctype html><html><head><title>render fixture</title></head>' +
        '<body><div id="app"></div><script type="module" src="/main.js"></script></body></html>',
    )
    // 应用不做任何事，也不调用 hideAppLoading —— 遮罩要留在页面上给测试用。
    fs.writeFileSync(path.join(root, 'main.js'), "document.body.dataset.ready = '1'\n")
    const pluginPath = path
      .relative(root, path.join(repoRoot, 'dist/index.mjs'))
      .replaceAll('\\', '/')

    fs.writeFileSync(
      path.join(root, 'vite.config.mjs'),
      `import { appLoading } from ${JSON.stringify(pluginPath)}\n` +
        'export default {\n' +
        `  plugins: [appLoading({ type: '${type}' })],\n` +
        // 产物以各自子目录提供服务，资源必须用相对路径。
        "  base: './',\n" +
        "  build: { outDir: 'dist', minify: false },\n" +
        '}\n',
    )

    await build({
      root,
      configFile: path.join(root, 'vite.config.mjs'),
      logLevel: 'silent',
    })
  }
}

const contentTypes: Record<string, string> = {
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.map': 'application/json',
  '.css': 'text/css',
}

export interface FixtureServer {
  origin: string
  close(): Promise<void>
}

/**
 * 起一个只服务构建产物的静态服务器。之所以不用 `file://`：产物里的模块是 ES module，
 * `file://` 下会被 CORS 拦住。
 */
export async function startServer(): Promise<FixtureServer> {
  // 路径形如 `/<type>/` 或 `/<type>/assets/…`，映射到对应类型的构建产物目录。
  const server = http.createServer((request, response) => {
    const url = (request.url ?? '/').split('?')[0] ?? '/'
    const [type, ...rest] = url.split('/').filter(Boolean)
    const dist = path.join(fixtureRoot, type ?? '', 'dist')
    const file = path.join(dist, rest.length ? rest.join('/') : 'index.html')

    // 路径必须落在该类型的 dist 内（同时也是防目录穿越）。
    if (!type || !file.startsWith(dist)) {
      response.writeHead(403)
      response.end()
      return
    }

    fs.readFile(file, (error, contents) => {
      if (error) {
        response.writeHead(404)
        response.end()
        return
      }
      response.writeHead(200, {
        'content-type': contentTypes[path.extname(file)] ?? 'text/html; charset=utf-8',
      })
      response.end(contents)
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('server has no port')

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
