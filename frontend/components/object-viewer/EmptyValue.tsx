import loc from '@common/locale/locales'

export default function EmptyValue({
  value,
}: Readonly<{ value: null | undefined | '' }>) {
  const type = value === '' ? '""' : String(value)
  return (
    <span className='inline-flex items-center gap-2 text-muted-foreground'>
      <span>{loc.no.objectViewer.notSet}</span>
      <code className='rounded border px-1 text-xs'>{type}</code>
    </span>
  )
}
