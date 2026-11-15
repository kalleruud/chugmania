import loc from '@common/locale/locales'
import { useState } from 'react'
import ObjectValue from './ObjectValue'

export default function CollectionValue({
  value,
  ancestors,
  expanded = false,
}: Readonly<{ value: object; ancestors: object[]; expanded?: boolean }>) {
  const [open, setOpen] = useState(false)
  if (ancestors.includes(value))
    return (
      <span className='text-sm text-muted-foreground'>
        {loc.no.objectViewer.circular}
      </span>
    )
  const entries: [string, unknown][] = Object.entries(value)
  if (entries.length === 0)
    return (
      <code className='text-sm text-muted-foreground'>
        {Array.isArray(value) ? '[]' : '{}'}
      </code>
    )
  const fields = (expanded || open) && (
    <dl className='min-w-0 divide-y rounded-md border bg-background-secondary/40'>
      {entries.map(([key, entry]) => (
        <div
          key={key}
          className='grid min-w-0 gap-2 p-3 sm:grid-cols-[minmax(8rem,1fr)_minmax(0,3fr)] sm:gap-4'>
          <dt
            title={key}
            className='text-xs font-medium tracking-wide break-words text-muted-foreground'>
            {fieldLabel(key)}
          </dt>
          <dd className='min-w-0 text-sm'>
            <ObjectValue
              value={entry}
              fieldName={key}
              ancestors={[...ancestors, value]}
            />
          </dd>
        </div>
      ))}
    </dl>
  )
  if (expanded) return fields
  return (
    <details
      onToggle={event => setOpen(event.currentTarget.open)}
      className='min-w-0'>
      <summary className='w-fit cursor-pointer rounded-sm text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring'>
        {Array.isArray(value)
          ? loc.no.objectViewer.items(entries.length)
          : loc.no.objectViewer.fields(entries.length)}
      </summary>
      <div className='mt-3'>{fields}</div>
    </details>
  )
}

function fieldLabel(key: string) {
  const label = key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}
