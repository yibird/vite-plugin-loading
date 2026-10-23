<div align="center">
  <h1>@starweave-lab/vite-plugin-loading</h1>
  <p>Inject a CSS loading screen into Vite HTML and remove it after application bootstrap</p>
  <p><a href="./README.zh-CN.md">中文</a> · <strong>English</strong></p>
</div>

# @starweave-lab/vite-plugin-loading

Inject a CSS application loading screen into Vite HTML and remove it after application bootstrap.

## Install

```bash
pnpm add -D @starweave-lab/vite-plugin-loading
```

## Configure

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { appLoading } from '@starweave-lab/vite-plugin-loading'

export default defineConfig({
  plugins: [
    appLoading({
      type: 'beat',
      title: 'Preparing application',
      classPrefix: 'v-loader',
      themeColor: 'var(--app-primary-color, #1677ff)',
      maskBackground: true,
    }),
  ],
})
```

All options are optional. The default loading type is `beat`. Invalid option values fail the Vite
configuration step with a `vite-plugin-loading:` error instead of being silently ignored.

| Option           | Type                                                                                   | Default      | Description                                                             |
| ---------------- | -------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| `type`           | `'bars' \| 'flip' \| 'beat' \| 'dot' \| 'spinner' \| 'progress' \| 'ring' \| 'ripple'` | `'beat'`     | Built-in loading animation                                              |
| `template`       | `string`                                                                               | -            | HTML file injected inside the mask; replaces `type`                     |
| `classPrefix`    | `string`                                                                               | `'v-loader'` | Prefix for injected classes, keyframes, and CSS variables               |
| `themeColor`     | `string`                                                                               | `'#1677ff'`  | CSS color used by the animation and title                               |
| `maskBackground` | `boolean`                                                                              | `true`       | Enable a mask gradient derived from the theme color                     |
| `title`          | `string`                                                                               | -            | Optional HTML below the animation; the accessible label with `template` |
| `zIndex`         | `number`                                                                               | `10000`      | Stacking order of the mask                                              |
| `timeout`        | `number`                                                                               | `0`          | Hide the mask after this many ms; `0` disables the timer                |
| `hideOnError`    | `boolean`                                                                              | `true`       | Hide the mask when the page reports an uncaught error                   |

Only the selected animation is emitted, which keeps the injected stylesheet at roughly 2.2 kB
(about 0.75 kB gzipped for the default `beat` animation).

`title` is inserted as HTML. Escape it yourself if it may contain untrusted content.

### Animation Performance

`bars`, `dot`, `progress`, `ring`, `ripple`, `flip` and `spinner` are driven by `transform` and `opacity`
alone, so the browser runs them on the compositor and they keep moving smoothly while the
application bundle is still blocking the main thread — which is exactly when the mask is on screen.
`beat` is the exception: it animates `border-bottom-right-radius` to squash its corner on impact,
which is a paint property and therefore stays on the main thread, bounded to its 48×48 box with
`contain: paint`. Everything is switched off under `prefers-reduced-motion`.

This is why the mask markup contains five child elements per animation and the unused ones are
hidden with `display: none`. If you override the animation styles, target those children too.

### Dynamic Theme Color

Use an application CSS variable as `themeColor`:

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

Because the plugin preserves the `var(...)` reference, changing the application variable updates the loading animation and title while the loading screen is visible.

### Gradient Mask

By default, the mask gradient combines `themeColor` with a light or dark surface. It follows `prefers-color-scheme` automatically. Set `maskBackground` to `false` to use the same surface as a solid color:

```ts
appLoading({
  themeColor: 'var(--app-primary-color, #1677ff)',
  maskBackground: false,
})
```

For an application-controlled theme, set the mask surface variable derived from `classPrefix`:

```css
:root {
  --v-loader-mask-color: #fff;
}

:root[data-theme='dark'] {
  --v-loader-mask-color: #101316;
}
```

Changing `--v-loader-mask-color` or the configured `themeColor` variable updates the visible mask immediately. With another `classPrefix`, replace `v-loader` in the variable name.

## Selector Contract

The generated class names, the DOM shape and the `>i` slots are a public contract. `{p}` below is
`classPrefix` (`v-loader` by default).

```html
<div class="{p}-mask" data-app-loading="beat">
  <!-- mask root -->
  <div class="{p}-content">
    <!-- centered column; its `color` is the theme colour -->
    <div class="{p}-stage">
      <!-- fixed 60x65 stage; `overflow: visible` -->
      <span class="{p}-animation" aria-hidden="true">
        <i></i><i></i><i></i><i></i><i></i>
        <!-- five slots; each type uses some and hides the rest -->
      </span>
    </div>
    <p class="{p}-title">…</p>
    <!-- optional -->
  </div>
