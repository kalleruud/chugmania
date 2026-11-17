import loc from '@common/locale/locales'

export default function NowIndicator() {
  return (
    <span
      role='status'
      aria-label={loc.no.activeEntry.now}
      title={loc.no.activeEntry.now}
      className='size-2 shrink-0 animate-pulse rounded-full bg-primary'
    />
  )
}
