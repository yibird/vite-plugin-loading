import type { loadingTypes } from './constants.ts'

/** 内置动画标识。 */
export type LoadingType = (typeof loadingTypes)[number]