</div>
```

Each type owns a subset of the slots; the rest stay `display: none`, so they cost nothing but DOM
nodes:

| Type       | Slots used                                                   | Box inside the stage |
| ---------- | ------------------------------------------------------------ | -------------------- |
| `bars`     | all 5                                                        | 50×34                |
| `dot`      | first 3                                                      | 60×30                |
| `progress` | first 1                                                      | 120×20               |
| `ring`     | first 1 (plus `::before` / `::after`)                        | 48×48                |
| `ripple`   | first 1 (plus `::before` / `::after`)                        | 64×64                |
| `beat`     | none — the element and its pseudo-elements are the animation | 48×48                |
| `flip`     | none                                                         | 48×48                |
| `spinner`  | none                                                         | 50×50                |

What is safe to change:

- **Custom properties**: `--{p}-theme-color`, `--{p}-mask-color`, `--{p}-auto-mask-color`,
  `--{p}-progress-mask`, all documented above.
- **Sizes**: there is no size option on the plugin. Override the box on `.${p}-stage` and
  `.${p}-animation` (and the slot elements). `progress` is the exception that is safe by
  construction: its mask tile is `20%` of the bar, so resizing the bar scales the tile with it and
  `steps(6)` still advances exactly one block per step. `beat`'s stage is `65px` tall specifically
  because its shadow sits at `top: 60px`; resize that one with care.
- **Slots are fixed at five.** An animation that needs a different DOM shape has to change the
  generated markup; it cannot be added through the type registry alone.

Overriding these internal classes is supported, but they are a contract rather than an
implementation detail — a change to them is a breaking change.

### Progress Block Shape

`progress` cuts its blocks out of one scaling bar with a mask, so the block shape lives in the mask
rather than in a `border-radius`. That mask is a 24px tile holding a 16.8px block with a 4px corner
radius, exposed as `--v-loader-progress-mask`:

```css
:root {
  /* a rounder block than the default 4px */
  --v-loader-progress-mask: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='24'%20height='20'%3E%3Crect%20width='16.8'%20height='20'%20rx='7'%20fill='%23fff'/%3E%3C/svg%3E");
}
```

Keep the tile 24px wide. `steps(6)` and `scaleX(1.2)` advance the fill by exactly one tile per step,
so changing the tile width would drift out of alignment with the blocks.

### Custom Template

Pass a local HTML file path when the built-in animations are not suitable:

```ts
appLoading('./loading.html')
```

The path is resolved against the Vite `root`, so `--root`, monorepo layouts, and programmatic
`createServer()` calls all agree on its location. It composes with the other options, which is handy
for theming a custom template:

```ts
appLoading({
  template: './loading.html',
  classPrefix: 'acme-loader',
  themeColor: 'var(--app-primary-color, #1677ff)',
  title: 'Preparing your workspace', // used as the accessible label
})
```

The file contents are injected inside the loading mask and are trusted build input, so only use a
template controlled by the application. The file is re-read on every HTML transform and registered
with the dev-server watcher, so edits apply without a restart. A missing path fails the Vite
configuration step instead of silently falling back to a built-in animation.

### Failing Safely

The mask is a full-screen overlay, so a bootstrap that never completes must not be able to trap the
user:

- `hideOnError` (default `true`) removes the mask when the page reports an uncaught error or an
  unhandled rejection once the application bundle has loaded — a thrown render error, a top-level
  import that throws, or a dynamic import that rejects.
- `timeout` is opt-in. Set it when you would rather reveal a partially ready app than keep the
  loading screen, for example `timeout: 15000`. It is off by default because hiding a healthy but
  slow bootstrap is usually worse than waiting.

Neither fallback can help when the application bundle never executes at all, for example when the
entry chunk fails to download. Use `timeout` if that case must be covered.

```ts
appLoading({ hideOnError: true, timeout: 15000 })
```

## Hiding at the Right Moment

The most accurate signal is `hideAppLoading()` called at the moment your application is actually
ready. Where that moment is depends on what "ready" means for your app:

| App shape                 | Accurate moment                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue + Vue Router          | `await router.isReady()` before `mount()`, then `hideAppLoading()`. `isReady()` resolves after the initial navigation, which includes resolving a lazy route chunk. |
| Vue without a router      | after `app.mount('#app')` and `await nextTick()`                                                                                                                    |
| Vue waiting on first data | after the data the first screen needs has arrived                                                                                                                   |
| React                     | in the `useEffect` of the component that represents "ready" — ie the first commit of the tree inside your outermost `Suspense`                                      |
| React Router 6.4 or later | when `useNavigation().state === 'idle'`, ie once the data router's loaders have settled                                                                             |

```ts
const app = createApp(App)
app.use(router)
await router.isReady()
app.mount('#app')
hideAppLoading()
```

Hiding is always driven by the application. The plugin never decides on its own that the app is
ready, and it never infers readiness from DOM activity: with a lazy-loaded route the application
shell renders immediately while the route chunk is still downloading, so any such heuristic would
fire too early. `hideOnError` and `timeout` below exist only to stop a broken bootstrap from
trapping the user, not to guess when a healthy app has finished.

## Hide Loading

The virtual module only exports `hideAppLoading`:

```ts
import { hideAppLoading } from 'virtual:app-loading'

