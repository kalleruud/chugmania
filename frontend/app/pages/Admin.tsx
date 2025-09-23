import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import type { ImportCsvRequest } from '../../../common/models/requests'
import type {
  ErrorResponse,
  SuccessResponse,
} from '../../../common/models/responses'
import { WS_IMPORT_CSV } from '../../../common/utils/constants'
import { useConnection } from '../../contexts/ConnectionContext'
import FileDrop from '../components/FileDrop'

async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      resolve(typeof result === 'string' ? result : '')
    }
    reader.onerror = () => reject(Error(reader.error?.message))
    reader.readAsText(file)
  })
}

export default function Admin() {
  const { socket } = useConnection()
  const [isImporting, setIsImporting] = useState(false)
  const [files, setFiles] = useState<Map<ImportCsvRequest['table'], File>>(
    new Map()
  )

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
  ]

  const handleFileChange = (
    table: ImportCsvRequest['table'],
    file: File | undefined
  ) => {
    setFiles(prev => {
      const next = new Map(prev)
      if (file) next.set(table, file)
      else next.delete(table)
      return next
    })
  }

  const handleImport = async (table: ImportCsvRequest['table']) => {
    try {
      const file = files.get(table)
      if (!file) return
      setIsImporting(true)

      const content = await readFile(file)
      socket.emit(
        WS_IMPORT_CSV,
        { table, content } satisfies ImportCsvRequest,
        (response: SuccessResponse | ErrorResponse) => {
          if (!response.success) {
            return alert(response.message)
          }
        }
      )
    } catch (err) {
      alert(err)
    } finally {
      setIsImporting(false)
    }
  }

  if (isImporting) return 'Importing...'

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6'>
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
              className='border-stroke bg-background-secondary flex flex-col gap-4 rounded-3xl border p-6 shadow-lg'
            >
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
                hint="Matches files in '/data/*.csv'"
              />

              {file && (
                <p className='text-label-secondary text-xs'>
                  Selected: <span className='text-white'>{file.name}</span>
                </p>
              )}

              <button
                type='button'
                onClick={() => handleImport(table)}
                disabled={!file}
                className='to-accent-secondary from-accent font-f1 shadow-accent/60 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-tr px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
              >
                Import CSV
              </button>
            </section>
          )
        })}
      </div>
    </div>
  )
}
