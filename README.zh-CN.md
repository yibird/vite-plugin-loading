<div align="center">
  <h1>@starweave-lab/vite-plugin-loading</h1>
  <p>一个用于注入可控应用 Loading 的 Vite 插件</p>
  <p><a href="./README.md">English</a> · <strong>中文</strong></p>
</div>

# @starweave-lab/vite-plugin-loading

为 Vite 应用注入 CSS loading 页面，并在应用启动完成后淡出和移除。

## 安装

```bash
pnpm add -D @starweave-lab/vite-plugin-loading
```

## 配置

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { appLoading } from '@starweave-lab/vite-plugin-loading'

export default defineConfig({
  plugins: [
    appLoading({
      type: 'beat',
      title: '正在加载应用',
      classPrefix: 'v-loader',
      themeColor: 'var(--app-primary-color, #1677ff)',
      maskBackground: true,
    }),
  ],
})
```

所有配置均为可选项，默认 loading 类型为 `beat`。配置值非法时会在 Vite 配置阶段直接报错
（`vite-plugin-loading:` 前缀），而不会被静默忽略。

| 配置             | 类型                                                                                   | 默认值       | 说明                                                  |
| ---------------- | -------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------- |
| `type`           | `'bars' \| 'flip' \| 'beat' \| 'dot' \| 'spinner' \| 'progress' \| 'ring' \| 'ripple'` | `'beat'`     | 内置 loading 动画                                     |
| `template`       | `string`                                                                               | -            | 注入遮罩内部的 HTML 文件，替代 `type`                 |
| `classPrefix`    | `string`                                                                               | `'v-loader'` | 注入的 class、keyframes 和 CSS 变量前缀               |
| `themeColor`     | `string`                                                                               | `'#1677ff'`  | 动画和标题使用的 CSS 颜色                             |
| `maskBackground` | `boolean`                                                                              | `true`       | 是否启用跟随主题色的遮罩渐变                          |
| `title`          | `string`                                                                               | -            | 动画下方的可选 HTML；使用 `template` 时作为无障碍标签 |
| `zIndex`         | `number`                                                                               | `10000`      | 遮罩的层级                                            |
| `timeout`        | `number`                                                                               | `0`          | 超过该毫秒数后隐藏遮罩；`0` 表示不启用                |
| `hideOnError`    | `boolean`                                                                              | `true`       | 页面出现未捕获错误时隐藏遮罩                          |

只输出所选动画，注入的样式表约 2.2 kB（默认 `beat` 经 gzip 压缩后约 0.75 kB）。

`title` 会作为 HTML 原样插入。若其中可能包含不可信内容，请自行转义。

### 动画性能

`bars`、`dot`、`progress`、`ring`、`ripple`、`flip`、`spinner` 都只由 `transform` 与 `opacity` 驱动，因此跑在
合成器线程上；应用产物阻塞主线程期间（也就是遮罩正在显示的那几秒）它们依然保持流畅。`beat` 是例外：
它动画 `border-bottom-right-radius` 来表现落地时的圆角挤压 —— 这是绘制属性、只能留在主线程，已用
`contain: paint` 把它限制在 48×48 的盒子内。所有动画在 `prefers-reduced-motion` 下都会被关闭。

正因如此，遮罩的动画元素下带有五个子元素，未被使用的类型用 `display: none` 隐藏。如果你要覆盖
动画样式，需要一并针对这些子元素。

### 动态主题色

`themeColor` 支持应用 CSS 变量：

```ts
appLoading({
  themeColor: 'var(--app-primary-color, #1677ff)',
})
```

```css
:root {
  --app-primary-color: #1677ff;
}

[data-theme='dark'] {
  --app-primary-color: #6ea8ff;
}
```

插件会保留 `var(...)` 引用。应用修改主题变量后，loading 动画和标题会在显示期间同步更新。

### 渐变遮罩

默认遮罩会把 `themeColor` 与亮色或暗色表面组合成渐变，并自动跟随 `prefers-color-scheme`。将 `maskBackground` 设为 `false` 后会使用相同表面的纯色背景：

```ts
appLoading({
  themeColor: 'var(--app-primary-color, #1677ff)',
  maskBackground: false,
})
```

应用手动切换主题时，可以设置由 `classPrefix` 派生出的遮罩表面变量：

```css
:root {
  --v-loader-mask-color: #fff;
}

:root[data-theme='dark'] {
  --v-loader-mask-color: #101316;
}
```

修改 `--v-loader-mask-color` 或 `themeColor` 引用的变量，当前显示的遮罩都会立即更新。使用其他 `classPrefix` 时，需要同步替换变量名中的 `v-loader`。

## 选择器契约

生成的类名、DOM 结构与 `>i` 槽位属于公开契约。下文的 `{p}` 即 `classPrefix`（默认 `v-loader`）。

```html
<div class="{p}-mask" data-app-loading="beat">
  <!-- 遮罩根节点 -->
  <div class="{p}-content">
    <!-- 居中列；它的 `color` 即主题色 -->
    <div class="{p}-stage">
      <!-- 固定 60x65 的 stage；`overflow: visible` -->
      <span class="{p}-animation" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i>
        <!-- 五个槽位；每种类型只使用其中一部分，其余隐藏 -->
      </span>
    </div>
    <p class="{p}-title">…</p>
    <!-- 可选 -->
  </div>
