import fs from 'node:fs'
import path from 'node:path'
import { createLoadingTemplate, isLoadingType } from './animation.ts'
import type { LoadingType } from './types.ts'
import {
  appLoadingAttribute,
  appLoadingHiddenAttribute,
  appLoadingPreviewAttribute,
} from './constants.ts'
import { createRuntimeSource } from './runtime.ts'
import type { HtmlTagDescriptor, Plugin } from 'vite'

const pluginName = 'vite-plugin-loading'

/** CSS 标识符前缀：字母/下划线开头，可带一个前导 `-`。 */
const classPrefixPattern = /^-?[_a-zA-Z][\w-]*$/
/**
 * `themeColor` 是可信的构建配置，不是用户输入。这里拒绝这些分隔符，是为了让一个笔误无法逃出声明或
 * `style` 属性；这是防呆，不是安全边界。
 */
const unsafeCssValuePattern = /[;{}<>\\]|\/\*|[\r\n]/

/** 把不可信的值描述成人能读懂的类型，用于错误信息。 */
function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return `a ${typeof value}`
}

const virtualModuleId = 'virtual:app-loading'
const resolvedVirtualModuleId = `\0${virtualModuleId}`
const defaultClassPrefix = 'v-loader'
const defaultThemeColor = '#1677ff'
/** 淡出时长（毫秒）：CSS transition 与运行时移除遮罩的定时器共用。 */
const fadeOutDuration = 400
const defaultZIndex = 10000

const existingMaskPattern = /<[^>]*\sdata-app-loading(?=[\s=>/])/i
/**
 * 这些区域里的 `<div data-app-loading=…>` 只是一段文本（脚本字符串、注释、样式内容、未实例化的
 * 模板），不是页面里真实存在的遮罩。检测前先剥离，否则会误判成"已有遮罩"而静默跳过注入。
 */
const nonMarkupPattern =
  /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<template\b[^>]*>[\s\S]*?<\/template\s*>/gi

function hasExistingMask(html: string): boolean {
  return existingMaskPattern.test(html.replace(nonMarkupPattern, ''))
}

export interface LoadingOptions {
  /** 内置动画类型；默认 `beat`。设置了 `template` 时忽略此项。 */
  type?: LoadingType
  /** 注入遮罩内部的 HTML 文件，用来替代内置动画。 */
  template?: string
  /** class、keyframes 与 CSS 变量的前缀；默认 `v-loader`。 */
  classPrefix?: string
  /** 动画与标题使用的 CSS 颜色。 */
  themeColor?: string
  /** 是否启用跟随主题色的渐变遮罩；默认 `true`。 */
  maskBackground?: boolean
  /** 动画下方的 HTML；与 `template` 同用时仅作为无障碍标签。调用方需自行转义。 */
  title?: string
  /** 遮罩的层级；默认 `10000`。 */
  zIndex?: number
  /** 超过该毫秒数后隐藏遮罩；默认 `0`，即不启用定时器。 */
  timeout?: number
  /**
   * 应用产物加载后，页面出现未捕获错误或未处理的 Promise 拒绝时隐藏遮罩，避免启动失败后把用户
   * 永久困在遮罩后面。如果产物完全没有执行（例如入口 chunk 下载失败）则无能为力，那种情况需要
   * 开启 `timeout`。默认 `true`。
   */
  hideOnError?: boolean
}

export type AppLoadingOptions = string | LoadingOptions

interface ResolvedLoadingOptions {
  type: LoadingType
  classPrefix: string
  themeColor: string
  maskBackground: boolean
  title: string | undefined
  zIndex: number
  timeout: number
  hideOnError: boolean
  template: string | undefined
}

interface LoadingMask {
  /** 遮罩的原始样式表，作为 `<style>` 注入文档 head。 */
  css: string
  /** 遮罩元素的属性集合。 */
  attrs: Record<string, string>
  /** 放进遮罩元素内部的标记。 */
  content: string
}

function fail(message: string): never {
  throw new Error(`${pluginName}: ${message}`)
}

function readNumber(value: number | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`${name} must be a finite number >= 0`)
  }
  return value
}

/** `z-index` 只接受整数：小数会让整条声明失效，遮罩掉回默认层叠顺序且没有任何报错。 */
function readInteger(value: number | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < 0) fail(`${name} must be an integer >= 0`)
  return value
}

function readBoolean(value: boolean | undefined, name: string, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') fail(`${name} must be a boolean`)
  return value
}

function assertOptions(option: AppLoadingOptions | undefined): LoadingOptions {
  if (option === undefined) return {}
  if (typeof option === 'string') return { template: option }
  if (option === null || typeof option !== 'object' || Array.isArray(option)) {
    fail(`options must be an object or a template path, received ${describe(option)}`)
  }
  return option
}

