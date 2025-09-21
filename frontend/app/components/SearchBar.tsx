import { Search, X } from 'lucide-react'
import { useRef } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}: Readonly<Props>) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div
      className={`focus-within:ring-accent/60 focus-within:border-accent flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none transition focus-within:ring-2 ${className}`}
    >
      <Search className='text-label-muted size-5' aria-hidden='true' />
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className='placeholder:text-label-muted flex-1 focus:ring-transparent'
        aria-label='Search'
      />
      {!!value && (
        <button
          type='button'
          onClick={() => onChange('')}
          className='text-label-muted rounded-xl transition hover:cursor-pointer hover:text-white'
          aria-label='Clear search'
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
}
