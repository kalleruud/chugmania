import { Button } from '@/components/ui/button'
import { ChevronsUpDown, Search } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from 'react'
import { twMerge } from 'tailwind-merge'

export type LookupItem = {
  id: string
  label: string
  featured?: boolean
}

type Props = Readonly<{
  placeholder: string
  emptyLabel?: string
  items: LookupItem[]
  selected?: LookupItem
  setSelected: (value: SetStateAction<LookupItem | undefined>) => void
  className?: string
  name?: string
  required?: boolean
}>

export default function SearchableDropdown({
  placeholder,
  emptyLabel,
  items,
  selected,
  setSelected,
  className,
  name,
  required = false,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const featured = useMemo(() => items.filter(i => i.featured), [items])
  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (term.length > 0)
      return items.filter(i => i.label?.toLowerCase().includes(term))
    return featured.length > 0 ? featured : items
  }, [items, featured, search])

  function onSelect(item: LookupItem) {
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
        const first = results[0]
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
    <div ref={containerRef} className={twMerge('relative w-full', className)}>
      <Button
        ref={triggerRef}
        type='button'
        variant='secondary'
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup='listbox'
        className={twMerge(
          'w-full justify-between rounded-lg px-4 py-2 text-left normal-case',
          !selected && 'text-label-muted'
        )}>
        {name ? (
          <input
            type='hidden'
            required={required}
            name={name}
            value={selected?.id ?? ''}
          />
        ) : null}
        <span className='flex w-full items-center gap-2'>
          <span className='truncate'>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronsUpDown className='text-label-muted size-5 shrink-0' />
      </Button>
      {open && (
        <div className='bg-background/75 absolute left-0 right-0 z-10 mt-2 rounded-lg border border-white/10 p-0 shadow-lg backdrop-blur-xl'>
          <div className='flex items-center gap-2 border-b border-white/10 px-2'>
            <Search size={16} className='text-label-muted' />
            <input
              type='text'
              inputMode='search'
              className='placeholder:text-label-muted flex h-11 w-full rounded-lg bg-transparent py-3 outline-none focus:ring-0'
              placeholder='Search...'
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
            <ul className='max-h-64 overflow-y-auto overflow-x-hidden p-1'>
              {results.map(item => (
                <li key={item.id} className='list-none'>
                  <Button
                    type='button'
                    size='sm'
                    className={twMerge(
                      'relative w-full select-none justify-start rounded-sm px-2 py-1.5 text-left normal-case text-slate-100 no-underline hover:no-underline',
                      selected?.id === item.id
                        ? 'bg-accent text-black hover:text-black hover:brightness-110'
                        : 'hover:bg-white/10'
                    )}
                    onClick={() => onSelect(item)}>
                    <span className='block w-full truncate'>{item.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
