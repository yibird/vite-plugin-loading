import { appLoadingAttribute, loadingTypes } from './constants.ts'
import type { LoadingType } from './types.ts'
export {
  appLoadingAttribute,
  appLoadingHiddenAttribute,
  appLoadingPreviewAttribute,
  loadingTypes,
} from './constants.ts'
export type { LoadingType } from './types.ts'

const loadingTypeSet: ReadonlySet<string> = new Set(loadingTypes)

export function isLoadingType(value: unknown): value is LoadingType {
  return typeof value === 'string' && loadingTypeSet.has(value)
}

function barsTemplate(selector: string, classPrefix: string): string {
  const child = `${selector}>i`
  const animationName = `${classPrefix}-bars-a`
  const delays = ['.07s', '.14s', '.21s', '.28s']

  return (
    `${selector}{width:50px;height:34px;display:flex;gap:5px;align-items:center;` +
    'justify-content:center;contain:content}' +
    `${child}{display:block;width:6px;height:34px;background:currentColor;border-radius:999px;` +
    'opacity:.45;transform:scaleY(.46);will-change:transform;' +
    `animation:${animationName} .75s ease-in-out infinite}` +
    delays
      .map((delay, index) => `${child}:nth-child(${index + 2}){animation-delay:${delay}}`)
      .join('') +
    `@keyframes ${animationName}{` +
    '0%,100%{opacity:.45;transform:scaleY(.46)}' +
    '50%{opacity:1;transform:scaleY(1)}}'
  )
}

function flipTemplate(selector: string, classPrefix: string): string {
  const animationName = `${classPrefix}-flip-a`

  return (
    `${selector}{width:48px;height:48px;background:currentColor;border-radius:8px;` +
    `will-change:transform;animation:${animationName} 1.12s cubic-bezier(.37,0,.63,1) infinite}` +
    `@keyframes ${animationName}{` +
    '0%{transform:perspective(200px) rotateX(0deg) rotateY(0deg)}' +
    '50%{transform:perspective(200px) rotateX(-180deg) rotateY(0deg)}' +
    '100%{transform:perspective(200px) rotateX(-180deg) rotateY(-180deg)}}'
  )
}

function beatTemplate(selector: string, classPrefix: string): string {
  const spinAnimation = `${classPrefix}-beat-a`
  const shadowAnimation = `${classPrefix}-beat-s`

  return (
    `${selector}{width:48px;height:48px;position:relative;overflow:visible}` +
    `${selector}::before,${selector}::after{content:'';position:absolute;left:0;width:100%;background:currentColor}` +
    `${selector}::before{height:5px;opacity:.25;top:60px;border-radius:50%;` +
    `will-change:transform;animation:${shadowAnimation} .5s linear infinite}` +
    `${selector}::after{height:100%;animation:${spinAnimation} .5s linear infinite;` +
    'top:0;border-radius:8px;contain:paint;will-change:transform}' +
    `@keyframes ${spinAnimation}{` +
    '17%{border-bottom-right-radius:6px}' +
    '25%{transform:translateY(9px) rotate(22.5deg)}' +
    '50%{transform:translateY(18px) scale(1,.9) rotate(45deg);border-bottom-right-radius:40px}' +
    '75%{transform:translateY(9px) rotate(67.5deg)}' +
    '100%{transform:translateY(0) rotate(90deg)}}' +
    `@keyframes ${shadowAnimation}{` +
    '0%,100%{transform:scale(1)}' +
    '50%{transform:scale(1.2,1)}}'
  )
}

function dotTemplate(selector: string, classPrefix: string): string {
  const child = `${selector}>i`
  const names = [1, 2, 3].map((index) => `${classPrefix}-dot-a${index}`)
  const rest = 'transform:translateY(7px)'
  const top = 'transform:translateY(0)'
  const bottom = 'transform:translateY(14px)'

  const frames = [
    `0%{${rest}}20%{${top}}40%{${bottom}}60%,100%{${rest}}`,
    `0%,20%{${rest}}40%{${top}}60%{${bottom}}80%,100%{${rest}}`,
    `0%,40%{${rest}}60%{${top}}80%{${bottom}}100%{${rest}}`,
  ]

  return (
    `${selector}{width:60px;height:30px;display:flex;justify-content:space-between;` +
    'align-items:flex-start;contain:content}' +
    `${child}:nth-child(-n+3){display:block;width:20px;height:16px;${rest};` +
    'background:radial-gradient(circle closest-side,currentColor 90%,#0000);' +
    'will-change:transform;animation-duration:1s;animation-timing-function:ease-in-out;' +
    'animation-iteration-count:infinite}' +
    names
      .map((name, index) => `${child}:nth-child(${index + 1}){animation-name:${name}}`)
      .join('') +
    names.map((name, index) => `@keyframes ${name}{${frames[index]}}`).join('')
  )
}

function spinnerTemplate(selector: string, classPrefix: string): string {
  const animationName = `${classPrefix}-spinner-a`

  return (
    `${selector}{width:50px;height:50px;border-radius:50%;background:` +
    'radial-gradient(farthest-side,currentColor 94%,#0000) top/8px 8px no-repeat,' +
    'conic-gradient(#0000 30%,currentColor 46%);' +
    '-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 8px),#000 0);' +
    'mask:radial-gradient(farthest-side,#0000 calc(100% - 8px),#000 0);' +
    `will-change:transform;animation:${animationName} 1s linear infinite}` +
    `@keyframes ${animationName}{100%{transform:rotate(1turn)}}`
  )
}

