import * as csv from 'fast-csv'
import { Readable } from 'node:stream'
import AuthManager from '../managers/auth.manager'

export default class CsvParser {
  private static readonly JAN_01_2000 = 946681200000
  private static readonly DATE_KEYS = new Set([
    'createdAt',
    'updatedAt',
    'deletedAt',
    'date',
  ])

  static async toObjects(csvString: string): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, any>[] = []
      const stream = Readable.from([csvString])

      stream
        .pipe(csv.parse({ headers: true }))
        .on('error', reject)
        .on('data', async (row: Record<string, string>) => {
          const normalized = await CsvParser.normalizeRow(row)
          rows.push(normalized)
        })
        .on('end', () => resolve(rows))
    })
  }

  private static async normalizeRow(
    row: Record<string, string>
  ): Promise<Record<string, any>> {
    const normalized: Record<string, any> = {}

    for (const [key, value] of Object.entries(row)) {
      const keyVal = await CsvParser.normalize(key, value)
      if (keyVal) {
        normalized[keyVal.key] = keyVal.value
      }
    }

    return normalized
  }

  private static async normalize(
    key: string,
    value: string | undefined
  ): Promise<{ key: string; value: any } | null> {
    const val = value?.trim()
    if (!val) return null

    if (key === 'password') {
      return { key: 'passwordHash', value: await AuthManager.hash(val) }
    }

    if (
      CsvParser.DATE_KEYS.has(key) ||
      (Number.isInteger(val) && Number.parseInt(val) >= CsvParser.JAN_01_2000)
    ) {
      return {
        key,
        value: new Date(Number.isInteger(val) ? Number.parseInt(val) : val),
      }
    }

    if (Number.isInteger(+val)) {
      return { key, value: Number.parseFloat(val) }
    }

    return { key, value: val }
  }

  public static toCsv<T extends Record<string, any>>(
    objects: T[]
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const output: string[] = []

      const formatter = csv.format({ headers: true })

      formatter
        .on('data', (chunk: Buffer) => {
          output.push(chunk.toString())
        })
        .on('error', reject)
        .on('end', () => {
          resolve(output.join(''))
        })

      objects.forEach(obj => formatter.write(obj))
      formatter.end()
    })
  }
}
