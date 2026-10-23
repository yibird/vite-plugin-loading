import {
  createLoadingTemplate,
  loadingTypes,
  type LoadingType,
} from '@starweave-lab/vite-plugin-loading/animation'

export interface AnimationPreview {
  type: LoadingType
  html: string
}

/** 生成全部内置动画的预览标记与样式，供示例页面展示。 */
export function createAnimationPreviews(classPrefix: string): {
  css: string
  previews: AnimationPreview[]
} {
  const templates = loadingTypes.map((type) => ({
    type,
    ...createLoadingTemplate(classPrefix, undefined, type),
  }))

  return {
    css: templates.map((template) => template.css).join(''),
    previews: templates.map(({ type, html }) => ({ type, html })),
  }
}
