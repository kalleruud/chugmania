import CopyValueButton from './CopyValueButton'

export default function JsonValue({ value }: Readonly<{ value: object }>) {
  const formatted = JSON.stringify(value, null, 2)
  return (
    <details className='min-w-0 rounded-md border bg-background'>
      <summary className='cursor-pointer px-3 py-2 font-mono text-xs text-muted-foreground'>
        JSON
      </summary>
      <div className='flex justify-end border-t px-2 pt-1'>
        <CopyValueButton value={formatted} />
      </div>
      <pre className='max-h-96 overflow-auto p-3 pt-0 text-xs [overflow-wrap:anywhere] break-words whitespace-pre-wrap'>
        <code>{formatted}</code>
      </pre>
    </details>
  )
}
