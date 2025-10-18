import { Download, ShieldCheck, Upload } from 'lucide-react'
import { useState } from 'react'

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
      title: 'Users',
      description: 'Create or update drivers, roles, and tags.',
    },
    {
      table: 'tracks',
      title: 'Tracks',
      description: 'Manage the official track list and attributes.',
    },
    {
      table: 'timeEntries',
      title: 'Lap Times',
      description: 'Bulk import historical lap times with comments.',
    },
    {
      table: 'sessions',
      title: 'Sessions',
      description: 'Bulk import or export session meetups and events.',
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

  if (isImporting) return 'Importing...'

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-24'>
      <header className='border-stroke bg-background-secondary flex w-full flex-col gap-3 rounded-3xl border p-6 shadow-lg'>
        <div className='flex items-center gap-3'>
          <span className='bg-accent/20 text-accent inline-flex size-10 items-center justify-center rounded-2xl'>
            <ShieldCheck />
          </span>
          <div>
            <h1 className='font-f1 text-2xl font-semibold uppercase tracking-wider text-white'>
              Admin Control
            </h1>
            <p className='text-label-secondary text-sm'>
              Import curated CSV exports from the data folder to hydrate the
              database.
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
                label='Drop CSV here or click to select'
                hint={'Accepts *.csv-files'}
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
                      Import
                    </>
                  )}
                </Button>

                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() =>
                    handleExport(table as ExportCsvRequest['table'])
                  }
                  disabled={isImporting}
                  className='h-8 flex-1'>
                  <Download size={16} />
                  Export
                </Button>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
