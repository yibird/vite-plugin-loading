import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import type { HtmlTagDescriptor } from 'vite'
import { appLoading, loadingTypes, type AppLoadingOptions } from '../src/index.ts'

const html =
  '<!doctype html><html><head><title>Demo</title></head><body><div id="app"></div></body></html>'

interface PluginHooks {
  configResolved?: (config: { root: string }) => void
  load: (id: string) => string | undefined
  resolveId: (id: string) => string | undefined
  transformIndexHtml: {
    order: string
    handler: (
      value: string,
      ctx?: { server?: { watcher: { add: (file: string) => void } } },
    ) => string | { html: string; tags: HtmlTagDescriptor[] }
  }
}

function pluginFor(option?: AppLoadingOptions, root = process.cwd()): PluginHooks {
  const plugin = appLoading(option) as unknown as PluginHooks
  plugin.configResolved?.({ root })
  return plugin
}

interface Rendered {
  css: string
  attrs: Record<string, string>
  content: string
  tags: HtmlTagDescriptor[]
}

function render(option?: AppLoadingOptions, source = html): Rendered {
  const result = pluginFor(option).transformIndexHtml.handler(source)
  if (typeof result === 'string') throw new Error('expected tag injection, got a plain HTML string')

  const style = result.tags.find((tag) => tag.tag === 'style')
  const mask = result.tags.find((tag) => tag.tag === 'div')
  if (!style || !mask) throw new Error('missing injected tags')

  return {
    css: String(style.children),
    attrs: (mask.attrs ?? {}) as Record<string, string>,
    content: String(mask.children),
    tags: result.tags,
  }
}

/**
 * 动画名 -> 它被允许动画的属性。除 `beat-a`（保留绘制式的圆角挤压）外全部是可合成属性：
 * 绘制属性动画必须由主线程逐帧处理，bootstrap 的长任务一阻塞它就会卡顿。
 */
const animatedProperties: Record<string, string[]> = {
  'bars-a': ['opacity', 'transform'],
  'flip-a': ['transform'],
  'beat-a': ['border-bottom-right-radius', 'transform'],
  'beat-s': ['transform'],
  'dot-a1': ['transform'],
  'dot-a2': ['transform'],
  'dot-a3': ['transform'],
  'spinner-a': ['transform'],
  'progress-a': ['transform'],
  'ring-a': ['transform'],
  'ring-core': ['opacity', 'transform'],
  'ripple-a': ['opacity', 'transform'],
}

function keyframesBody(css: string, name: string): string {
  const header = `@keyframes ${name}{`
  const start = css.indexOf(header)
  if (start === -1) throw new Error(`missing @keyframes ${name}`)
  // 块结束于最后一个关键帧之后，也就是整张样式表里第一个 `}}`。
  const end = css.indexOf('}}', start + header.length)
  if (end === -1) throw new Error(`unterminated @keyframes ${name}`)
  return css.slice(start + header.length, end + 1)
}

function animatedProps(css: string, name: string): string[] {
  const declarations = [...keyframesBody(css, name).matchAll(/([a-z-]+)\s*:/g)].map(
    (match) => match[1]!,
  )
  return [...new Set(declarations)].sort()
}

