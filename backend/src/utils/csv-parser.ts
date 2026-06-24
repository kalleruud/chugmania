import AuthManager from '../managers/auth.manager'

type CsvValue = string | number | Date | Buffer
type CsvRecord = Record<string, CsvValue>

class CsvParserClass {
  private readonly JAN_01_2000 = 946681200000
  private readonly DATE_KEYS = new Set([
    'createdAt',
    'updatedAt',
    'deletedAt',
    'date',
  ])

  async toObjects(csv: string): Promise<CsvRecord[]> {
    const lines = CsvParser.parseLines(csv.trim())
    if (lines.length === 0) return []

    const headerLine = lines[0]
    const dataLines = lines.slice(1)

    return await Promise.all(
      dataLines.map(async values => {
        const entries = new Map()

        const keyValues = await Promise.all(
          headerLine.map(async (header, i) => {
            const key = header.trim()
            return key ? CsvParser.normalize(key, values[i]) : null
          })
        )

        for (const keyVal of keyValues) {
          if (keyVal) entries.set(keyVal.key, keyVal.value)
        }

        return Object.fromEntries(entries) as CsvRecord
      })
    )
  }

  private parseLines(csv: string): string[][] {
    const state = {
      lines: [] as string[][],
      currentLine: [] as string[],
      currentField: '',
      inQuotes: false,
      i: 0,
    }

    while (state.i < csv.length) {
      const char = csv[state.i]

      if (char === '"') {
        CsvParser.handleQuote(csv, state)
      } else if (char === ',' && !state.inQuotes) {
        CsvParser.handleFieldDelimiter(state)
      } else if ((char === '\n' || char === '\r') && !state.inQuotes) {
        CsvParser.handleLineDelimiter(csv, state)
      } else {
        state.currentField += char
        state.i++
      }
    }

    CsvParser.finalizeParsing(state)
    return state.lines
  }

  private handleQuote(
    csv: string,
    state: {
      currentField: string
      inQuotes: boolean
      i: number
    }
  ): void {
    if (state.inQuotes && csv[state.i + 1] === '"') {
      state.currentField += '"'
      state.i += 2
    } else {
      state.inQuotes = !state.inQuotes
      state.i++
    }
  }

  private handleFieldDelimiter(state: {
    currentLine: string[]
    currentField: string
    i: number
  }): void {
    state.currentLine.push(state.currentField)
    state.currentField = ''
    state.i++
  }

  private handleLineDelimiter(
    csv: string,
    state: {
      lines: string[][]
      currentLine: string[]
      currentField: string
      i: number
    }
  ): void {
    if (state.currentField || state.currentLine.length > 0) {
      state.currentLine.push(state.currentField)
    }
    if (state.currentLine.length > 0) {
      state.lines.push(state.currentLine)
    }
    state.currentLine = []
    state.currentField = ''
    if (csv[state.i] === '\r' && csv[state.i + 1] === '\n') {
      state.i += 2
    } else {
      state.i++
    }
  }

  private finalizeParsing(state: {
    lines: string[][]
    currentLine: string[]
    currentField: string
  }): void {
    if (state.currentField || state.currentLine.length > 0) {
      state.currentLine.push(state.currentField)
    }
    if (state.currentLine.length > 0) {
      state.lines.push(state.currentLine)
    }
  }

  private async normalize(
    key: string,
    value: string | undefined
  ): Promise<{ key: string; value: CsvValue } | null> {
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

  toCsv(objects: Record<string, unknown>[]): string | null {
    if (objects.length === 0) {
      console.warn('No objects to convert to CSV')
      return null
    }

    const headers = Object.keys(objects[0])
    const rows = objects.map(obj =>
      headers
        .map(header => {
          const value = Object.entries(obj).find(([key]) => key === header)?.[1]
          if (value === null || value === undefined) return ''
          if (value instanceof Date) return value.toISOString()
          const str = (() => {
            if (typeof value === 'string') return value
            if (typeof value === 'number' || typeof value === 'boolean')
              return String(value)
            return JSON.stringify(value)
          })()
          if (str.includes(',') || str.includes('\n') || str.includes('"'))
            return `"${str.replaceAll('"', '""')}"`
          return str
        })
        .join(',')
    )

    return [headers.join(','), ...rows].join('\n')
  }
}

const CsvParser = new CsvParserClass()

export default CsvParser
