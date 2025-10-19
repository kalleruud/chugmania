import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { DocContent, DocSummary } from '../../../common/models/docs'
import DocSidebar from '../components/DocSidebar'
import LoadingView from '../components/LoadingView'
import MarkdownView from '../components/MarkdownView'

type DocsResponse = {
  success: boolean
  docs: DocSummary[]
  message?: string
}

type DocResponse = {
  success: boolean
  doc?: DocContent
  message?: string
}

export default function Docs() {
  const { slug } = useParams<{ slug?: string }>()
  const navigate = useNavigate()
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [activeSlug, setActiveSlug] = useState<string | null>(slug ?? null)
  const [docCache, setDocCache] = useState<Record<string, DocContent>>({})
  const [isLoadingDoc, setIsLoadingDoc] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoadingList(true)
    fetch('/api/docs')
      .then(res => res.json() as Promise<DocsResponse>)
      .then(response => {
        if (cancelled) return
        if (!response.success) {
          setError(response.message ?? 'Failed to load documentation')
          setIsLoadingList(false)
          return
        }
        setDocs(response.docs)
        setIsLoadingList(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load documentation')
        setIsLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setActiveSlug(slug ?? null)
  }, [slug])

  useEffect(() => {
    if (docs.length === 0 || activeSlug) return
    const first = docs.at(0)
    if (!first) return
    navigate(`/docs/${first.slug}`, { replace: true })
    setActiveSlug(first.slug)
  }, [docs, activeSlug, navigate])

  useEffect(() => {
    if (!activeSlug || docCache[activeSlug]) return
    let cancelled = false
    setIsLoadingDoc(true)
    setError(null)
    fetch(`/api/docs/${activeSlug}`)
      .then(res => res.json() as Promise<DocResponse>)
      .then(response => {
        if (cancelled) return
        if (!response.success || !response.doc) {
          setError(response.message ?? 'Failed to load document')
        } else {
          setDocCache(prev => ({
            ...prev,
            [response.doc!.slug]: response.doc!,
          }))
        }
        setIsLoadingDoc(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load document')
        setIsLoadingDoc(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeSlug, docCache])

  const activeDoc = useMemo(
    () => (activeSlug ? (docCache[activeSlug] ?? null) : null),
    [activeSlug, docCache]
  )

  const handleSelect = (slugToSelect: string) => {
    if (slugToSelect === activeSlug) return
    navigate(`/docs/${slugToSelect}`)
    setActiveSlug(slugToSelect)
  }

  if (isLoadingList) return <LoadingView />

  if (error && docs.length === 0)
    return (
      <div className='px-safe-or-4 pt-safe-or-8 flex-1'>
        <div className='border-stroke text-label-muted rounded-2xl border bg-white/5 p-6 text-center'>
          {error}
        </div>
      </div>
    )

  return (
    <div className='px-safe-or-4 pt-safe-or-8 flex-1 pb-24'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row'>
        <DocSidebar
          docs={docs}
          activeSlug={activeSlug}
          onSelect={handleSelect}
        />
        <section className='border-stroke flex-1 rounded-2xl border bg-white/5 p-6 backdrop-blur-sm'>
          {activeDoc && !isLoadingDoc ? (
            <div className='flex flex-col gap-6'>
              <header className='flex flex-col gap-1'>
                <h1 className='text-3xl font-semibold uppercase tracking-wide text-white'>
                  {activeDoc.title}
                </h1>
                {activeDoc.summary && (
                  <p className='text-sm text-white/80'>{activeDoc.summary}</p>
                )}
              </header>
              <MarkdownView content={activeDoc.content} />
            </div>
          ) : isLoadingDoc ? (
            <LoadingView className='h-auto min-h-[200px]' />
          ) : (
            <div className='text-sm text-white/70'>
              Select a document to get started.
            </div>
          )}
          {error && <div className='mt-4 text-sm text-red-400'>{error}</div>}
        </section>
      </div>
    </div>
  )
}
