import {
  appLoadingAttribute,
  appLoadingHiddenAttribute,
  appLoadingPreviewAttribute,
} from './constants.ts'

const maskSelector = `[${appLoadingAttribute}]:not([${appLoadingPreviewAttribute}])`

export interface RuntimeOptions {
  /** 淡出时长（毫秒），结束后遮罩被移除。 */
  fadeDuration: number
  /** 页面出现未捕获错误或未处理的 Promise 拒绝时隐藏遮罩。 */
  hideOnError: boolean
  /** 超过该毫秒数后隐藏遮罩。`0` 表示不启用定时器。 */
  timeout: number
}

/**
 * `virtual:app-loading` 运行时的源码。
 *
 * 以「内联模块源码」而非独立文件的形式下发，是为了让应用启动不多一次请求。这里刻意保持可读：
 * 生产构建时 Vite 会压缩它，而调试 dev 时你需要的正是可读的代码。
 *
 * 隐藏始终由应用驱动：插件不会自行判断应用已就绪。返回的源码里刻意不含 `export` 语句 ——
 * 由插件负责追加，测试也直接执行函数体。
 */
export function createRuntimeSource({
  fadeDuration,
  hideOnError,
  timeout,
}: RuntimeOptions): string {
  const errorFallback = hideOnError
    ? `
if (typeof window !== 'undefined') {
  window.addEventListener('error', hideAppLoading)
  window.addEventListener('unhandledrejection', hideAppLoading)
}
`
    : ''
  const timeoutFallback =
    timeout > 0
      ? `\nif (typeof window !== 'undefined') window.setTimeout(hideAppLoading, ${timeout})\n`
      : ''

  return `const maskSelector = ${JSON.stringify(maskSelector)}

function removeListeners() {
  if (typeof window === 'undefined') return
  window.removeEventListener('error', hideAppLoading)
  window.removeEventListener('unhandledrejection', hideAppLoading)
}

function hideAppLoading() {
  removeListeners()
  if (typeof document === 'undefined') return
  const mask = document.querySelector(maskSelector)
  if (!mask || mask.hasAttribute(${JSON.stringify(appLoadingHiddenAttribute)})) return
  mask.setAttribute(${JSON.stringify(appLoadingHiddenAttribute)}, '')
  mask.style.pointerEvents = 'none'
  mask.style.willChange = 'opacity'
  mask.style.opacity = '0'
  mask.setAttribute('aria-hidden', 'true')
  setTimeout(function () {
    mask.remove()
  }, ${fadeDuration})
}
${errorFallback}${timeoutFallback}`
}