describe('vite-plugin-loading markup', () => {
  it('injects the default beat mask', () => {
    const { attrs, content } = render()
    expect(attrs['data-app-loading']).toBe('beat')
    expect(attrs.class).toBe('v-loader-mask')
    expect(attrs.role).toBe('status')
    expect(attrs['aria-label']).toBe('Loading')
    expect(content).toContain('class="v-loader-animation"')
    expect(content).not.toContain('v-loader-title')
  })

  it('renders the default stylesheet', () => {
    expect(render().css).toMatchInlineSnapshot(
      `".v-loader-content{display:grid;place-items:center;gap:24px;color:var(--v-loader-theme-color);scale:1.25}.v-loader-stage{width:60px;height:65px;display:grid;place-items:center;overflow:visible}[data-app-loading=beat] .v-loader-stage{place-items:start center}.v-loader-animation{display:block}.v-loader-animation>i{display:none}[data-app-loading=beat] .v-loader-animation{width:48px;height:48px;position:relative;overflow:visible}[data-app-loading=beat] .v-loader-animation::before,[data-app-loading=beat] .v-loader-animation::after{content:'';position:absolute;left:0;width:100%;background:currentColor}[data-app-loading=beat] .v-loader-animation::before{height:5px;opacity:.25;top:60px;border-radius:50%;will-change:transform;animation:v-loader-beat-s .5s linear infinite}[data-app-loading=beat] .v-loader-animation::after{height:100%;animation:v-loader-beat-a .5s linear infinite;top:0;border-radius:8px;contain:paint;will-change:transform}@keyframes v-loader-beat-a{17%{border-bottom-right-radius:6px}25%{transform:translateY(9px) rotate(22.5deg)}50%{transform:translateY(18px) scale(1,.9) rotate(45deg);border-bottom-right-radius:40px}75%{transform:translateY(9px) rotate(67.5deg)}100%{transform:translateY(0) rotate(90deg)}}@keyframes v-loader-beat-s{0%,100%{transform:scale(1)}50%{transform:scale(1.2,1)}}@media(prefers-reduced-motion:reduce){.v-loader-mask{transition:none!important}.v-loader-animation,.v-loader-animation::before,.v-loader-animation::after,.v-loader-animation>i{animation:none!important;will-change:auto!important}}.v-loader-mask{--v-loader-theme-color:#1677ff;position:fixed;inset:0;z-index:10000;display:grid;place-items:center;user-select:none;background:var(--v-loader-mask-color,var(--v-loader-auto-mask-color,#fff));background:radial-gradient(120% 80% at 18% 0%,color-mix(in srgb,var(--v-loader-theme-color) 9%,transparent),transparent 62%),linear-gradient(165deg,color-mix(in srgb,var(--v-loader-theme-color) 5%,var(--v-loader-mask-color,var(--v-loader-auto-mask-color,#fff))),var(--v-loader-mask-color,var(--v-loader-auto-mask-color,#fff)) 58%);transition:opacity 400ms cubic-bezier(.22,1,.36,1)}@media(prefers-color-scheme:dark){.v-loader-mask{--v-loader-auto-mask-color:#101316}}"`,
    )
  })

  it('renders the default mask content', () => {
    expect(render().content).toMatchInlineSnapshot(
      `"<div class="v-loader-content"><div class="v-loader-stage"><span class="v-loader-animation" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div></div>"`,
    )
  })

  it('scopes the animations by the attribute alone, so a content loader can reuse them', () => {
    for (const type of loadingTypes) {
      expect(render({ type }).css).toContain(`[data-app-loading=${type}] .v-loader-animation`)
    }
    // 动画选择器里不能出现遮罩类名：
    // 选择器只按 data-app-loading 作用域，遮罩类名不该出现在里面。
    expect(render().css).not.toMatch(/\.v-loader-mask\[data-app-loading=/)
  })

  it('provides all built-in loading types', () => {
    expect(loadingTypes).toEqual([
      'bars',
      'flip',
      'beat',
      'dot',
      'spinner',
      'progress',
      'ring',
      'ripple',
    ])
  })

  it.each(loadingTypes)('injects the %s loading type', (type) => {
    const { attrs, css } = render({ type })
    expect(attrs['data-app-loading']).toBe(type)
    expect(css).toContain(`[data-app-loading=${type}] .v-loader-animation{`)
    expect(css).toContain(`@keyframes v-loader-${type}-a`)
  })

  it('emits only the selected animation by default', () => {
    const { css } = render({ type: 'bars' })
    expect(css).toContain('@keyframes v-loader-bars-a')
    expect(css).not.toContain('@keyframes v-loader-flip-a')
    expect(css).not.toContain('@keyframes v-loader-spinner-a')
  })

  it('applies a prefix to classes, keyframes, and CSS variables', () => {
    const { attrs, css, content } = render({ classPrefix: 'acme-loader', type: 'bars' })
    expect(attrs.class).toBe('acme-loader-mask')
    expect(content).toContain('class="acme-loader-animation"')
    expect(css).toContain('@keyframes acme-loader-bars-a')
    expect(css).toContain('--acme-loader-theme-color')
    expect(`${css}${content}${JSON.stringify(attrs)}`).not.toContain('v-loader')
  })

  it('把遮罩声明写进样式表，而不是 style 属性', () => {
    // 严格 CSP 的 style-src 管不到 style 属性（nonce 不适用于属性），内联声明会被整块丢弃，
    // 遮罩就退化成 body 顶部的普通 div。所有声明都必须在注入的 <style> 里。
    const { attrs, css } = render()
    expect(attrs.style).toBeUndefined()
    expect(css).toContain('.v-loader-mask{')
    expect(css).toContain('position:fixed')
    expect(css).toContain('inset:0')
  })

  it('renders the loading title as provided', () => {
    const { attrs, css, content } = render({ title: '<Loading & ready>' })
    expect(content).toContain('class="v-loader-title"')
    expect(content).toContain('<Loading & ready>')
    expect(attrs['aria-label']).toBe('<Loading & ready>')
    expect(css).toContain('.v-loader-title{')
  })

  it('supports a dynamic theme color and the default gradient mask', () => {
    const { css } = render({ themeColor: 'var(--app-primary, #1677ff)' })
    expect(css).toContain('--v-loader-theme-color:var(--app-primary, #1677ff)')
    expect(css).toContain(
      'background:radial-gradient(120% 80% at 18% 0%,color-mix(in srgb,var(--v-loader-theme-color) 9%,transparent),transparent 62%),linear-gradient(165deg,color-mix(in srgb,var(--v-loader-theme-color) 5%,var(--v-loader-mask-color,var(--v-loader-auto-mask-color,#fff))),var(--v-loader-mask-color,var(--v-loader-auto-mask-color,#fff)) 58%)',
    )
    expect(css).toContain('color:var(--v-loader-theme-color)')
  })

  it('falls back to a solid surface when color-mix is unsupported', () => {
    const { css } = render()
    const surface = 'var(--v-loader-mask-color,var(--v-loader-auto-mask-color,#fff))'
    expect(css).toContain(`background:${surface};background:radial-gradient(`)
  })

  it('supports disabling the gradient mask', () => {
    const { css } = render({ maskBackground: false })
    expect(css).toContain(
      'background:var(--v-loader-mask-color,var(--v-loader-auto-mask-color,#fff))',
    )
    expect(css).not.toContain('color-mix(in srgb,var(--v-loader-theme-color)')
  })

  it('provides a dark-mode fallback and an application override variable', () => {
    const { css } = render()
    expect(css).toContain('@media(prefers-color-scheme:dark)')
    expect(css).toContain('--v-loader-auto-mask-color:#101316')
    expect(css).toContain('--v-loader-mask-color,var(--v-loader-auto-mask-color,#fff)')
  })

  it('honors stacking and reduced-motion preferences', () => {
    const { css } = render({ zIndex: 900 })
    expect(css).toContain('z-index:900')
    expect(css).toContain('transition:opacity 400ms cubic-bezier(.22,1,.36,1)')
    expect(css).toContain('@media(prefers-reduced-motion:reduce)')
    expect(css).toContain('transition:none!important')
  })

  it('animates every built-in type on the compositor', () => {
    const css = loadingTypes.map((type) => render({ type }).css).join('')
    const { content } = render()

    // 绘制属性动画正是主线程忙于 bootstrap 时让遮罩卡顿的原因，一条都不许回来。
    expect(css).not.toContain('will-change:background')
    expect(css).not.toContain('background-size:')
    expect(css).not.toContain('background-position')

    for (const [name, expected] of Object.entries(animatedProperties)) {
      expect(`${name}: ${animatedProps(css, `v-loader-${name}`).join(',')}`).toBe(
        `${name}: ${expected.join(',')}`,
      )
    }

    // 标记需要五个子元素，用得更少的类型必须把多余的隐藏掉。
    expect(content).toContain(`aria-hidden="true">${'<i></i>'.repeat(5)}`)
    expect(css).toContain('.v-loader-animation>i{display:none}')
    expect(css).toContain('[data-app-loading=bars] .v-loader-animation>i{display:block')
    expect(css).toContain('[data-app-loading=dot] .v-loader-animation>i:nth-child(-n+3)')
    expect(css).toContain('[data-app-loading=progress] .v-loader-animation>i:first-child')
    expect(css).toContain('[data-app-loading=ring] .v-loader-animation>i:first-child')
    expect(css).toContain('[data-app-loading=ripple] .v-loader-animation>i:first-child')
  })

  it('renders the ripple as three staggered expanding rings', () => {
    const { css } = render({ type: 'ripple' })
    const ripple = '[data-app-loading=ripple] .v-loader-animation'
    const ring = `${ripple}::before,${ripple}::after,${ripple}>i:first-child`

    expect(css).toContain(`${ripple}{position:relative;width:64px;height:64px}`)
    expect(css).toContain(`${ripple}::before,${ripple}::after{content:''}`)
    // `display:block` 不能少：共享的 `.v-loader-animation>i{display:none}` 会隐藏子元素，
    // 漏写它第三个环就不显示（渲染层测试抓到过这个漏写）。
    expect(css).toContain(
      `${ring}{display:block;position:absolute;inset:0;border:6px solid currentColor;border-radius:50%;`,
    )
    // stage 的宽度足以容纳左右溢出，真正要紧的是纵向 —— 这才让最外圈不会挤进标题前那 24px 间距。
    const stageHeight = Number(/\.v-loader-stage\{width:\d+px;height:(\d+)px/.exec(css)?.[1])
    expect(stageHeight).toBe(65)
    expect(64).toBeLessThanOrEqual(stageHeight)
    expect(css).toContain('animation:v-loader-ripple-a 1.8s linear infinite')
    // 负延迟：三个环在第一帧就已处于周期中途，涟漪立刻在行进，而不是三个环先等完各自的正延迟。
    expect(css).toContain(`${ripple}::after{animation-delay:-.6s}`)
    expect(css).toContain(`${ripple}>i:first-child{animation-delay:-1.2s}`)
    expect(css).not.toMatch(/animation-delay:(?!-)/)
    expect(keyframesBody(css, 'v-loader-ripple-a')).toBe(
      '0%{opacity:0;transform:scale(.3)}' +
        '35%{opacity:.9;transform:scale(.65)}' +
        '100%{opacity:0;transform:scale(1)}',
    )
    // 动画关闭后，三个环重叠成一个静态环。
    expect(css).toContain('opacity:.3;transform:scale(.62)')
  })

  it('renders the ring as a track, a spinning arc and a pulsing core', () => {
    const { css } = render({ type: 'ring' })
    const ring = '[data-app-loading=ring] .v-loader-animation'

    expect(css).toContain(`${ring}{position:relative;width:48px;height:48px}`)
    expect(css).toContain(`${ring}::before,${ring}::after{content:'';position:absolute;inset:0;`)
    // 轨道用 `opacity` 复刻设计稿的 12% 色调，不需要 `color-mix`。
    expect(css).toContain(`${ring}::before{border:4px solid currentColor;opacity:.12}`)
    expect(css).toContain(`${ring}::after{border:4px solid transparent;`)
    expect(css).toContain('border-top-color:currentColor')
    expect(css).toContain('border-right-color:currentColor')
    expect(css).toContain('animation:v-loader-ring-a .78s linear infinite')
    // 核心圆保住了设计稿 10% 的色调，尽管它的 `opacity` 归自己的动画所有。
    expect(css).toContain(`${ring}>i:first-child{display:block;position:absolute;inset:14px;`)
    expect(css).toContain('background:color-mix(in srgb,currentColor 10%,transparent)')
    expect(css).toContain('animation:v-loader-ring-core 1.1s ease-in-out infinite')
    expect(keyframesBody(css, 'v-loader-ring-a')).toBe('to{transform:rotate(1turn)}')
    expect(keyframesBody(css, 'v-loader-ring-core')).toBe(
      '0%,100%{opacity:.46;transform:scale(.78)}50%{opacity:1;transform:scale(1)}',
    )
  })

  it('leaves the ring core whole under reduced motion', () => {
    // 核心圆没有 `animation-delay`，加载期间基础样式永远不会露出。不声明静止姿态，正是为了让它在
    // 动画关闭时停在满尺寸、满不透明度 —— 与设计稿一致。
    const { css } = render({ type: 'ring' })
    const ring = '[data-app-loading=ring] .v-loader-animation'
    expect(css).not.toContain(
      `${ring}>i:first-child{display:block;position:absolute;inset:14px;border-radius:50%;background:transparent;background:color-mix(in srgb,currentColor 10%,transparent);transform:`,
    )
    expect(css).toContain(
      '.v-loader-animation>i{animation:none!important;will-change:auto!important}',
    )
  })

  it('rounds the progress blocks without moving the tile rhythm', () => {
    const { css } = render({ type: 'progress' })
    const progress = '[data-app-loading=progress] .v-loader-animation'

    expect(css).toContain(`${progress}{width:120px;height:20px;margin-left:-50%;overflow:hidden;`)
    // 24px 的 tile 里放 16.8px 的色块，正是原来渐变 70% 停靠点产生的宽度，
    // 因此 `steps(6)` 与 `scaleX(1.2)` 每一步仍然精确填满一块。
    expect(css).toContain("width='24'")
    expect(css).toContain("width='16.8'")
    expect(css).toContain("height='20'")
    expect(css).toContain("rx='4'")
    // tile 剩余 7.2px，色块内缩 3.6px（即一半），于是整排首尾都是同样的半间隙、
    // 五块在 120px 的条内居中。贴到 x=0 时整排会读作向左偏，这条断言就是防这个。
    const svg = decodeURIComponent(
      /data:image\/svg\+xml,([^"]+)/.exec(css)![1]!.replace(/%20/g, ' '),
    )
    const tile = Number(/width='([\d.]+)' height/.exec(svg)![1])
    const [, inset, block] = /<rect x='([\d.]+)' width='([\d.]+)'/.exec(svg)!
    expect(tile - Number(block) - Number(inset)).toBeCloseTo(Number(inset), 5)
    expect(css).toContain('--v-loader-progress-mask:url("data:image/svg+xml,')
    expect(css).toContain('-webkit-mask:var(--v-loader-progress-mask) 0/20% 100%')
    expect(css).toContain('mask:var(--v-loader-progress-mask) 0/20% 100%')
    expect(css).toContain('animation:v-loader-progress-a 2s steps(6) infinite')
    // data URI 里不能有裸空白字符，否则 CSS 压缩器可能把它拆断。
    expect(css).not.toMatch(/data:image\/svg\+xml,[^"]*\s/)
  })

  it('rounds the flip block with a static radius', () => {
    const { css } = render({ type: 'flip' })
    const flip = '[data-app-loading=flip] .v-loader-animation'
    expect(css).toContain(
      `${flip}{width:48px;height:48px;background:currentColor;border-radius:8px;`,
    )
    // 静态而非动画：`flip-a` 只动画 `transform`，所以圆角只栅格化一次。
    expect(animatedProps(css, 'v-loader-flip-a')).toEqual(['transform'])
    expect(keyframesBody(css, 'v-loader-flip-a')).not.toContain('border-radius')
  })

  it('每个 animation 引用都有对应的 @keyframes，且没有无人引用的关键帧', () => {
    const css = loadingTypes.map((type) => render({ type }).css).join('')

    const declared = new Set([...css.matchAll(/@keyframes ([\w-]+)/g)].map((match) => match[1]!))

    // 动画名都带前缀；这个过滤同时排除了时间值、`steps(6)` 和 `infinite` 之类的关键字。
    const referenced = new Set(
      [...css.matchAll(/(?:animation|animation-name):([^;}]+)/g)].flatMap((match) =>
        (match[1] ?? '').split(/[\s,]+/).filter((token) => token.startsWith('v-loader-')),
      ),
    )

    expect([...referenced].sort()).toEqual([...declared].sort())
  })

  it('renders the bars jump with a staggered delay per bar', () => {
    const { css } = render({ type: 'bars' })
    const bars = '[data-app-loading=bars] .v-loader-animation>i'
    expect(css).toContain(`${bars}{display:block;width:6px;height:34px`)
    expect(css).toContain('border-radius:999px')
    expect(css).toContain('gap:5px')
    expect(css).toContain('animation:v-loader-bars-a .75s ease-in-out infinite')
    expect(css).toContain(`${bars}:nth-child(2){animation-delay:.07s}`)
    expect(css).toContain(`${bars}:nth-child(3){animation-delay:.14s}`)
    expect(css).toContain(`${bars}:nth-child(4){animation-delay:.21s}`)
    expect(css).toContain(`${bars}:nth-child(5){animation-delay:.28s}`)
    expect(css).not.toContain('animation-delay:0.21000000000000002')
    expect(keyframesBody(css, 'v-loader-bars-a')).toBe(
      '0%,100%{opacity:.45;transform:scaleY(.46)}50%{opacity:1;transform:scaleY(1)}',
    )
  })

  it('keeps the bar stagger a fixed share of the cycle', () => {
    const { css } = render({ type: 'bars' })
    const cycle = Number(/v-loader-bars-a ([\d.]+)s/.exec(css)?.[1])
    const delays = [...css.matchAll(/nth-child\((\d)\)\{animation-delay:([\d.]+)s\}/g)]

    expect(delays).toHaveLength(4)
    // 只改周期而不改延迟，会把波形拉长而不是让它变快，所以无论周期多长，
    // 每一步占周期的比例都必须保持不变。
    const shares = delays.map(([, child, delay]) =>
      Number((Number(delay) / (cycle * (Number(child) - 1))).toFixed(3)),
    )
    expect(shares).toEqual([0.093, 0.093, 0.093, 0.093])
  })

  it('rests at the pose the animations start from, so reduced motion looks unchanged', () => {
    const css = loadingTypes.map((type) => render({ type }).css).join('')
    // bars 停在 46% 高度且偏暗，dots 停在各自单元中央，progress 填充为空
    expect(css).toContain('opacity:.45;transform:scaleY(.46)')
    expect(css).toContain('height:16px;transform:translateY(7px)')
    expect(css).toContain('transform-origin:0 50%;transform:scaleX(0)')
    expect(css).toContain(
      '.v-loader-animation>i{animation:none!important;will-change:auto!important}',
    )
  })

  it('keeps the beat squash and honors reduced-motion preferences', () => {
    const css = render().css
    expect(css).toContain('will-change:transform')
    expect(css).toContain('v-loader-beat-a .5s linear infinite')
    expect(css).toContain('translateY(18px) scale(1,.9) rotate(45deg)')
    expect(css).toContain('50%{transform:scale(1.2,1)}')
    // `beat` deliberately keeps its painted corner squash; `contain:paint` bounds the repaint.
    expect(keyframesBody(css, 'v-loader-beat-a')).toContain('border-bottom-right-radius:40px')
    expect(css).toContain('contain:paint')
    expect(css).toContain('height:65px')
    expect(css).toContain('overflow:visible')
  })

  it('eases the dots and keeps their travel on whole pixels', () => {
    const css = render({ type: 'dot' }).css
    const dot = '[data-app-loading=dot] .v-loader-animation>i:nth-child(-n+3)'
    expect(css).toContain('animation-timing-function:ease-in-out')
    expect(css).not.toContain('translateY(7.5px)')
    expect(css).toContain(`${dot}{display:block;width:20px;height:16px;transform:translateY(7px);`)
    // 16px dot in a 30px box: 7px to centre, 14px of travel, all whole pixels.
    expect(keyframesBody(css, 'v-loader-dot-a1')).toBe(
      '0%{transform:translateY(7px)}20%{transform:translateY(0)}' +
        '40%{transform:translateY(14px)}60%,100%{transform:translateY(7px)}',
    )
  })

  it('fades the spinner tail in instead of cutting it off', () => {
    const css = render({ type: 'spinner' }).css
    // 头部仍是硬边，但 8px 的圆球压在它上面把它盖住了。
    expect(css).toContain('conic-gradient(#0000 30%,currentColor 46%)')
    expect(css).toContain(
      'radial-gradient(farthest-side,currentColor 94%,#0000) top/8px 8px no-repeat',
    )
  })

  it('does not inject twice', () => {
    const source = '<html><body><div data-app-loading="beat"></div></body></html>'
    expect(pluginFor().transformIndexHtml.handler(source)).toBe(source)
  })

  it('脚本/注释/style/template 里的标记不算已有遮罩', () => {
    // 这些位置里的 `<div data-app-loading=…>` 只是文本，不是真实存在的遮罩。误判会让整页静默
    // 跳过注入 —— 既没有遮罩也没有任何报错。
    const sources = [
      '<html><body><script>const tpl = \'<div data-app-loading="beat"></div>\'</script></body></html>',
      '<html><body><!-- <div data-app-loading="beat"></div> --></body></html>',
      '<html><body><style>.x::after{content:"<div data-app-loading=beat>"}</style></body></html>',
      '<html><body><template><div data-app-loading="beat"></div></template></body></html>',
    ]

    for (const source of sources) {
      expect(pluginFor().transformIndexHtml.handler(source)).not.toBe(source)
    }
  })

  it('ignores an element that only carries the preview attribute', () => {
    const source = '<html><body><div data-app-loading-preview></div></body></html>'
    expect(pluginFor().transformIndexHtml.handler(source)).not.toBe(source)
  })

  it('injects into the head and before the application root', () => {
    const { tags } = render()
    expect(tags.map((tag) => [tag.tag, tag.injectTo])).toEqual([
      ['style', 'head'],
      ['div', 'body-prepend'],
    ])
  })
})

describe('vite-plugin-loading custom templates', () => {
  it('composes a template with the remaining options', () => {
    const { attrs, content, css } = render({
      template: 'loading.html',
      classPrefix: 'acme-loader',
      themeColor: '#ff0000',
      title: 'Preparing',
    })
    expect(attrs['data-app-loading']).toBe('custom')
    expect(attrs.class).toBe('acme-loader-mask')
    expect(attrs['aria-label']).toBe('Preparing')
    expect(css).toContain('--acme-loader-theme-color:#ff0000')
    expect(content).toContain('class="loading-scene"')
    // 自定义模板自带样式；这里只额外补遮罩规则与暗色 surface 兜底，不注入任何内置动画。
    expect(css).toContain('.acme-loader-mask{')
    expect(css).toContain(
      '@media(prefers-color-scheme:dark){.acme-loader-mask{--acme-loader-auto-mask-color:#101316}}',
    )
    expect(css).not.toContain('@keyframes')
  })

  it('accepts a template path as the whole option', () => {
    expect(render('loading.html').content).toContain('class="loading-mark"')
  })

  it('resolves the template against the Vite root, not the working directory', () => {
    expect(render('loading.html').content).toContain('class="loading-scene"')
    expect(() => pluginFor('loading.html', `${process.cwd()}/example`)).toThrow(
      /custom template not found/,
    )
  })

  it('rejects a missing custom template', () => {
    expect(() => pluginFor('does-not-exist.html')).toThrow(/custom template not found/)
  })

  it('watches the template so edits do not need a dev-server restart', () => {
    const added: string[] = []
    const plugin = pluginFor('loading.html')
    plugin.transformIndexHtml.handler(html, {
      server: { watcher: { add: (file: string) => added.push(file) } },
    })
    expect(added).toEqual([path.resolve(process.cwd(), 'loading.html')])
  })
})

describe('vite-plugin-loading validation', () => {
  it('rejects an unsupported options shape', () => {
    expect(() => appLoading(123 as never)).toThrow(/options must be an object or a template path/)
    expect(() => appLoading(['a'] as never)).toThrow(/options must be an object/)
    expect(() => appLoading(null as never)).toThrow(/received null/)
  })

  it('rejects invalid prefixes and unsafe CSS values', () => {
    expect(() => appLoading({ classPrefix: 'bad prefix' })).toThrow(/invalid classPrefix/)
    expect(() => appLoading({ themeColor: 'red;color:blue' })).toThrow(/invalid themeColor/)
    expect(() => appLoading({ themeColor: 'red</style>' })).toThrow(/invalid themeColor/)
    expect(() => appLoading({ themeColor: '   ' })).toThrow(/invalid themeColor/)
  })

  it('rejects invalid numeric and boolean options', () => {
    expect(() => appLoading({ maskBackground: 'red' as never })).toThrow(
      /maskBackground must be a boolean/,
    )
    // z-index 只接受整数：小数会让整条声明失效，遮罩掉回默认层叠顺序且没有报错。
    expect(() => appLoading({ zIndex: -1 })).toThrow(/zIndex must be an integer/)
    expect(() => appLoading({ zIndex: 1.5 })).toThrow(/zIndex must be an integer/)
    expect(() => appLoading({ timeout: '5' as never })).toThrow(/timeout/)
    expect(() => appLoading({ hideOnError: 'yes' as never })).toThrow(/hideOnError/)
  })

  it('rejects unsupported loading types', () => {
    expect(() => appLoading({ type: 'pulse' as never })).toThrow(/unsupported loading type/)
  })

  it('rejects an empty or non-string template path', () => {
    expect(() => appLoading({ template: '  ' })).toThrow(/template path must not be empty/)
    expect(() => appLoading({ template: 1 as never })).toThrow(/template must be a string/)
  })
})

describe('virtual:app-loading', () => {
  it('only exports hideAppLoading', () => {
    const runtime = pluginFor().load('\0virtual:app-loading')!
    expect(runtime).toContain('export { hideAppLoading }')
    expect(runtime).not.toMatch(
      /export (?:const|function) (?:show|hide|close|toggle|switchLoading|isVisible|loadingFadeOut)\b/,
    )
  })

  it('resolves the module with or without a query string', () => {
    const plugin = pluginFor()
    expect(plugin.resolveId('virtual:app-loading')).toBe('\0virtual:app-loading')
    expect(plugin.resolveId('virtual:app-loading?used')).toBe('\0virtual:app-loading')
    expect(plugin.resolveId('virtual:app-loading-extra')).toBeUndefined()
    expect(plugin.load('virtual:app-loading?used')).toContain('hideAppLoading')
    expect(plugin.load('virtual:other')).toBeUndefined()
  })

  it('relays the fail-safe options to the runtime and uses the fixed fade duration', () => {
    const runtime = pluginFor({ timeout: 8000, hideOnError: false }).load('\0virtual:app-loading')!
    expect(runtime).toContain('}, 400)')
    expect(runtime).toContain('window.setTimeout(hideAppLoading, 8000)')
    expect(runtime).not.toContain("addEventListener('error', hideAppLoading)")
  })

  it('never observes the DOM: hiding is always driven by the application', () => {
    const runtime = pluginFor().load('\0virtual:app-loading')!
    expect(runtime).not.toContain('MutationObserver')
    expect(runtime).not.toContain('requestAnimationFrame')
    expect(runtime).not.toContain('readyState')
  })
})
