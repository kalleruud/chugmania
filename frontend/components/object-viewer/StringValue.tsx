import loc from '@common/locale/locales'
import CopyValueButton from './CopyValueButton'

export default function StringValue({ value }: Readonly<{ value: string }>) {
  const link = httpLink(value)
  if (link)
    return (
      <div className='flex min-w-0 items-start gap-2'>
        <a
          href={link}
          target='_blank'
          rel='noopener noreferrer'
          className='min-w-0 flex-1 [overflow-wrap:anywhere] break-words text-primary underline underline-offset-4'>
          {value}
        </a>
        <CopyValueButton value={value} />
      </div>
    )
  return (
    <div className='flex min-w-0 items-start gap-2'>
      {value.length > 240 ? (
        <details className='min-w-0 flex-1'>
          <summary className='cursor-pointer [overflow-wrap:anywhere] break-words'>
            {value.slice(0, 160)}…{' '}
            <span className='text-muted-foreground'>
              {loc.no.objectViewer.expand}
            </span>
          </summary>
          <p className='mt-2 [overflow-wrap:anywhere] break-words whitespace-pre-wrap'>
            {value}
          </p>
        </details>
      ) : (
        <span className='min-w-0 flex-1 [overflow-wrap:anywhere] break-words whitespace-pre-wrap'>
          {value}
        </span>
      )}
      <CopyValueButton value={value} />
    </div>
  )
}

function httpLink(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href
  } catch {
    return undefined
  }
}
