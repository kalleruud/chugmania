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
import { Spinner } from './ui/spinner'

export type ComboboxLookupItem = {
  id: string
  label?: string
  sublabel?: string
  tags?: string[]
}

type ComboboxSharedProps<T extends ComboboxLookupItem> = {
  placeholder: string
  emptyLabel?: string
  items: T[]
  limit?: number
  required?: boolean
  align?: PopoverContentProps['align']
  CustomRow?: (props: BaseRowProps<T>) => ReactNode
} & Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'multiple' | 'required'
>

export type ComboboxProps<T extends ComboboxLookupItem> =
  ComboboxSharedProps<T> & {
    selected: T | null | undefined
    setSelected: (value: T | null | undefined) => void
  }

export type ComboboxMultiProps<T extends ComboboxLookupItem> =
  ComboboxSharedProps<T> & {
    selected: T[]
    setSelected: (value: T[]) => void
  }

type LookupComboboxProps<T extends ComboboxLookupItem> =
  | (ComboboxSharedProps<T> & {
      mode: 'single'
      selected: T | null | undefined
      setSelected: (value: T | null | undefined) => void
    })
  | (ComboboxSharedProps<T> & {
      mode: 'multi'
      selected: T[]
      setSelected: (value: T[]) => void
    })

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

function LookupCombobox<T extends ComboboxLookupItem>(
  props: Readonly<LookupComboboxProps<T>>
) {
  const {
    placeholder,
    emptyLabel,
    items,
    disabled,
    limit,
    required,
    className,
    align,
    CustomRow,
    mode,
    ...inputProps
  } = props

  const isMulti = mode === 'multi'
  const selectedSingle = mode === 'single' ? props.selected : null
  const selectedMulti = mode === 'multi' ? props.selected : []
  const setSelectedSingle = mode === 'single' ? props.setSelected : null
  const setSelectedMulti = mode === 'multi' ? props.setSelected : null

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered =
      term.length > 0
        ? items.filter(i => {
            const tags = i.tags?.join(',').toLowerCase() ?? ''
            const label = (i.label ?? '').toLowerCase()
            const sub = (i.sublabel ?? '').toLowerCase()
            return (
              tags.includes(term) || label.includes(term) || sub.includes(term)
            )
          })
        : items
    return filtered.slice(0, limit)
  }, [items, search, limit])

  const isLoading = results === undefined

  function hiddenValue(): string {
    if (isMulti) {
      return selectedMulti.length > 0
        ? selectedMulti.map(s => s.id).join(',')
        : ''
    }
    return selectedSingle?.id ?? ''
  }

  function isRowHighlighted(item: ComboboxLookupItem): boolean {
    if (isMulti) {
      return selectedMulti.some(s => s.id === item.id)
    }
    return item.id === selectedSingle?.id
  }

  function onSelect(item: ComboboxLookupItem) {
    const full = items.find(i => i.id === item.id)
    if (!full) return

    if (isMulti) {
      setSelectedMulti?.([...selectedMulti, full])
      return
    }

    if (item.id === selectedSingle?.id) setSelectedSingle?.(undefined)
    else setSelectedSingle?.(full)
    closeAndFocusTrigger()
  }

  function removeAtIndex(index: number) {
    if (!isMulti) return
    setSelectedMulti?.(selectedMulti.filter((_, i) => i !== index))
  }

  function closeAndFocusTrigger() {
    if (!open) return
    setOpen(false)
    setTimeout(() => triggerRef.current?.focus(), 0)
  }

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
  }, [
    open,
    results,
    isMulti,
    selectedSingle,
    selectedMulti,
    items,
    setSelectedSingle,
    setSelectedMulti,
  ])

  const showPlaceholder = isMulti ? selectedMulti.length === 0 : !selectedSingle

  return (
    <div ref={containerRef} className={className}>
      <input
        type='hidden'
        required={required}
        value={hiddenValue()}
        {...inputProps}
      />
      {isMulti && selectedMulti.length > 0 && (
        <div className='mb-2 flex w-full flex-col gap-2'>
          {selectedMulti.map((item, idx) => (
            <Button
              key={`${item.id}-${idx}`}
              type='button'
              variant='outline'
              size='sm'
              className={twMerge(
                'flex items-center',
                CustomRow
                  ? 'h-auto w-full min-w-0 justify-between gap-3 px-4 py-3'
                  : 'h-7 max-w-full justify-start gap-1 px-2 py-1 text-xs'
              )}
              onClick={() => removeAtIndex(idx)}>
              {CustomRow ? (
                <>
                  <CustomRow
                    item={item as T}
                    hideLink
                    className='min-w-0 flex-1 items-center gap-2 p-0 sm:gap-3'
                  />
                  <span className='text-muted-foreground shrink-0 pl-1 text-base leading-none'>
                    ×
                  </span>
                </>
              ) : (
                <>
                  {item.label}
                  <span className='text-muted-foreground'>×</span>
                </>
              )}
            </Button>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            className='flex h-fit w-full items-center justify-between gap-2 p-4'
            variant='outline'
            disabled={disabled || isLoading}
            aria-expanded={open}
            ref={triggerRef}>
            {showPlaceholder && (
              <span className='text-muted-foreground'>{placeholder}</span>
            )}

            {!isMulti && CustomRow && selectedSingle && (
              <CustomRow
                item={selectedSingle}
                hideLink
                className='flex-1 p-0'
              />
            )}

            {!isMulti && !CustomRow && selectedSingle && (
              <Row item={selectedSingle} />
            )}

            {isMulti && selectedMulti.length > 0 && (
              <span className='text-muted-foreground text-sm'>
                {placeholder}
              </span>
            )}

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
                          item={item as T}
                          className='w-full px-2 py-3'
                          hideLink
                          highlight={isRowHighlighted(item)}
                        />
                      ) : (
                        <Row item={item} highlight={isRowHighlighted(item)} />
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

export function Combobox<T extends ComboboxLookupItem>({
  selected,
  setSelected,
  ...rest
}: Readonly<ComboboxProps<T>>) {
  return (
    <LookupCombobox
      {...rest}
      mode='single'
      selected={selected}
      setSelected={setSelected}
    />
  )
}

export function ComboboxMulti<T extends ComboboxLookupItem>({
  selected,
  setSelected,
  ...rest
}: Readonly<ComboboxMultiProps<T>>) {
  return (
    <LookupCombobox
      {...rest}
      mode='multi'
      selected={selected}
      setSelected={setSelected}
    />
  )
}

export default Combobox
