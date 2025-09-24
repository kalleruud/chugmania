import { Upload } from 'lucide-react'
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEventHandler,
} from 'react'
import { twMerge } from 'tailwind-merge'

export type FileDropSelection = {
  file: File
  content: string
}

type FileDropProps = {
  accept?: string
  className?: string
  label?: string
  hint?: string
  onSelect: (file: FileDropSelection | undefined) => void
}

const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      resolve(typeof result === 'string' ? result : '')
    }
    reader.onerror = () => reject(Error(reader.error?.message))
    reader.readAsText(file)
  })

export default function FileDrop({
  accept = '',
  className = '',
  label = 'Drop file here or click to select',
  hint,
  onSelect,
}: Readonly<FileDropProps>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingIdRef = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const handleFiles = async (fileList: FileList | null) => {
    const [file] = fileList ? Array.from(fileList) : []

    if (!file) {
      setSelectedFileName(undefined)
      setError(undefined)
      onSelect(undefined)
      return
    }

    const requestId = pendingIdRef.current + 1
    pendingIdRef.current = requestId

    try {
      setLoading(true)
      setError(undefined)
      setSelectedFileName(file.name)
      const content = await readFile(file)
      if (pendingIdRef.current === requestId) {
        onSelect({ file, content })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read file'
      if (pendingIdRef.current === requestId) {
        setError(message)
        setSelectedFileName(undefined)
        onSelect(undefined)
      }
    } finally {
      if (pendingIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files)
    // Allow selecting the same file again
    event.target.value = ''
  }

  const handleDragOver: DragEventHandler<HTMLButtonElement> = event => {
    event.preventDefault()
    if (!dragging) setDragging(true)
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave: DragEventHandler<HTMLButtonElement> = event => {
    event.preventDefault()
    if (dragging) setDragging(false)
  }

  const handleDrop: DragEventHandler<HTMLButtonElement> = event => {
    event.preventDefault()
    setDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  return (
    <>
      <button
        type='button'
        className={twMerge(
          'focus-visible:ring-accent/60 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-10 text-center transition hover:border-white/30 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          dragging ? 'border-accent/60 bg-white/10 text-white' : '',
          className
        )}
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className='text-label-muted size-8' />
        <div className='flex flex-col gap-1 text-sm'>
          <span className='text-label-secondary'>{label}</span>
          {hint && <span className='text-label-muted text-xs'>{hint}</span>}
          {selectedFileName && (
            <span className='text-label-secondary text-xs'>
              Selected: <span className='text-white'>{selectedFileName}</span>
            </span>
          )}
          {error && (
            <span className='text-red-400 text-xs'>{error}</span>
          )}
          {loading && (
            <span className='text-label-muted text-xs'>Reading file…</span>
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type='file'
        accept={accept}
        className='sr-only'
        onChange={handleInputChange}
      />
    </>
  )
}
