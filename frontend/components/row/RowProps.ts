import type { ComponentProps } from 'react'

/**
 * Base props for all Row components
 * @template T - The data item type (UserInfo, Track, Session, TimeEntry, etc.)
 */
export type BaseRowProps<T> = {
  item: T
  highlight?: boolean
  hideLink?: boolean
} & ComponentProps<'div'>