</div>
```

每种类型只使用一部分槽位，其余保持 `display: none`，因此只占 DOM 节点、不产生额外的视觉开销：

| 类型       | 使用的槽位                             | stage 内的盒子 |
| ---------- | -------------------------------------- | -------------- |
| `bars`     | 全部 5 个                              | 50×34          |
| `dot`      | 前 3 个                                | 60×30          |
| `progress` | 第 1 个                                | 120×20         |
| `ring`     | 第 1 个（另有 `::before` / `::after`） | 48×48          |
| `ripple`   | 第 1 个（另有 `::before` / `::after`） | 64×64          |
| `beat`     | 无 —— 元素本身与伪元素即动画           | 48×48          |
| `flip`     | 无                                     | 48×48          |
| `spinner`  | 无                                     | 50×50          |

内置模板的内容块整体以 `scale: 1.25` 渲染。上表以及 60×65 的 stage 都是基础尺寸，实际渲染尺寸
为这些数值的 1.25 倍。

可以安全修改的内容：

- **自定义属性**：`--{p}-theme-color`、`--{p}-mask-color`、`--{p}-auto-mask-color`、
  `--{p}-progress-mask`，均已在上面说明。
- **尺寸**：插件没有尺寸选项。可在 `.${p}-stage` 与 `.${p}-animation`（以及槽位元素）上覆盖盒子
  尺寸。`progress` 是例外且天然安全：它的 mask tile 是 bar 的 `20%`，缩放 bar 时 tile 会同步缩放，
  `steps(6)` 仍然每步推进一个色块。`beat` 的 stage 之所以是 `65px` 高，是因为它的阴影位于
  `top: 60px`，调整这个类型时要格外小心。
- **槽位固定为五个。** 需要不同 DOM 结构的动画必须修改生成的标记，不能只通过类型注册表新增。

覆盖这些内部类是被支持的，但它们属于契约而非实现细节 —— 修改它们属于破坏性变更。

### Progress 色块形状

`progress` 通过 mask 从一根缩放条上裁出色块，因此色块形状定义在 mask 中，而不是
`border-radius`。该 mask 是一个 24px 的 tile，内部是 16.8px、圆角 4px 的色块，通过
`--v-loader-progress-mask` 暴露：

```css
:root {
  /* 比默认 4px 更圆的色块 */
  --v-loader-progress-mask: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='24'%20height='20'%3E%3Crect%20width='16.8'%20height='20'%20rx='7'%20fill='%23fff'/%3E%3C/svg%3E");
}
```

保持 tile 宽度为 24px。`steps(6)` 与 `scaleX(1.2)` 让填充每步正好推进一个 tile，因此修改 tile
宽度会与色块对齐错位。

### 自定义模板

内置动画不满足需求时，可以传入本地 HTML 文件路径：

```ts
appLoading('./loading.html')
```

路径基于 Vite `root` 解析，因此 `--root`、monorepo 目录结构以及编程式 `createServer()` 都能得到
一致的结果。它可以和其他配置组合使用，方便为自定义模板配置主题：

```ts
appLoading({
  template: './loading.html',
  classPrefix: 'acme-loader',
  themeColor: 'var(--app-primary-color, #1677ff)',
  title: '正在准备工作台', // 作为无障碍标签使用
})
```

文件内容会被注入 loading 遮罩，并视为可信的构建输入，因此只应使用由应用自身维护的模板。文件会在每次
HTML 转换时重新读取并注册到 dev server 的 watcher，修改后无需重启。路径不存在时，插件会在 Vite
配置阶段报错，而不会静默回退到内置动画。

### 失败兜底

遮罩是全屏覆盖层，因此"应用始终没启动完成"的场景不能把用户永久锁住：

- `hideOnError`（默认 `true`）：应用产物加载后，页面出现未捕获错误或未处理的 Promise 拒绝时移除
  遮罩，覆盖渲染抛错、顶层 import 报错、动态 import 失败等情况。
- `timeout` 需要显式开启。当你更希望露出"尚未完全就绪"的界面而不是继续等待时可以设置，例如
  `timeout: 15000`。默认关闭，因为把健康但缓慢的启动提前打断通常比继续等待更糟。

如果应用产物完全没有执行（例如入口 chunk 下载失败），以上两种兜底都无能为力，这种情况需要开启
`timeout` 才能覆盖。

```ts
appLoading({ hideOnError: true, timeout: 15000 })
```

## 在准确的时机隐藏

最准确的信号就是在应用真正就绪的那一刻调用 `hideAppLoading()`。这个时刻取决于你的应用如何定义
"就绪"：

| 应用形态                | 准确时机                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Vue + Vue Router        | `await router.isReady()` 之后再 `mount()`，然后 `hideAppLoading()`。`isReady()` 在初始导航完成后 resolve，包含懒加载路由 chunk 的解析 |
| Vue 无路由              | `app.mount('#app')` 之后 `await nextTick()`                                                                                           |
| Vue 首屏要等接口        | 首屏所需数据到位之后                                                                                                                  |
| React                   | 代表"就绪"的那层组件的 `useEffect` 里，即最外层 `Suspense` 内子树首次 commit 之后                                                     |
| React Router 6.4 及以上 | `useNavigation().state === 'idle'` 时，即 data router 的 loader 全部结束                                                              |

```ts
const app = createApp(App)
app.use(router)
await router.isReady()
app.mount('#app')
hideAppLoading()
```

隐藏始终由应用驱动。插件不会自行判断应用已就绪，也不会从 DOM 活动去推测：懒加载路由下应用外壳会立刻
渲染，而路由 chunk 仍在下载，任何这类启发式都会过早触发。下面的 `hideOnError` 与 `timeout` 只用于避免
启动失败时把用户困在遮罩里，而不是用来猜一个健康的应用什么时候加载完。

## 隐藏 Loading

虚拟模块只导出 `hideAppLoading`：

```ts
import { hideAppLoading } from 'virtual:app-loading'

