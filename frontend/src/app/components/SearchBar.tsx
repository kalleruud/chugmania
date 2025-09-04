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
  placeholder = 'Search tracks, types, levels, or players',
  className = '',
}: Readonly<Props>) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className={`relative ${className}`}>
      <Search
        size={20}
        className='text-label-muted pointer-events-none absolute left-5 top-1/2 -translate-y-1/2'
        aria-hidden='true'
      />
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className='focus:ring-accent/60 focus:border-accent placeholder:text-label-muted h-14 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-12 text-base outline-none transition focus:ring-2'
        aria-label='Search'
      />
      {!!value && (
        <button
          type='button'
          onClick={() => onChange('')}
          className='text-label-muted absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-2 transition hover:text-white'
          aria-label='Clear search'
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
}