function progressTemplate(selector: string, classPrefix: string): string {
  const animationName = `${classPrefix}-progress-a`
  const maskVariable = `--${classPrefix}-progress-mask`
  const bar = `${selector}>i:first-child`
  const tile =
    `url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='24'` +
    `%20height='20'%3E%3Crect%20x='3.6'%20width='16.8'%20height='20'%20rx='4'%20fill='%23fff'/%3E` +
    `%3C/svg%3E")`

  return (
    `${selector}{width:120px;height:20px;margin-left:-50%;overflow:hidden;${maskVariable}:${tile};` +
    `-webkit-mask:var(${maskVariable}) 0/20% 100%;mask:var(${maskVariable}) 0/20% 100%;` +
    'background:transparent;' +
    'background:color-mix(in srgb,currentColor 18%,transparent)}' +
    `${bar}{display:block;width:100%;height:100%;background:currentColor;transform-origin:0 50%;` +
    'transform:scaleX(0);will-change:transform;' +
    `animation:${animationName} 2s steps(6) infinite}` +
    `@keyframes ${animationName}{0%{transform:scaleX(0)}100%{transform:scaleX(1.2)}}`
  )
}

function ringTemplate(selector: string, classPrefix: string): string {
  const rotate = `${classPrefix}-ring-a`
  const pulse = `${classPrefix}-ring-core`
  const core = `${selector}>i:first-child`

  return (
    `${selector}{position:relative;width:48px;height:48px}` +
    `${selector}::before,${selector}::after{content:'';position:absolute;inset:0;border-radius:50%}` +
    `${selector}::before{border:4px solid currentColor;opacity:.12}` +
    `${selector}::after{border:4px solid transparent;border-top-color:currentColor;` +
    `border-right-color:currentColor;will-change:transform;animation:${rotate} .78s linear infinite}` +
    `${core}{display:block;position:absolute;inset:14px;border-radius:50%;` +
    'background:transparent;background:color-mix(in srgb,currentColor 10%,transparent);' +
    `will-change:transform;animation:${pulse} 1.1s ease-in-out infinite}` +
    `@keyframes ${rotate}{to{transform:rotate(1turn)}}` +
    `@keyframes ${pulse}{0%,100%{opacity:.46;transform:scale(.78)}50%{opacity:1;transform:scale(1)}}`
  )
}

function rippleTemplate(selector: string, classPrefix: string): string {
  const animationName = `${classPrefix}-ripple-a`
  const ring = `${selector}::before,${selector}::after,${selector}>i:first-child`

  return (
    `${selector}{position:relative;width:64px;height:64px}` +
    `${selector}::before,${selector}::after{content:''}` +
    `${ring}{display:block;position:absolute;inset:0;border:6px solid currentColor;border-radius:50%;` +
    'opacity:.3;transform:scale(.62);will-change:transform;' +
    `animation:${animationName} 1.8s linear infinite}` +
    `${selector}::after{animation-delay:-.6s}` +
    `${selector}>i:first-child{animation-delay:-1.2s}` +
    `@keyframes ${animationName}{` +
    '0%{opacity:0;transform:scale(.3)}' +
    '35%{opacity:.9;transform:scale(.65)}' +
    '100%{opacity:0;transform:scale(1)}}'
  )
}

const templateFactories: Record<LoadingType, (selector: string, classPrefix: string) => string> = {
  bars: barsTemplate,
  flip: flipTemplate,
  beat: beatTemplate,
  dot: dotTemplate,
  spinner: spinnerTemplate,
  progress: progressTemplate,
  ring: ringTemplate,
  ripple: rippleTemplate,
}

/**
 * 创建loading模板
 *
 * @param classPrefix loading 类名前缀
 * @param title 标题
 * @param type loading动画类型
 * @returns 包含css和html内容的对象
 */
export function createLoadingTemplate(
  classPrefix: string,
  title: string | undefined,
  type: LoadingType,
) {
  const maskClass = `${classPrefix}-mask`
  const stageClass = `${classPrefix}-stage`
  const animationClass = `${classPrefix}-animation`
  const contentStyles =
    `.${classPrefix}-content{display:grid;place-items:center;gap:24px;color:var(--${classPrefix}-theme-color)}` +
    `.${stageClass}{width:60px;height:65px;display:grid;place-items:center;overflow:visible}` +
    `[${appLoadingAttribute}=beat] .${stageClass}{place-items:start center}` +
    `.${animationClass}{display:block}` +
    `.${animationClass}>i{display:none}` +
    (title
      ? `.${classPrefix}-title{max-width:min(80vw,30rem);margin:0;padding-inline:16px;color:currentColor;opacity:.86;text-align:center;font-size:16px;font-weight:600}`
      : '')
  const animationStyles = templateFactories[type](
    `[${appLoadingAttribute}=${type}] .${animationClass}`,
    classPrefix,
  )
  const loadingHtml =
    `<div class="${stageClass}">` +
    `<span class="${animationClass}" aria-hidden="true">${'<i></i>'.repeat(5)}</span>` +
    '</div>'
  const reducedMotionStyles = `@media(prefers-reduced-motion:reduce){.${maskClass}{transition:none!important}.${animationClass},.${animationClass}::before,.${animationClass}::after,.${animationClass}>i{animation:none!important;will-change:auto!important}}`
  const textHtml = title ? `<p class="${classPrefix}-title">${title}</p>` : ''
  const html = `<div class="${classPrefix}-content">${loadingHtml}${textHtml}</div>`

  return {
    css: `${contentStyles}${animationStyles}${reducedMotionStyles}`,
    html,
  }
}
