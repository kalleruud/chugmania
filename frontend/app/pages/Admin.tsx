import { Download, ShieldCheck, Upload } from 'lucide-react'
import { useState } from 'react'

import { useTranslation } from '../../../common/locales'
import type {
  ExportCsvRequest,
  ImportCsvRequest,
} from '../../../common/models/requests'
import type {
  ErrorResponse,
  ExportCsvResponse,
  SuccessResponse,
} from '../../../common/models/responses'
import { WS_EXPORT_CSV, WS_IMPORT_CSV } from '../../../common/utils/constants'
import { useConnection } from '../../contexts/ConnectionContext'
import { Button } from '../components/Button'
import FileDrop, { type FileDropSelection } from '../components/FileDrop'
import Spinner from '../components/Spinner'

export default function Admin() {
  const { t } = useTranslation()
  const { socket } = useConnection()
  const [isImporting, setIsImporting] = useState(false)
  const [files, setFiles] = useState<
    Map<ImportCsvRequest['table'], FileDropSelection>
  >(new Map())

  const datasets: {
    table: ImportCsvRequest['table']
    title: string
    description: string
  }[] = [
    {
      table: 'users',
      title: t('pages.admin.datasets.users.title'),
      description: t('pages.admin.datasets.users.description'),
    },
    {
      table: 'tracks',
      title: t('pages.admin.datasets.tracks.title'),
      description: t('pages.admin.datasets.tracks.description'),
    },
    {
      table: 'timeEntries',
      title: t('pages.admin.datasets.lapTimes.title'),
      description: t('pages.admin.datasets.lapTimes.description'),
    },
    {
      table: 'sessions',
      title: t('pages.admin.datasets.sessions.title'),
      description: t('pages.admin.datasets.sessions.description'),
    },
  ]

  const handleFileChange = (
    table: ImportCsvRequest['table'],
    file: FileDropSelection | undefined
  ) => {
    setFiles(prev => {
      const next = new Map(prev)
      if (file) next.set(table, file)
      else next.delete(table)
      return next
    })
  }

  const handleImport = (table: ImportCsvRequest['table']) => {
    const file = files.get(table)
    if (!file) return

    try {
      setIsImporting(true)
      socket.emit(
        WS_IMPORT_CSV,
        { table, content: file.content } satisfies ImportCsvRequest,
        (response: SuccessResponse | ErrorResponse) => {
          if (!response.success) {
            alert(response.message)
          }
          setIsImporting(false)
        }
      )
    } catch (err) {
      alert(err)
      setIsImporting(false)
    }
  }

  const handleExport = (table: ExportCsvRequest['table']) => {
    try {
      setIsImporting(true)
      socket.emit(
        WS_EXPORT_CSV,
        { table } satisfies ExportCsvRequest,
        (response: ExportCsvResponse | ErrorResponse) => {
          if (!response.success) {
            alert(response.message)
            setIsImporting(false)
            return
          }

          const element = document.createElement('a')
          element.setAttribute(
            'href',
            'data:text/csv;charset=utf-8,' + encodeURIComponent(response.csv)
          )
          element.setAttribute('download', `${table}.csv`)
          element.style.display = 'none'
          document.body.appendChild(element)
          element.click()
          element.remove()
          setIsImporting(false)
        }
      )
    } catch (err) {
      alert(err)
      setIsImporting(false)
    }
  }

  if (isImporting) return t('pages.admin.importing')

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-24'>
      <header className='border-stroke bg-background-secondary flex w-full flex-col gap-3 rounded-3xl border p-6 shadow-lg'>
        <div className='flex items-center gap-3'>
          <span className='bg-accent/20 text-accent inline-flex size-10 items-center justify-center rounded-2xl'>
            <ShieldCheck />
          </span>
          <div>
            <h1 className='font-f1 text-2xl font-semibold uppercase tracking-wider text-white'>
              {t('pages.admin.heading')}
            </h1>
            <p className='text-label-secondary text-sm'>
              {t('pages.admin.description')}
            </p>
          </div>
        </div>
      </header>

      <div className='grid gap-4 md:grid-cols-2'>
        {datasets.map(({ table, title, description }) => {
          const file = files.get(table)

          return (
            <section
              key={table}
              className='border-stroke bg-background-secondary flex flex-col gap-4 rounded-3xl border p-6 shadow-lg'>
              <div className='flex flex-col gap-1'>
                <h2 className='font-f1 text-lg font-semibold uppercase tracking-wider text-white'>
                  {title}
                </h2>
                <p className='text-label-secondary text-sm'>{description}</p>
              </div>

              <FileDrop
                accept='.csv'
                onSelect={file => handleFileChange(table, file)}
                label={t('pages.admin.fileDropLabel')}
                hint={t('pages.admin.fileDropHint')}
              />

              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant='primary'
                  size='sm'
                  onClick={() => handleImport(table)}
                  disabled={!file || isImporting}
                  className='h-8 flex-1'>
                  {isImporting ? (
                    <Spinner className='text-label p-3' />
                  ) : (
                    <>
                      <Upload size={16} />
                      {t('common.import')}
                    </>
                  )}
                </Button>

                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() => handleExport(table)}
                  disabled={isImporting}
                  className='h-8 flex-1'>
                  <Download size={16} />
                  {t('common.export')}
                </Button>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
