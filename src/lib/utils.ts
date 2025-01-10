import { CalendarDate } from '@internationalized/date'
import { type ClassValue, clsx } from 'clsx'
import { cubicOut } from 'svelte/easing'
import type { TransitionConfig } from 'svelte/transition'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type FlyAndScaleParams = {
  y?: number
  x?: number
  start?: number
  duration?: number
}

export const flyAndScale = (
  node: Element,
  params: FlyAndScaleParams = { y: -8, x: 0, start: 0.95, duration: 150 }
): TransitionConfig => {
  const style = getComputedStyle(node)
  const transform = style.transform === 'none' ? '' : style.transform

  const scaleConversion = (valueA: number, scaleA: [number, number], scaleB: [number, number]) => {
    const [minA, maxA] = scaleA
    const [minB, maxB] = scaleB

    const percentage = (valueA - minA) / (maxA - minA)
    const valueB = percentage * (maxB - minB) + minB

    return valueB
  }

  const styleToString = (style: Record<string, number | string | undefined>): string => {
    return Object.keys(style).reduce((str, key) => {
      if (style[key] === undefined) return str
      return str + `${key}:${style[key]};`
    }, '')
  }

  return {
    duration: params.duration ?? 200,
    delay: 0,
    css: t => {
      const y = scaleConversion(t, [0, 1], [params.y ?? 5, 0])
      const x = scaleConversion(t, [0, 1], [params.x ?? 0, 0])
      const scale = scaleConversion(t, [0, 1], [params.start ?? 0.95, 1])

      return styleToString({
        transform: `${transform} translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        opacity: t,
      })
    },
    easing: cubicOut,
  }
}

export function getFormString(key: string, form: FormData): string | undefined {
  const value = form.get(key) as string | null
  if (!value || value.length === 0) return undefined
  return value
}

export function getFormValue<T>(key: string, form: FormData): T | undefined {
  return getFormString(key, form) as T | undefined
}

export async function hash(value: string) {
  return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
}

export function toRelativeLocaleDateString(then: Date, locales: Intl.LocalesArgument = 'nb') {
  const today = new Date()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  if (then.toDateString() === today.toDateString()) return 'I dag'
  if (then.toDateString() === yesterday.toDateString()) return 'I går'
  if (then.toDateString() === tomorrow.toDateString()) return 'I morgen'

  if (then >= lastWeek && then <= today)
    return 'Forrige ' + then.toLocaleDateString(locales, { weekday: 'long' })

  if (then >= today && then <= nextWeek)
    return 'Neste ' + then.toLocaleDateString(locales, { weekday: 'long' })

  return then.toLocaleDateString(locales, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function fromString(value: string): CalendarDate {
  const date = new Date(Date.parse(value))
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function fromDate(value: Date): CalendarDate {
  return new CalendarDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
}
