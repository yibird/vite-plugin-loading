import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { buildFixture, fixtureTypes, repoRoot, startServer, type FixtureServer } from './serve'

let server: FixtureServer

test.beforeAll(async () => {
  // 浏览器测试渲染的是构建产物，先重建一次 dist（类型检查由 `pnpm check` 负责）。
  execFileSync('pnpm', ['exec', 'tsdown'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  await buildFixture()
  server = await startServer()
})

test.afterAll(async () => {
  await server.close()
})

/** 打开该类型对应的构建产物页面。 */
async function showType(page: Page, type: string): Promise<void> {
  await page.goto(`${server.origin}/${type}/`)
  await page.waitForFunction(() => document.body.dataset.ready === '1')
}

/**
 * 把所有 CSS 动画停在一个确定的时刻。
 *
 * 统一取 `duration * fraction`（**不加** delay），这样既确定可复现，又保住了同一类型内部的相位差：
 * bars 的五根条靠正延迟错峰、ripple 的三个环靠负延迟错峰，若把 delay 也加进去，每个动画都会停在
 * "自己周期的同一比例"上，错峰就被抹平了，截图反而失真。
 */
async function freezeAt(page: Page, fraction: number): Promise<void> {
  await page.evaluate((value) => {
    for (const animation of document.getAnimations()) {
      const duration = Number(animation.effect?.getComputedTiming().duration ?? 0)
      if (!Number.isFinite(duration) || duration === 0) continue
      animation.pause()
      animation.currentTime = duration * value
    }
  }, fraction)
}

/**
 * 每种类型截图时冻结在哪个比例。
 *
 * 多数类型取 0.5 就够（beat 的撞击、progress 的三格填充都在这一帧）。flip 必须错开：它 50% 时是
 * `rotateX(180deg)`，投影回来看起来和 0° 一模一样，那个基线区分不了任何东西。0.15 停在约 54°，
 * 是一个明显被透视压扁的梯形。
 */
const screenshotFractions: Record<(typeof fixtureTypes)[number], number> = {
  bars: 0.5,
  flip: 0.15,
  beat: 0.5,
  dot: 0.5,
  spinner: 0.5,
  progress: 0.5,
  ring: 0.5,
  ripple: 0.5,
}

for (const type of fixtureTypes) {
  test(`renders ${type}`, async ({ page }) => {
    await showType(page, type)
    await freezeAt(page, screenshotFractions[type])
    // `animations: 'allow'` 很关键：默认的 `'disabled'` 会把动画重置回第一帧，覆盖掉上面的冻结。
    await expect(page.locator('[data-app-loading]')).toHaveScreenshot(`${type}.png`, {
      animations: 'allow',
    })
  })
}

test('progress 每一步的推进量正好等于一个 mask tile', async ({ page }) => {
  await showType(page, 'progress')
  const bar = page.locator('[data-app-loading=progress] .v-loader-animation')
  const fill = bar.locator('> i:first-child')

  // tile 宽度从渲染后的 mask-size 算出，而不是写死 24 —— 这样断言的是"步进 == tile"这个自洽关系。
  // 注意 Chrome 的 computed `mask-size` 保留百分比原样（这里是 `20% 100%`），要自己按条宽换算。
  const tile = await bar.evaluate((element) => {
    const style = getComputedStyle(element)
    const size = style.maskSize === 'auto' ? style.webkitMaskSize : style.maskSize
    const token = size.split(/\s+/)[0] ?? ''
    const parsed = Number.parseFloat(token)
    if (!Number.isFinite(parsed)) throw new Error(`读不到 mask tile 宽度："${size}"`)
    return token.endsWith('%') ? (parsed / 100) * element.getBoundingClientRect().width : parsed
  })
  expect(tile).toBe(24)

  // 每一步取中点：steps(6) 会把输出量化，中点才落在平台期上，边界会落到下一个平台。
  const widths: number[] = []
  for (const step of [0, 1, 2, 3, 4, 5]) {
    await freezeAt(page, (step + 0.5) / 6)
    widths.push(Math.round((await fill.boundingBox())!.width))
  }

  // scaleX(1.2) 是刻意的：6 步正好覆盖满 120px（0/24/48/72/96/120）。改成 1.0 的话最后一步只到
  // 100px，条永远填不满。而 1.2 这个端点值本身看不到 —— 到达它的瞬间迭代就回绕了。
  expect(widths).toEqual([0, 24, 48, 72, 96, 120])
  for (const width of widths) expect(width % tile).toBe(0)
  // 关键不变式：每一步推进的正好是一个 tile，所以填充只会停在色块边界上，绝不切进色块中间。
  for (let index = 1; index < widths.length; index += 1) {
    expect(widths[index]! - widths[index - 1]!).toBe(tile)
  }
})

test('progress 的 SVG mask 能真正栅格化，色块在 tile 内左右对称', async ({ page }) => {
  await showType(page, 'progress')

  const measured = await page.evaluate(async () => {
    const element = document.querySelector('[data-app-loading=progress] .v-loader-animation')
    if (!element) throw new Error('progress element missing')

    const style = getComputedStyle(element)
    const maskImage = style.maskImage === 'none' ? style.webkitMaskImage : style.maskImage
    // SVG 里用的是单引号，所以只能按外层双引号切分。
    const url = /url\("([^"]+)"\)/.exec(maskImage)?.[1]
    if (!url) throw new Error(`no mask url in "${maskImage}"`)

    // 解析失败会在这里 reject —— 这比断言 CSS 文本更能证明 data URI 是一份合法 SVG。
    const image = new Image()
    image.src = url
    await image.decode()

    const tile = document.createElement('canvas')
    tile.width = 24
    tile.height = 20
    const context = tile.getContext('2d')
    if (!context) throw new Error('no 2d context')
    context.drawImage(image, 0, 0, 24, 20)

    const alpha = context.getImageData(0, 0, 24, 1).data
    let first = -1
    let last = -1
    for (let x = 0; x < 24; x += 1) {
      if ((alpha[x * 4 + 3] ?? 0) > 128) {
        if (first === -1) first = x
        last = x
      }
    }

    return { intrinsicWidth: image.naturalWidth, first, last }
  })

  expect(measured.intrinsicWidth).toBe(24)
  // 色块从 tile 内缩半个间隙处开始，右端留出同样的半个间隙 —— 整排才会在条内居中。
  expect(measured.first).toBeGreaterThanOrEqual(3)
  expect(24 - 1 - measured.last).toBe(measured.first)
})

test('每种类型恰好渲染它需要的子元素', async ({ page }) => {
  // 共享基础规则是 `.v-loader-animation>i{display:none}`，每个类型再显式打开自己用到的子元素。
  // 漏写 `display` 的类型会悄悄少渲染一环 —— ripple 的第三个环就这样漏过了一整轮字符串级测试。
  const expected: Record<(typeof fixtureTypes)[number], number> = {
    bars: 5,
    flip: 0,
    beat: 0,
    dot: 3,
    spinner: 0,
    progress: 1,
    ring: 1,
    ripple: 1,
  }

  for (const [type, count] of Object.entries(expected)) {
    await showType(page, type)
    const visible = await page
      .locator(`[data-app-loading=${type}] .v-loader-animation > i`)
      .evaluateAll(
        (elements) =>
          elements.filter((element) => getComputedStyle(element).display !== 'none').length,
      )
    expect(visible, `${type} 应该渲染 ${count} 个子元素`).toBe(count)
  }
})

test('除 beat 的圆角挤压外，动画只改可合成属性', async ({ page }) => {
  const compositorProperties = new Set(['opacity', 'transform'])
  const seen: string[] = []

  for (const type of fixtureTypes) {
    await showType(page, type)
    const animations = await page.evaluate(() =>
      document.getAnimations().map((animation) => {
        const name = 'animationName' in animation ? String(animation.animationName) : 'unknown'
        // `getKeyframes` 在 KeyframeEffect 上，基础类型 AnimationEffect 没有它。
        const frames = (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? []
        const properties = new Set<string>()
        for (const frame of frames) {
          for (const key of Object.keys(frame)) {
            // offset / easing 之类是 Web Animations 的元数据，不是被动画的属性。
            if (['offset', 'computedOffset', 'easing', 'composite'].includes(key)) continue
            // Chrome 用驼峰返回属性名，转回 CSS 写法，断言才读得懂。
            properties.add(key.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`))
          }
        }
        return { name, properties: [...properties].sort() }
      }),
    )

    expect(animations.length).toBeGreaterThan(0)
    for (const animation of animations) {
      seen.push(animation.name)
      if (animation.name.endsWith('-beat-a')) {
        // 已知取舍：beat 保留绘制式的圆角挤压，这是唯一允许改绘制属性的动画。
        expect(animation.properties).toEqual(['border-bottom-right-radius', 'transform'])
        continue
      }
      for (const property of animation.properties) {
        expect(
          compositorProperties.has(property),
          `${animation.name} animates ${property}, which is not compositable`,
        ).toBe(true)
      }
    }
  }

  // 8 种类型都被覆盖到了。
  expect(new Set(seen).size).toBeGreaterThanOrEqual(fixtureTypes.length)
})

test('bars 是 5 根 6px 的条，间隙 5px，静止高度为 34px 的 46%', async ({ page }) => {
  await showType(page, 'bars')
  await freezeAt(page, 0)

  const boxes = await page
    .locator('[data-app-loading=bars] .v-loader-animation > i')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, width: rect.width, height: rect.height }
      }),
    )

  expect(boxes).toHaveLength(5)
  for (const box of boxes) {
    expect(box.width).toBeCloseTo(6, 1)
    // scaleY(.46) 会被 getBoundingClientRect 反映出来，所以量到的是静止姿态的实际高度。
    expect(box.height).toBeCloseTo(34 * 0.46, 1)
  }
  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1]!
    const current = boxes[index]!
    expect(current.x - (previous.x + previous.width)).toBeCloseTo(5, 1)
  }
})

test('dot 的关键帧位移落在整数像素上', async ({ page }) => {
  await showType(page, 'dot')
  const filled = page.locator('[data-app-loading=dot] .v-loader-animation > i').first()

  const offsets: number[] = []
  for (const fraction of [0, 0.2, 0.4, 0.6]) {
    await freezeAt(page, fraction)
    const transform = await filled.evaluate((element) => getComputedStyle(element).transform)
    offsets.push(Number(/matrix\(1, 0, 0, 1, 0, ([-0-9.]+)\)/.exec(transform)?.[1]))
  }

  // 0% / 20% / 40% / 60% 四个关键帧上的 translateY：全部是整数，没有 7.5px 那种半像素。
  expect(offsets).toEqual([7, 0, 14, 7])
})

test('ripple 的三个环靠负延迟处于不同相位', async ({ page }) => {
  await showType(page, 'ripple')
  await freezeAt(page, 0.5)

  const scales = await page.evaluate(() => {
    const element = document.querySelector('[data-app-loading=ripple] .v-loader-animation')
    // 三个环分别是 ::before、::after 与第一个子元素 —— 不是 .animation 本身。
    const core = element?.querySelector('i')
    if (!element || !core) throw new Error('ripple element missing')
    const read = (target: Element, pseudo?: string) => {
      const value = getComputedStyle(target, pseudo).transform
      const scale = /matrix\(([-0-9.]+),/.exec(value)?.[1]
      return scale === undefined ? Number.NaN : Number(scale)
    }
    return [read(element, '::before'), read(element, '::after'), read(core)]
  })

  // 负延迟让三环错峰：同一条关键帧，此刻处在不同的缩放上。
  expect(new Set(scales).size).toBe(3)
  for (const scale of scales) {
    expect(scale).toBeGreaterThanOrEqual(0.3)
    expect(scale).toBeLessThanOrEqual(1)
  }
})
