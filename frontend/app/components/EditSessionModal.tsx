import type { FormEvent } from 'react'
import type { SessionFormData } from './SessionForm'
import { SessionForm } from './SessionForm'

interface EditSessionModalProps {
  isOpen: boolean
  data: SessionFormData
  loading: boolean
  onClose: () => void
  onChange: (data: SessionFormData) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

export function EditSessionModal({
  isOpen,
  data,
  loading,
  onClose,
  onChange,
  onSubmit,
}: Readonly<EditSessionModalProps>) {
  if (!isOpen) return null

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black/50 p-1'>
      <div className='border-stroke w-full max-w-2xl rounded-2xl border bg-black/50 backdrop-blur-sm'>
        <div className='border-b border-white/10 px-6 py-4'>
          <h2 className='text-lg font-semibold'>Edit session</h2>
        </div>
        <SessionForm
          data={data}
          onChange={onChange}
          onSubmit={onSubmit}
          loading={loading}
          submitLabel='Save changes'
          isModal
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
