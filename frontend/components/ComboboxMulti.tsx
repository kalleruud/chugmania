import { cn } from '@/lib/utils'
import { GripVertical } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import Combobox, {
  type ComboboxLookupItem,
  type ComboboxProps,
} from './combobox'
import { Button } from './ui/button'

type ComboboxMultiProps<T extends ComboboxLookupItem> = Omit<
  ComboboxProps<T>,
  'selected' | 'setSelected'
> & {
  selected: T[]
  setSelected: (items: T[]) => void
}

export default function ComboboxMulti<T extends ComboboxLookupItem>({
  items,
  selected,
  setSelected,
  CustomRow,
  disabled,
  ...props
}: Readonly<ComboboxMultiProps<T>>) {
  const container = useRef<HTMLDivElement>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')

  function move(from: number, to: number) {
    if (disabled || from < 0 || to < 0 || to >= selected.length || from === to)
      return
    const next = [...selected]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setSelected(next)
    setAnnouncement(
      `${item.label ?? item.id} flyttet til plass ${to + 1} av ${next.length}`
    )
  }

  function dropTarget(event: PointerEvent<HTMLButtonElement>): number | null {
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-sort-index]')
    if (!row || !container.current?.contains(row)) return null
    return Number(row.dataset.sortIndex)
  }

  function endDrag() {
    setDragged(null)
    setTarget(null)
  }
  return (
    <div ref={container} className='flex min-w-0 flex-col gap-2'>
      <Combobox
        {...props}
        items={items.filter(item => !selected.some(s => s.id === item.id))}
        selected={null}
        setSelected={item => {
          if (item) setSelected([...selected, item])
        }}
        CustomRow={CustomRow}
        disabled={disabled}
      />
      {selected.map((item, index) => (
        <div
          key={item.id}
          data-sort-index={index}
          className={cn(
            'flex min-w-0 items-center gap-2 rounded-sm',
            dragged === item.id && 'opacity-50',
            dragged && target === index && 'ring-2 ring-primary'
          )}>
          <Button
            type='button'
            size='icon-sm'
            variant='ghost'
            className='cursor-grab touch-none active:cursor-grabbing'
            aria-label={`Flytt ${item.label ?? item.id}. Dra eller bruk piltastene opp og ned.`}
            disabled={disabled || selected.length < 2}
            onPointerDown={event => {
              if (
                !event.isPrimary ||
                event.button !== 0 ||
                event.currentTarget.matches(':disabled')
              )
                return
              event.preventDefault()
              event.currentTarget.focus()
              event.currentTarget.setPointerCapture(event.pointerId)
              setDragged(item.id)
              setTarget(index)
            }}
            onPointerMove={event => {
              if (dragged === item.id) setTarget(dropTarget(event))
            }}
            onPointerUp={event => {
              if (
                dragged === item.id &&
                !event.currentTarget.matches(':disabled')
              ) {
                const destination = dropTarget(event)
                if (destination !== null)
                  move(
                    selected.findIndex(track => track.id === item.id),
                    destination
                  )
              }
              endDrag()
            }}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onKeyDown={event => {
              if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
              event.preventDefault()
              move(index, index + (event.key === 'ArrowUp' ? -1 : 1))
            }}>
            <GripVertical aria-hidden />
          </Button>
          <span>{index + 1}.</span>
          <div className='mr-auto min-w-0 flex-1'>
            {CustomRow ? (
              <CustomRow item={item} hideLink className='w-full p-0' />
            ) : (
              <span>{item.label}</span>
            )}
          </div>
          <Button
            type='button'
            size='sm'
            variant='outline'
            aria-label={`Fjern ${item.label}`}
            disabled={disabled}
            onClick={() => setSelected(selected.filter(s => s.id !== item.id))}>
            ×
          </Button>
        </div>
      ))}
      <div role='status' className='sr-only'>
        {announcement}
      </div>
    </div>
  )
}
