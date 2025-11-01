import type { FormEvent } from 'react'
import { useTranslation } from '../../../common/locales'
import { Button } from './Button'

export interface SessionFormData {
  name: string
  date: string
  location: string
  description: string
}

interface SessionFormProps {
  data: SessionFormData
  onChange: (data: SessionFormData) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  loading: boolean
  submitLabel: string
  isModal?: boolean
  onCancel?: () => void
}

export function SessionForm({
  data,
  onChange,
  onSubmit,
  loading,
  submitLabel,
  isModal = false,
  onCancel,
}: Readonly<SessionFormProps>) {
  const { t } = useTranslation()
  const handleChange = (key: keyof SessionFormData, value: string) => {
    onChange({ ...data, [key]: value })
  }

  const formClass = isModal
    ? 'grid gap-4 p-6 sm:grid-cols-2'
    : 'mt-4 grid gap-4 sm:grid-cols-2'

  return (
    <form className={formClass} onSubmit={onSubmit}>
      <label className='flex flex-col gap-2 text-sm'>
        <span className='text-label-muted'>
          {t('components.sessionForm.sessionNameLabel')}
        </span>
        <input
          required
          type='text'
          value={data.name}
          onChange={e => handleChange('name', e.target.value)}
          placeholder={t('components.sessionForm.sessionNamePlaceholder')}
          className='focus:ring-accent/60 focus:border-accent rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none transition focus:ring-2'
        />
      </label>
      <label className='flex flex-col gap-2 text-sm'>
        <span className='text-label-muted'>
          {t('components.sessionForm.dateTimeLabel')}
        </span>
        <input
          required
          type='datetime-local'
          value={data.date}
          onChange={e => handleChange('date', e.target.value)}
          className='focus:ring-accent/60 focus:border-accent rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none transition focus:ring-2'
        />
      </label>
      <label className='flex flex-col gap-2 text-sm sm:col-span-2'>
        <span className='text-label-muted'>
          {t('components.sessionForm.locationLabel')}
        </span>
        <input
          type='text'
          value={data.location}
          onChange={e => handleChange('location', e.target.value)}
          placeholder={t('components.sessionForm.locationPlaceholder')}
          className='focus:ring-accent/60 focus:border-accent rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none transition focus:ring-2'
        />
      </label>
      <label className='flex flex-col gap-2 text-sm sm:col-span-2'>
        <span className='text-label-muted'>
          {t('components.sessionForm.descriptionLabel')}
        </span>
        <textarea
          value={data.description}
          onChange={e => handleChange('description', e.target.value)}
          placeholder={t('components.sessionForm.descriptionPlaceholder')}
          rows={3}
          className='focus:ring-accent/60 focus:border-accent rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none transition focus:ring-2'
        />
      </label>
      <div className={isModal ? 'flex gap-2 sm:col-span-2' : 'sm:col-span-2'}>
        <Button
          type='submit'
          disabled={loading}
          className={isModal ? 'flex-1' : ''}>
          {loading ? t('components.sessionForm.loadingState') : submitLabel}
        </Button>
        {isModal && onCancel && (
          <Button
            type='button'
            variant='secondary'
            disabled={loading}
            onClick={onCancel}
            className='flex-1'>
            {t('components.sessionForm.cancelButton')}
          </Button>
        )}
      </div>
    </form>
  )
}