await bootstrapApp()
hideAppLoading()
```

Enable its TypeScript declaration in `global.d.ts`:

```ts
/// <reference types="@starweave-lab/vite-plugin-loading/client" />
```

## Runtime API

| Export                     | Description                                                             |
| -------------------------- | ----------------------------------------------------------------------- |
| `hideAppLoading()`         | Fades out the mask and removes it. Safe to call when no mask is present |
| `data-app-loading`         | Attribute holding the active animation type, used to scope the CSS      |
| `data-app-loading-preview` | Attribute that opts an element out of `hideAppLoading()`                |
| `data-app-loading-hidden`  | Set on the mask while a hide is in flight; makes hiding idempotent      |

`data-app-loading-preview` is useful when an application renders its own preview of the mask: such
elements are never faded out or removed, and `hideAppLoading()` still targets the real mask. To
replay the mask, clone it and undo the hide: remove `data-app-loading-hidden`, reset the inline
`opacity` / `pointer-events` / `will-change`, and remove `aria-hidden`. The example projects'
`cloneLoading()` does exactly that.

The package also exposes helpers for tooling and application code. Use
`@starweave-lab/vite-plugin-loading/animation` from application code: the package root is Node-only, so
importing runtime values from it inside an app would pull the plugin into the client bundle.

```ts
// vite.config.ts and other Node tooling
import { appLoading, loadingTypes } from '@starweave-lab/vite-plugin-loading'

// application code
import {
  isLoadingType,
  loadingTypes,
  type LoadingType,
} from '@starweave-lab/vite-plugin-loading/animation'

loadingTypes // ['bars', 'flip', 'beat', 'dot', 'spinner', 'progress', 'ring', 'ripple']
isLoadingType(value) // narrows unknown to LoadingType
```

`createLoadingTemplate()` is also exported from `@starweave-lab/vite-plugin-loading/animation`. It returns the
built-in markup and CSS for one type (`{ css, html }`), which is what the examples use to render
their animation galleries without the mask wrapper.

The attribute names are exported as constants too: `appLoadingAttribute`,
`appLoadingHiddenAttribute`, and `appLoadingPreviewAttribute`.

Importing `animation` in application code bundles it into that app, so list the package as a
regular dependency when you do; a dev dependency is enough for configuration-only usage.

## Examples

- [`example/vue`](./example/vue): Vue 3 Composition API example
- [`example/react`](./example/react): React 19 example

Both examples use one `dev` command and show all eight built-in animations, replay, dynamic theme colors, and light/dark/system mask surfaces.

## Release Checks

```bash
pnpm exec playwright install chromium   # once, before the browser tests
pnpm release:check
```

This runs formatting, linting, unit and integration tests, browser rendering tests, library and
example builds, package-content validation, and `publint`.

The browser tests (`pnpm test:browser`) render all eight animations in Chromium with the animations
frozen at a fixed frame, so the checks are real rendering rather than string matching: the
`progress` steps land on `mask` tile boundaries, the SVG mask rasterises with symmetric insets, each
type renders exactly the child elements it needs, and no animation touches a paint property except
`beat`'s documented corner squash. Eight screenshot baselines guard against visual regressions.
Baselines are per-platform (`bars-win32.png`, `beat-win32.png`, …), so a Linux CI run needs
`pnpm test:browser --update-snapshots` once to create its own.

## License

MIT
