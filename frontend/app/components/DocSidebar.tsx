import type { DocSummary } from '../../../common/models/docs'

type Props = {
  docs: DocSummary[]
  activeSlug: string | null
  onSelect: (slug: string) => void
}

export default function DocSidebar({ docs, activeSlug, onSelect }: Props) {
  return (
    <nav className='border-stroke flex w-full flex-col gap-2 rounded-2xl border bg-white/5 p-4 backdrop-blur-sm lg:max-w-xs'>
      <h2 className='text-xs uppercase tracking-wide text-white/70'>
        Documentation
      </h2>
      <ul className='flex flex-col gap-1'>
        {docs.map(doc => {
          const isActive = doc.slug === activeSlug
          return (
            <li key={doc.slug}>
              <button
                type='button'
                onClick={() => onSelect(doc.slug)}
                className={
                  isActive
                    ? 'border-stroke bg-accent/10 w-full rounded-xl border px-3 py-2 text-left text-white transition'
                    : 'hover:border-stroke w-full rounded-xl border border-transparent px-3 py-2 text-left text-white/70 transition hover:bg-white/10 hover:text-white'
                }>
                <p className='font-medium text-white'>{doc.title}</p>
                {doc.summary && (
                  <p className='text-xs text-white/80'>{doc.summary}</p>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