function resolveOptions(options: LoadingOptions): ResolvedLoadingOptions {
  const classPrefix = options.classPrefix ?? defaultClassPrefix
  if (!classPrefixPattern.test(classPrefix)) fail(`invalid classPrefix "${classPrefix}"`)

  const themeColor = options.themeColor ?? defaultThemeColor
  if (
    typeof themeColor !== 'string' ||
    !themeColor.trim() ||
    unsafeCssValuePattern.test(themeColor)
  ) {
    fail('invalid themeColor')
  }

  const type = options.type ?? 'beat'
  if (!isLoadingType(type)) fail(`unsupported loading type "${String(type)}"`)

  if (options.template !== undefined) {
    if (typeof options.template !== 'string') {
      fail(`template must be a string, received ${describe(options.template)}`)
    }
    if (!options.template.trim()) fail('template path must not be empty')
  }
  if (options.title !== undefined && typeof options.title !== 'string') {
    fail('title must be a string')
  }

  return {
    type,
    classPrefix,
    themeColor,
    maskBackground: readBoolean(options.maskBackground, 'maskBackground', true),
    title: options.title || undefined,
    zIndex: readInteger(options.zIndex, 'zIndex', defaultZIndex),
    timeout: readNumber(options.timeout, 'timeout', 0),
    hideOnError: readBoolean(options.hideOnError, 'hideOnError', true),
    template: options.template,
  }
}

function renderMask(
  options: ResolvedLoadingOptions,
  customTemplate: string | undefined,
): LoadingMask {
  const { classPrefix, themeColor, maskBackground, title, zIndex } = options
  const surface = `var(--${classPrefix}-mask-color,var(--${classPrefix}-auto-mask-color,#fff))`
  // 主题色只作为一层很淡的氛围光：左上角一团柔和的径向光晕，叠加一层轻微的纵向渐变。
  // 相比整块斜向染色，局部光晕的视觉重量更低，明暗过渡也更自然。
  const themeTint = (amount: number) =>
    `color-mix(in srgb,var(--${classPrefix}-theme-color) ${amount}%,transparent)`
  const gradient =
    `radial-gradient(120% 80% at 18% 0%,${themeTint(9)},transparent 62%),` +
    `linear-gradient(165deg,color-mix(in srgb,var(--${classPrefix}-theme-color) 5%,${surface}),${surface} 58%)`
  const declarations =
    `--${classPrefix}-theme-color:${themeColor}` +
    `;position:fixed;inset:0;z-index:${zIndex}` +
    ';display:grid;place-items:center;user-select:none' +
    `;background:${surface};background:${maskBackground ? gradient : surface}` +
    `;transition:opacity ${fadeOutDuration}ms cubic-bezier(.22,1,.36,1)`

  let css =
    `.${classPrefix}-mask{${declarations}}` +
    `@media(prefers-color-scheme:dark){.${classPrefix}-mask{--${classPrefix}-auto-mask-color:#101316}}`
  let content: string

  if (customTemplate === undefined) {
    const template = createLoadingTemplate(classPrefix, title, options.type)
    css = `${template.css}${css}`
    content = template.html
  } else {
    content = customTemplate
  }

  return {
    css,
    attrs: {
      class: `${classPrefix}-mask`,
      [appLoadingAttribute]: customTemplate === undefined ? options.type : 'custom',
      role: 'status',
      'aria-label': title || 'Loading',
    },
    content,
  }
}

function stripQuery(id: string): string {
  const queryIndex = id.indexOf('?')
  return queryIndex === -1 ? id : id.slice(0, queryIndex)
}

export function appLoading(option?: AppLoadingOptions): Plugin {
  const options = resolveOptions(assertOptions(option))
  let templatePath: string | undefined

  return {
    name: pluginName,
    enforce: 'pre',
    configResolved(config) {
      if (options.template === undefined) return
      templatePath = path.resolve(config.root, options.template)
      try {
        fs.accessSync(templatePath, fs.constants.R_OK)
      } catch {
        fail(`custom template not found at "${templatePath}"`)
      }
    },
    configureServer(server) {
      if (templatePath === undefined) return
      server.watcher.add(templatePath)
      server.watcher.on('change', (file) => {
        if (path.resolve(file) !== templatePath) return
        server.ws.send({ type: 'full-reload', path: '*' })
      })
    },
    resolveId(id) {
      return stripQuery(id) === virtualModuleId ? resolvedVirtualModuleId : undefined
    },
    load(id) {
      const cleanId = stripQuery(id)
      if (cleanId !== resolvedVirtualModuleId && cleanId !== virtualModuleId) return undefined
      const runtime = createRuntimeSource({
        fadeDuration: fadeOutDuration,
        hideOnError: options.hideOnError,
        timeout: options.timeout,
      })
      return `${runtime}\nexport { hideAppLoading }\n`
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (hasExistingMask(html)) return html

        let customTemplate: string | undefined
        if (templatePath !== undefined) {
          // 每次转换都重新读取，这样修改模板无需重启 dev server 即可生效。
          ctx?.server?.watcher.add(templatePath)
          try {
            customTemplate = fs.readFileSync(templatePath, 'utf8')
          } catch {
            fail(`custom template not found at "${templatePath}"`)
          }
        }

        const mask = renderMask(options, customTemplate)
        const tags: HtmlTagDescriptor[] = [
          // 用 `head` 而不是 `head-prepend`：`<style>` 不能插到 `<meta charset>` 声明之前，
          // 浏览器只在文档前 1024 字节内读取该声明。
          { tag: 'style', children: mask.css, injectTo: 'head' },
          // 放在应用根节点之前，遮罩无需等待 body 其余部分解析完即可绘制。
          { tag: 'div', attrs: mask.attrs, children: mask.content, injectTo: 'body-prepend' },
        ]
        return { html, tags }
      },
    },
  }
}

export {
  appLoadingAttribute,
  appLoadingHiddenAttribute,
  appLoadingPreviewAttribute,
  virtualModuleId,
}
