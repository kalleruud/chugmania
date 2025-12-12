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
  type SetStateAction,
} from 'react'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from './row/RowProps'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'

type ComboboxProps<T extends ComboboxLookupItem> = {
  placeholder: string
  emptyLabel?: string
  items: T[]
  selected?: T
  limit?: number
  required?: boolean
  setSelected: (value: SetStateAction<T | undefined>) => void
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
      <p className='max-w-3/4 block flex-none truncate text-left'>
        {item.label}
      </p>
      <p
        className={cn(
          'text-muted-foreground block truncate text-right',
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

  const isLoading = results === undefined

  function onSelect(item: ComboboxLookupItem) {
    if (item.id === selected?.id) setSelected(undefined)
    else setSelected(items.find(i => i.id === item.id))
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
        const first = results?.[0]
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
            disabled={disabled || isLoading}
            aria-expanded={open}
            ref={triggerRef}>
            {!selected && (
              <span className='text-muted-foreground'>{placeholder}</span>
            )}

            {CustomRow && selected && (
              <CustomRow item={selected} hideLink className='flex-1 p-0' />
            )}

            {!CustomRow && selected && <Row item={selected} />}

            {isLoading && <Spinner />}
            {!disabled && !isLoading && (
              <ChevronsUpDown className='text-muted-foreground size-4 flex-none' />
            )}
          </Button>
        </PopoverTrigger>
        {!isLoading && (
          <PopoverContent
            className='bg-popover/90 w-sm p-0 backdrop-blur-xl'
            align={align}>
            <div className='border-border flex items-center gap-2 border-b px-2'>
              <Search className='text-muted-foreground size-4' />
              <input
                type='text'
                inputMode='search'
                className='placeholder:text-label-muted flex w-full py-2 focus:ring-0'
                placeholder='Søk...'
                maxLength={64}
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            {results.length === 0 ? (
              <div className='text-label-muted py-6 text-center'>
                {emptyLabel ?? 'No results'}
              </div>
            ) : (
              <ul className='max-h-64 w-full overflow-y-auto overflow-x-hidden p-1'>
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
        )}
      </Popover>
    </div>
  )
}
