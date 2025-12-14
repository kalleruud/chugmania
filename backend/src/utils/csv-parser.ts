import AuthManager from '../managers/auth.manager'

export default class CsvParser {
  private static readonly JAN_01_2000 = 946681200000
  private static readonly DATE_KEYS = new Set([
    'createdAt',
    'updatedAt',
    'deletedAt',
    'date',
  ])

  static async toObjects(csv: string) {
    const [headerLine, ...lines] = csv.trim().split('\n')
    const headers = headerLine.split(',')

    return await Promise.all(
      lines.map(async line => {
        const values = line.split(',')
        const entries = new Map()

        for (let i = 0; i < headers.length; i++) {
          const k = headers.at(i)?.trim()
          if (!k) continue
          const keyVal = await CsvParser.normalize(k, values.at(i))
          if (!keyVal) continue
          entries.set(keyVal.key, keyVal.value)
        }

        return Object.fromEntries(entries) as Record<string, any>
      })
    )
  }

  private static async normalize(key: string, value: string | undefined) {
    const val = value?.replaceAll('"', "'").trim()
    if (!val) return { key, value: null }

    if (
      CsvParser.DATE_KEYS.has(key) ||
      (Number.isInteger(val) && Number.parseInt(val) >= CsvParser.JAN_01_2000)
    )
      return { key, value: new Date(Number.parseInt(val)) }

    if (key === 'password') {
      return { key: 'passwordHash', value: await AuthManager.hash(val) }
    }

    return { key, value: val }
  }

  public static toCsv<T extends Record<string, any>>(
    objects: T[]
  ): string | null {
    if (objects.length === 0) {
      console.warn('No objects to convert to CSV')
      return null
    }

    const headers = Object.keys(objects[0])
    const rows = objects.map(obj =>
      headers
        .map(header => {
          const value = obj[header]
          if (value === null || value === undefined) return ''
          if (value instanceof Date) return String(value.getTime())
          const str = String(value)
          if (str.includes(',') || str.includes('\n') || str.includes('"'))
            return `"${str.replaceAll(/"/g, '""')}"`
          return str
        })
        .join(',')
    )

    return [headers.join(','), ...rows].join('\n')
  }
}
