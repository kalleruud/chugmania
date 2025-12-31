import loc from '@/lib/locales'
import { twMerge } from 'tailwind-merge'

type TournamentMatchPlaceholderProps = {
  name: string
  sourceA: string
  sourceB: string
  className?: string
}

export default function TournamentMatchPlaceholder({
  name,
  sourceA,
  sourceB,
  className,
}: Readonly<TournamentMatchPlaceholderProps>) {
  return (
    <div
      className={twMerge(
        'bg-background/50 flex flex-col gap-2 rounded-sm border border-dashed p-3',
        className
      )}>
      <div className='flex items-center justify-center gap-2'>
        <span className='text-muted-foreground truncate text-sm'>
          {sourceA}
        </span>
        <span className='text-muted-foreground/50 font-kh-interface text-xs font-black'>
          {loc.no.match.vs}
        </span>
        <span className='text-muted-foreground truncate text-sm'>
          {sourceB}
        </span>
      </div>
    </div>
  )
}
