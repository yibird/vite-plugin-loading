import { defineConfig, devices } from '@playwright/test'

/**
 * 渲染层测试。跑之前需要有一次构建（`globalSetup` 会跑 `tsdown`），以及
 * `pnpm exec playwright install chromium` 下载浏览器。
 *
 * 基线截图是按平台存的（`*-chromium-win32.png`），所以 Linux CI 上第一次跑要先
 * `--update-snapshots` 生成本平台的基线。
 */
export default defineConfig({
  testDir: './test/browser',
  // 每个 worker 的 beforeAll 都会重建同一份 fixture 目录，并行跑会互相踩。串行既简单又确定。
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    // 固定 DPR 与视口，截图才可跨运行比对。视口刚好容纳最宽的动画（progress 120px）。
    deviceScaleFactor: 1,
    viewport: { width: 240, height: 180 },
  },
  expect: {
    toHaveScreenshot: {
      // 抗锯齿在边缘像素上会有微小差异，容差按像素个数给，不按比例。
      maxDiffPixels: 60,
    },
  },
})
