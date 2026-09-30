import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { PopoverContentProps } from '@radix-ui/react-popover'
import { ChevronsUpDown, Search } from 'lucide-react'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from './row/RowProps'
import { Button } from './ui/button'

type ComboboxProps<T extends ComboboxLookupItem> = {
  placeholder: string
  emptyLabel?: string
  items: T[]
  selected: T | null | undefined
  limit?: number
  required?: boolean
  setSelected: (value: T | null | undefined) => void
  align?: PopoverContentProps['align']
  CustomRow?: (props: BaseRowProps<T>) => ReactNode
} & ComponentProps<'input'>

export type ComboboxLookupItem = {
  id: string
  label?: string
  sublabel?: string
  tags?: string[]
}

function Row<T extends ComboboxLookupItem>({
  className,
  item,
  highlight,
}: Readonly<BaseRowProps<T> & ComponentProps<'div'>>) {
  return (
    <div
      className={twMerge(
        'flex w-full items-center justify-between gap-2',
        className
      )}>
      <p className='block max-w-3/4 flex-none truncate text-left'>
        {item.label}
      </p>
      <p
        className={cn(
          'block truncate text-right text-muted-foreground',
          highlight && 'text-primary-foreground'
        )}>
        {item.sublabel}
      </p>
    </div>
  )
}

export default function Combobox<T extends ComboboxLookupItem>({
  placeholder,
  emptyLabel,
  items,
  selected,
  disabled,
  limit,
  required,
  setSelected,
  className,
  align,
  CustomRow,
  ...inputProps
}: Readonly<ComboboxProps<T>>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (term.length > 0) {
      return items
        .filter(i => i.tags?.join(',').toLowerCase().includes(term))
        .slice(0, limit)
    }
    return items.slice(0, limit)
  }, [items, search])

  function onSelect(item: ComboboxLookupItem) {
    if (item.id === selected?.id) setSelected(undefined)
    else setSelected(items.find(i => i.id === item.id))
    setSearch('')
    closeAndFocusTrigger()
  }

  function closeAndFocusTrigger() {
    if (!open) return
    setOpen(false)
    // Defer focus until popover unmounts
    setTimeout(() => triggerRef.current?.focus(), 0)
  }

  // Close on outside click / Escape
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return
      if (!containerRef.current) return
      if (containerRef.current.contains(e.target as Node)) return
      setOpen(false)
    }
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'Enter' && open) {
        const first = results.at(0)
        if (first) onSelect(first)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onDocKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onDocKeyDown)
    }
  }, [open, results])

  return (
    <div ref={containerRef} className={className}>
      <input
        type='hidden'
        required={required}
        value={selected?.id}
        {...inputProps}
      />
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            className='flex h-fit w-full items-center justify-between gap-2 p-4'
            variant='outline'
            disabled={disabled}
            aria-expanded={open}
            ref={triggerRef}>
            {!selected && (
              <span className='text-muted-foreground'>{placeholder}</span>
            )}

            {CustomRow && selected && (
              <CustomRow item={selected} hideLink className='flex-1 p-0' />
            )}

            {!CustomRow && selected && <Row item={selected} />}

            {!disabled && (
              <ChevronsUpDown className='size-4 flex-none text-muted-foreground' />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className='w-sm bg-popover/90 p-0 backdrop-blur-xl'
          align={align}>
          <div className='flex items-center gap-2 border-b border-border px-2'>
            <Search className='size-4 text-muted-foreground' />
            <input
              type='text'
              aria-label='Søk'
              inputMode='search'
              className='placeholder:text-label-muted flex w-full py-2 focus:ring-0'
              placeholder='Søk...'
              maxLength={64}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {results.length === 0 ? (
            <div className='text-label-muted py-6 text-center'>
              {emptyLabel ?? 'No results'}
            </div>
          ) : (
            <ul className='max-h-64 w-full overflow-x-hidden overflow-y-auto p-1'>
              {results.map(item => (
                <li key={item.id} className='list-none'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='flex h-fit w-full justify-between p-0'
                    onClick={() => onSelect(item)}>
                    {CustomRow ? (
                      <CustomRow
                        item={item}
                        className='w-full px-2 py-3'
                        hideLink
                        highlight={item.id === selected?.id}
                      />
                    ) : (
                      <Row item={item} highlight={item.id === selected?.id} />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function ComboboxMulti<T extends ComboboxLookupItem>({
  items,
  selected,
  setSelected,
  placeholder,
  disabled,
}: {
  items: T[]
  selected: T[]
  setSelected: (items: T[]) => void
  placeholder: string
  disabled?: boolean
}) {
  function move(index: number, offset: number) {
    const next = [...selected]
    const [item] = next.splice(index, 1)
    next.splice(index + offset, 0, item)
    setSelected(next)
  }
  return (
    <div className='flex flex-col gap-2'>
      <Combobox
        items={items.filter(item => !selected.some(s => s.id === item.id))}
        selected={null}
        setSelected={item => {
          if (item) setSelected([...selected, item])
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      {selected.map((item, index) => (
        <div key={item.id} className='flex items-center gap-2'>
          <span className='mr-auto'>
            {index + 1}. {item.label}
          </span>
          <Button
            type='button'
            size='sm'
            variant='outline'
            aria-label={`Flytt ${item.label} opp`}
            disabled={disabled || index === 0}
            onClick={() => move(index, -1)}>
            ↑
          </Button>
          <Button
            type='button'
            size='sm'
            variant='outline'
            aria-label={`Flytt ${item.label} ned`}
            disabled={disabled || index === selected.length - 1}
            onClick={() => move(index, 1)}>
            ↓
          </Button>
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
    </div>
  )
}
