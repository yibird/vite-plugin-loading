/** 承载当前动画类型的属性。由插件写入，属于公开 API。 */
export const appLoadingAttribute = 'data-app-loading'

/** 预览标记。带有该属性的元素会被 `hideAppLoading()` 忽略。属于公开 API。 */
export const appLoadingPreviewAttribute = 'data-app-loading-preview'

/** 隐藏进行中时写在遮罩上的标记，用于让 `hideAppLoading()` 幂等。属于公开 API。 */
export const appLoadingHiddenAttribute = 'data-app-loading-hidden'

export const loadingTypes = [
  'bars',
  'flip',
  'beat',
  'dot',
  'spinner',
  'progress',
  'ring',
  'ripple',
] as const
