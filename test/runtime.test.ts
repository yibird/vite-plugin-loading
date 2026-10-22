// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createRuntimeSource, type RuntimeOptions } from '../src/runtime.ts'

interface RuntimeModule {
  hideAppLoading(): void
}

const defaults: RuntimeOptions = { fadeDuration: 400, hideOnError: true, timeout: 0 }

function loadRuntime(options: Partial<RuntimeOptions> = {}): RuntimeModule {
  const source = createRuntimeSource({ ...defaults, ...options })
  return new Function(`${source}\nreturn { hideAppLoading };`)() as RuntimeModule
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('createRuntimeSource', () => {
  it('emits readable, unbundled source', () => {
    const source = createRuntimeSource(defaults)
    expect(source).toContain('function hideAppLoading() {')
    expect(source).toContain('const maskSelector = "[data-app-loading]')
    expect(source).not.toContain('export')
  })

  it('only wires the fail-safes that are enabled', () => {
    expect(createRuntimeSource(defaults)).toContain("window.addEventListener('unhandledrejection'")
    expect(createRuntimeSource({ ...defaults, hideOnError: false })).not.toContain(
      "window.addEventListener('unhandledrejection'",
    )
    expect(createRuntimeSource({ ...defaults, timeout: 3000 })).toContain(
      'window.setTimeout(hideAppLoading, 3000)',
    )
    expect(createRuntimeSource(defaults)).not.toContain('hideAppLoading, 0)')
  })
})

describe('hideAppLoading', () => {
  it('fades the mask and removes it after the configured duration', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div data-app-loading="beat"></div>'
    const { hideAppLoading } = loadRuntime({ fadeDuration: 250 })
    const element = document.querySelector<HTMLElement>('[data-app-loading]')!

    hideAppLoading()

    expect(element.style.pointerEvents).toBe('none')
    expect(element.style.opacity).toBe('0')
    expect(element.style.willChange).toBe('opacity')
    expect(element.getAttribute('aria-hidden')).toBe('true')

    vi.advanceTimersByTime(249)
    expect(element.isConnected).toBe(true)

    vi.advanceTimersByTime(1)
    expect(element.isConnected).toBe(false)
  })

  it('is safe to call when the mask does not exist', () => {
    const { hideAppLoading } = loadRuntime()

    expect(() => hideAppLoading()).not.toThrow()
  })

  it('is idempotent and does not push the removal out', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div data-app-loading="beat"></div>'
    const { hideAppLoading } = loadRuntime()
    const element = document.querySelector<HTMLElement>('[data-app-loading]')!

    hideAppLoading()
    vi.advanceTimersByTime(200)
    hideAppLoading()

    vi.advanceTimersByTime(200)
    expect(element.isConnected).toBe(false)
  })

  it('ignores embedded previews and hides the real mask', () => {
    vi.useFakeTimers()
    document.body.innerHTML =
      '<div data-app-loading="beat" data-app-loading-preview></div><div data-app-loading="dot"></div>'
    const { hideAppLoading } = loadRuntime()
    const preview = document.querySelector('[data-app-loading-preview]')!
    const mask = document.querySelector('[data-app-loading]:not([data-app-loading-preview])')!

    hideAppLoading()

    expect(preview.isConnected).toBe(true)
    expect(mask.getAttribute('aria-hidden')).toBe('true')
    vi.advanceTimersByTime(400)
    expect(preview.isConnected).toBe(true)
    expect(mask.isConnected).toBe(false)
  })

  it('recovers when the page reports an uncaught error', () => {
    document.body.innerHTML = '<div data-app-loading="beat"></div>'
    loadRuntime()

    window.dispatchEvent(new Event('error'))

    expect(document.querySelector('[data-app-loading]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('recovers when the page reports an unhandled rejection', () => {
    document.body.innerHTML = '<div data-app-loading="beat"></div>'
    loadRuntime()

    window.dispatchEvent(new Event('unhandledrejection'))

    expect(document.querySelector('[data-app-loading]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the mask when the error fallback is disabled', () => {
    document.body.innerHTML = '<div data-app-loading="beat"></div>'
    loadRuntime({ hideOnError: false })

    window.dispatchEvent(new Event('error'))

    expect(document.querySelector('[data-app-loading]')?.getAttribute('aria-hidden')).toBeNull()
  })

  it('keeps the mask until the timeout elapses', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div data-app-loading="beat"></div>'
    loadRuntime({ timeout: 5000 })

    vi.advanceTimersByTime(4999)
    expect(document.querySelector('[data-app-loading]')?.getAttribute('aria-hidden')).toBeNull()

    vi.advanceTimersByTime(1)
    expect(document.querySelector('[data-app-loading]')?.getAttribute('aria-hidden')).toBe('true')
  })
})
