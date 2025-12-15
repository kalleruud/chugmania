import {
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type DragEventHandler,
} from 'react'
import { Spinner } from './ui/spinner'

type FileDropProps = {
  accept?: string
  isLoading?: boolean
  onSelect: (file: FileList | undefined) => void
} & Omit<ComponentProps<'button'>, 'onSelect'>

export default function FileDrop({
  accept,
  isLoading,
  onSelect,
  children,
  ...props
}: Readonly<FileDropProps>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      onSelect(undefined)
      return
    }
    onSelect(fileList)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files)
    // Allow selecting the same file again
    event.target.value = ''
  }

  const handleDragOver: DragEventHandler<HTMLButtonElement> = event => {
    event.preventDefault()
    setIsDragging(true)
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave: DragEventHandler<HTMLButtonElement> = event => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop: DragEventHandler<HTMLButtonElement> = event => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <>
      <button
        className={'relative'}
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        {...props}>
        {(isLoading || isDragging) && (
          <div className='bg-background/25 absolute flex size-full items-center justify-center p-0.5'>
            {isLoading ? <Spinner /> : undefined}
          </div>
        )}
        {children}
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
