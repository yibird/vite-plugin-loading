import { hideAppLoading } from 'virtual:app-loading'

// 重放用插件真实生成的遮罩：克隆一份，再把隐藏过程中写入的内联状态复位。
const loadingTemplate = document
  .querySelector<HTMLElement>('[data-app-loading]')
  ?.cloneNode(true) as HTMLElement | undefined

let replayTimer: number | undefined

function cloneLoading(): HTMLElement | undefined {
  const element = loadingTemplate?.cloneNode(true) as HTMLElement | undefined
  if (!element) return

  element.style.opacity = '1'
  element.style.pointerEvents = ''
  element.style.willChange = ''
  element.removeAttribute('aria-hidden')
  element.removeAttribute('data-app-loading-hidden')
  return element
}

export function replayAppLoading(): void {
  const element = cloneLoading()
  if (!element) return

  window.clearTimeout(replayTimer)
  document.querySelector('[data-app-loading]:not([data-app-loading-preview])')?.remove()
  document.body.append(element)
  element.addEventListener('click', hideAppLoading, { once: true })
  replayTimer = window.setTimeout(hideAppLoading, 1400)
}
