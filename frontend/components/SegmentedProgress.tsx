import { cn } from '@/lib/utils'
import { Progress } from './ui/progress'

type ProgressSegment = {
  label: string
  value: number
  total?: number
  colorClassName?: string
}

const defaultColors = [
  'bg-chart-2',
  'bg-chart-4',
  'bg-chart-1',
  'bg-chart-3',
  'bg-chart-5',
]

export default function SegmentedProgress({
  segments,
}: {
  segments: ProgressSegment[]
}) {
  const coloredSegments = segments.map((segment, index) => ({
    ...segment,
    colorClassName:
      segment.colorClassName ?? defaultColors[index % defaultColors.length],
  }))
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex overflow-hidden rounded-sm'>
        {coloredSegments.map(segment => {
          const total = segment.total ?? segment.value
          if (total <= 0) return null
          const percent = Math.min(
            100,
            Math.max(0, (segment.value / total) * 100)
          )
          const count =
            segment.total === undefined
              ? `${segment.value}`
              : `${segment.value}/${total}`

          return (
            <div
              key={segment.label}
              className='relative min-w-0'
              style={{ flex: total }}>
              <Progress
                value={percent}
                aria-label={segment.label}
                aria-valuetext={count}
                className='h-6 rounded-none bg-background-secondary'
                indicatorClassName={segment.colorClassName}
              />
              <span
                aria-hidden
                className='pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-1 text-xs font-semibold tabular-nums'>
                {count}
              </span>
            </div>
          )
        })}
      </div>
      <div className='flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground'>
        {coloredSegments.map(segment => (
          <span key={segment.label} className='flex items-center gap-2'>
            <span
              aria-hidden
              className={cn(
                'size-2 shrink-0 rounded-full',
                segment.colorClassName
              )}
            />
            {segment.value}
            {segment.total !== undefined && `/${segment.total}`} {segment.label}
          </span>
        ))}
      </div>
    </div>
  )
}
