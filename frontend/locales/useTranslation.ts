import { no } from './no'

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]> & string}`
          : K
        : never
    }[keyof T]
  : never

type TranslationKey = NestedKeyOf<typeof no>

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }

  return current
}

export function useTranslation() {
  const t = (
    key: TranslationKey,
    params?: Record<string, string | number>
  ): string => {
    const value = getNestedValue(no, key)

    if (typeof value !== 'string') {
      console.warn(`Translation key not found or is not a string: ${key}`)
      return key
    }

    if (!params) {
      return value
    }

    let result = value
    for (const [paramKey, paramValue] of Object.entries(params)) {
      result = result.replaceAll(`{{${paramKey}}}`, String(paramValue))
    }

    return result
  }

  return { t }
}
