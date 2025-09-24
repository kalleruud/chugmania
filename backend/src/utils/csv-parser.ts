import AuthManager from '../managers/auth.manager'

export default class CsvParser {
  static async parse<T>(csv: string): Promise<T[]> {
    const [headerLine, ...lines] = csv.trim().split('\n')
    const headers = headerLine.split(',')

    const objects: object[] = []
    for (const line of lines) {
      const values = line.split(',')
      const entries = new Map()

      for (let i = 0; i < headers.length; i++) {
        const k = headers.at(i)?.trim()
        if (!k) continue
        const { key, value } = await CsvParser.normalize(k, values.at(i))
        if (value === null) continue
        entries.set(key, value)
      }

      objects.push(Object.fromEntries(entries))
    }

    return objects as T[]
  }

  private static async normalize(key: string, value: string | undefined) {
    const val = value?.replaceAll('"', '').trim()
    if (val === '' || val === undefined) return { key, value: null }

    if (key.endsWith('At')) return { key, value: new Date(parseFloat(val)) }

    if (key === 'password')
      return { key: 'passwordHash', value: await AuthManager.hash(val) }

    return { key, value: val }
  }
}
