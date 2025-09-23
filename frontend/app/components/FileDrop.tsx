import { useRef, useState, type DragEventHandler, type ChangeEvent } from 'react'
import { Upload } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

type FileDropProps = {
  accept?: string
  className?: string
  label?: string
  hint?: string
  onSelect: (file: File | undefined) => void
}

export default function FileDrop({
  accept = '',
  className = '',
  label = 'Drop file here or click to select',
  hint,
  onSelect,
}: Readonly<FileDropProps>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (fileList: FileList | null) => {
    const [file] = fileList ? Array.from(fileList) : []
    onSelect(file)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files)
    // Allow selecting the same file again
    event.target.value = ''
  }

  const handleDragOver: DragEventHandler<HTMLDivElement> = event => {
    event.preventDefault()
    if (!dragging) setDragging(true)
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave: DragEventHandler<HTMLDivElement> = event => {
    event.preventDefault()
    if (dragging) setDragging(false)
  }

  const handleDrop: DragEventHandler<HTMLDivElement> = event => {
    event.preventDefault()
    setDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <div
      role='button'
      tabIndex={0}
      className={twMerge(
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-10 text-center transition hover:border-white/30 hover:bg-white/10',
        dragging ? 'border-accent/60 bg-white/10 text-white' : '',
        className
      )}
      onClick={() => inputRef.current?.click()}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Upload className='text-label-muted size-8' />
      <div className='flex flex-col gap-1 text-sm'>
        <span className='text-label-secondary'>{label}</span>
        {hint && <span className='text-label-muted text-xs'>{hint}</span>}
      </div>
      <input
        ref={inputRef}
        type='file'
        accept={accept}
        className='sr-only'
        onChange={handleInputChange}
      />
    </div>
  )
}
