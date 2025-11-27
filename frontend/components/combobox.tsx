import { ChevronsUpDown, Search } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { PopoverContentProps } from '@radix-ui/react-popover'
import { Spinner } from './ui/spinner'

type ComboboxProps = {
  placeholder: string
  emptyLabel?: string
  items: ComboboxLookupItem[]
  selected?: ComboboxLookupItem
  limit?: number
  setSelected: (
    value: React.SetStateAction<ComboboxLookupItem | undefined>
  ) => void
  align?: PopoverContentProps['align']
} & React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>

export type ComboboxLookupItem = {
  id: string
  label: string
  sublabel?: string
  tags?: string[]
}

function Row({
  className,
  item,
  selected,
  placeholder,
}: Readonly<{
  className?: string
  item?: ComboboxLookupItem
  selected?: ComboboxLookupItem
  placeholder?: string
}>) {
  if (!item) return <div className='text-muted-foreground'>{placeholder}</div>
  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-2',
        className
      )}>
      <p className='max-w-3/4 block flex-none truncate text-left'>
        {item.label}
      </p>
      <p
        className={cn(
          'text-muted-foreground block truncate text-right',
          item.id === selected?.id && 'text-primary-foreground'
        )}>
        {item.sublabel}
      </p>
    </div>
  )
}

export default function Combobox({
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
  ...inputProps
}: Readonly<ComboboxProps>) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const results = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (term.length > 0) {
      return items.filter(i => i.tags?.join(',').toLowerCase().includes(term))
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
  React.useEffect(() => {
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
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            disabled={disabled || isLoading}
            ref={triggerRef}
            variant='outline'
            aria-expanded={open}
            className='w-full justify-between gap-2'>
            <Row item={selected} placeholder={placeholder} />
            <input type='hidden' value={selected?.id} {...inputProps} />
            {isLoading && <Spinner />}
            {!disabled && !isLoading && (
              <ChevronsUpDown className='text-muted-foreground flex-none' />
            )}
          </Button>
        </PopoverTrigger>
        {!isLoading && (
          <PopoverContent
            className='bg-popover/90 p-0 backdrop-blur-xl'
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
                      variant={item.id === selected?.id ? 'default' : 'ghost'}
                      size='sm'
                      className={'flex w-full justify-between'}
                      onClick={() => onSelect(item)}>
                      <Row item={item} selected={selected} />
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
