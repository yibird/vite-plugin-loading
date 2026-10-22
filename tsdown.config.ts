import { defineConfig } from 'tsdown'

export default defineConfig({
  // `index` 是仅限 Node 的插件入口。`animation` 是浏览器安全的，应用代码可以借它枚举动画
  // 类型，而不会把 `node:fs` 拖进客户端产物。
  entry: ['src/index.ts', 'src/animation.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // 这个包只会作为构建期依赖跑在 Node 里，压缩没有收益，反而让报错的堆栈难以阅读。
  // 输出可读代码 + sourcemap。
  minify: false,
  sourcemap: true,
  outDir: 'dist',
  deps: {
    neverBundle: ['vite', /^node:/],
  },
})