await bootstrapApp()
hideAppLoading()
```

在 `global.d.ts` 中开启 TypeScript 类型：

```ts
/// <reference types="@starweave-lab/vite-plugin-loading/client" />
```

## 运行时 API

| 导出                       | 说明                                           |
| -------------------------- | ---------------------------------------------- |
| `hideAppLoading()`         | 淡出并移除遮罩，遮罩不存在时调用也安全         |
| `data-app-loading`         | 当前动画类型属性，用于限定动画 CSS 的作用域    |
| `data-app-loading-preview` | 带有该属性的元素不会被 `hideAppLoading()` 处理 |
| `data-app-loading-hidden`  | 隐藏进行中时写在遮罩上，保证重复调用幂等       |

`data-app-loading-preview` 适合应用自行渲染遮罩预览的场景：这类元素永远不会被淡出或移除，同时
`hideAppLoading()` 依然会作用于真正的遮罩。需要重放遮罩时，克隆后要把隐藏状态整体撤销：移除
`data-app-loading-hidden`、还原内联的 `opacity` / `pointer-events` / `will-change`、并移除
`aria-hidden`。两个示例里的 `cloneLoading()` 就是这么做的。

包内还导出了辅助内容，供工具链和应用代码使用。应用代码请从 `@starweave-lab/vite-plugin-loading/animation`
导入：包根入口是仅限 Node 的，在应用里从包根导入运行时会值会把插件打进客户端产物。

```ts
// vite.config.ts 等 Node 工具链
import { appLoading, loadingTypes } from '@starweave-lab/vite-plugin-loading'

// 应用代码
import {
  isLoadingType,
  loadingTypes,
  type LoadingType,
} from '@starweave-lab/vite-plugin-loading/animation'

loadingTypes // ['bars', 'flip', 'beat', 'dot', 'spinner', 'progress', 'ring', 'ripple']
isLoadingType(value) // 将 unknown 收窄为 LoadingType
```

`createLoadingTemplate()` 也从 `@starweave-lab/vite-plugin-loading/animation` 导出。它返回某一类型的标记与样式
（`{ css, html }`），两个示例就是用它在不带遮罩外层的情况下渲染动画画廊。

属性名也作为常量导出：`appLoadingAttribute`、`appLoadingHiddenAttribute`、
`appLoadingPreviewAttribute`。

在应用代码中导入 `animation` 会把它打包进该应用，此时应把包声明为常规依赖；只在配置中使用时
声明为 devDependency 即可。

## 示例项目

- [`example/vue`](./example/vue)：Vue 3 Composition API 示例
- [`example/react`](./example/react)：React 19 示例

两个示例都只使用一个 `dev` 命令，并展示全部 8 种内置动画、重放、动态主题色以及亮色/暗色/系统遮罩。

## 发布检查

```bash
pnpm exec playwright install chromium   # 首次跑浏览器测试前执行一次
pnpm release:check
```

该命令会执行格式检查、代码检查、单元与集成测试、浏览器渲染测试、插件与示例构建、npm 包内容校验
以及 `publint`。

浏览器测试（`pnpm test:browser`）会在 Chromium 里真实渲染 8 种动画，并把动画冻结在固定帧上，因此
断言的是真实渲染而不是字符串：`progress` 的每一步都落在 `mask` tile 的边界上、SVG mask 能栅格化且
两侧内缩对称、每种类型恰好渲染它需要的子元素、除 `beat` 已知的圆角挤压外没有任何动画改绘制属性。
另有 8 张截图基线守卫视觉回归。基线按平台存放（`bars-win32.png`、`beat-win32.png` 等），Linux CI 上需要先
`pnpm test:browser --update-snapshots` 生成该平台自己的基线。

## License

MIT
