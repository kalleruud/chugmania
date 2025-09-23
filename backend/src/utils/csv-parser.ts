import AuthManager from '../managers/auth.manager'

export default class CsvParser {
  static parse<T>(csv: string, validate?: (obj: any) => obj is T): T[] {
    const [headerLine, ...lines] = csv.trim().split('\n')
    const headers = headerLine.split(',')

    const objects = lines.map(line => {
      const values = line.split(',')
      return Object.fromEntries(
        headers.map((key, i) => [key, this.normalize(key, values[i])])
      )
    })

    if (!validate) return objects as T[]
    return objects.filter(validate) as T[]
  }

  private static async normalize(key: string, value: string) {
    const val = value.trim()
    if (val === '') return undefined
    if (val === 'true') return true
    if (val === 'false') return false
    if (!val) return undefined

    switch (key) {
      case 'created_at':
      case 'updated_at':
      case 'deleted_at':
      case 'duration':
      case 'amount':
        return parseFloat(val)
      case 'password':
        return await AuthManager.hash(val)
    }

    if (this.isNumeric(value)) return parseFloat(value)
    return val
  }

  private static isNumeric(str: any): str is number {
    if (typeof str === 'number') return true
    if (typeof str !== 'string') return false
    return !isNaN(parseFloat(str))
  }
}
