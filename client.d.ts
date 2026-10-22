declare module 'virtual:app-loading' {
  /**
   * 淡出注入的 loading 遮罩并将其从 DOM 中移除。
   *
   * 遮罩不存在时调用是安全的，重复调用也是安全的。带有 `data-app-loading-preview` 的元素会被跳过，
   * 因此应用自行渲染的预览不会被误删。
   */
  export function hideAppLoading(): void
}
