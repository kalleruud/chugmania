import { DEFAULT_ZONE } from '@common/utils/date'
import { DateTime } from 'luxon'
import BooleanValue from './BooleanValue'
import CollectionValue from './CollectionValue'
import DateValue from './DateValue'
import EmptyValue from './EmptyValue'
import JsonValue from './JsonValue'
import NumberValue from './NumberValue'
import StringValue from './StringValue'

export default function ObjectValue({
  value,
  fieldName = '',
  ancestors,
  expanded = false,
}: Readonly<{
  value: unknown
  fieldName?: string
  ancestors: object[]
  expanded?: boolean
}>) {
  if (value === null || value === undefined || value === '')
    return <EmptyValue value={value} />
  if (value instanceof Date) {
    const date = DateTime.fromJSDate(value)
    if (date.isValid) return <DateValue value={date} />
    return <StringValue value={String(value)} />
  }
  if (typeof value === 'boolean') return <BooleanValue value={value} />
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (fieldName === 'date' || /(?:At|_at)$/.test(fieldName))
  ) {
    const date = DateTime.fromMillis(value)
    if (date.isValid) return <DateValue value={date} />
  }
  if (typeof value === 'number' || typeof value === 'bigint')
    return <NumberValue value={value} />
  if (typeof value === 'string') {
    if (
      /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
        value
      )
    ) {
      const date = DateTime.fromISO(value, { zone: DEFAULT_ZONE })
      if (date.isValid)
        return <DateValue value={date} dateOnly={value.length === 10} />
    }
    const json = parseJson(value)
    if (json !== undefined) return <JsonValue value={json} />
    return <StringValue value={value} />
  }
  if (typeof value === 'object')
    return (
      <CollectionValue
        value={value}
        ancestors={ancestors}
        expanded={expanded}
      />
    )
  if (typeof value === 'symbol') return <StringValue value={value.toString()} />
  return <StringValue value='[Function]' />
}

function parseJson(value: string): object | undefined {
  const trimmed = value.trimStart()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed !== null && typeof parsed === 'object') return parsed
  } catch {
    return undefined
  }
}
