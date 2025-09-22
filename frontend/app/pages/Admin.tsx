import { AlertTriangle, ShieldCheck, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ImportCsvTarget } from '../../../common/models/requests'
import type {
  BackendResponse,
  ImportCsvResponse,
} from '../../../common/models/responses'
import { WS_IMPORT_CSV } from '../../../common/utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'

type UploadState = {
  file?: File
  isImporting: boolean
  summary?: ImportCsvResponse['summary']
  error?: string
}

const DATASETS: ReadonlyArray<{
  target: ImportCsvTarget
  title: string
  description: string
}> = [
  {
    target: 'users',
    title: 'Users',
    description: 'Create or update drivers, roles, and tags.',
  },
  {
    target: 'tracks',
    title: 'Tracks',
    description: 'Manage the official track list and attributes.',
  },
  {
    target: 'timeEntries',
    title: 'Lap Times',
    description: 'Bulk import historical lap times with comments.',
  },
]

const INITIAL_STATE: Record<ImportCsvTarget, UploadState> = {
  users: { isImporting: false },
  tracks: { isImporting: false },
  timeEntries: { isImporting: false },
}

function isImportCsvResponse(
  response: BackendResponse
): response is ImportCsvResponse {
  return response.success && 'summary' in response
}

function formatSummary(summary: ImportCsvResponse['summary']) {
  if (!summary) return ''
  const { inserted, updated, skipped } = summary
  const parts = [
    `${inserted} inserted`,
    `${updated} updated`,
    `${skipped} skipped`,
  ]
  return parts.join(' • ')
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      resolve(typeof result === 'string' ? result : '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export default function Admin() {
  const { user } = useAuth()
  const { socket } = useConnection()
  const [uploads, setUploads] = useState(INITIAL_STATE)

  const isAdmin = user?.role === 'admin'

  const hero = useMemo(
    () => (
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
    ),
    []
  )

  if (!user)
    return (
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-6'>
        {hero}
        <section className='border-stroke bg-background-secondary flex flex-col items-center gap-3 rounded-3xl border p-10 text-center shadow-lg'>
          <AlertTriangle className='text-label-muted size-10' />
          <h2 className='font-f1 text-lg font-semibold uppercase tracking-wider text-white'>
            Sign in required
          </h2>
          <p className='text-label-secondary text-sm'>
            You need to sign in with an admin account to access these tools.
          </p>
        </section>
      </div>
    )

  if (!isAdmin)
    return (
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-6'>
        {hero}
        <section className='border-stroke bg-background-secondary flex flex-col items-center gap-3 rounded-3xl border p-10 text-center shadow-lg'>
          <AlertTriangle className='text-label-muted size-10' />
          <h2 className='font-f1 text-lg font-semibold uppercase tracking-wider text-white'>
            Access denied
          </h2>
          <p className='text-label-secondary text-sm'>
            Only administrators can import CSV data. Reach out to a site admin
            if you need elevated permissions.
          </p>
        </section>
      </div>
    )

  const handleFileChange = (
    target: ImportCsvTarget,
    file: File | undefined
  ) => {
    setUploads(prev => ({
      ...prev,
      [target]: {
        ...prev[target],
        file,
        summary: undefined,
        error: undefined,
      },
    }))
  }

  const handleImport = async (target: ImportCsvTarget) => {
    const file = uploads[target]?.file
    if (!file)
      return setUploads(prev => ({
        ...prev,
        [target]: {
          ...prev[target],
          error: 'Select a CSV file before importing.',
        },
      }))

    setUploads(prev => ({
      ...prev,
      [target]: {
        ...prev[target],
        isImporting: true,
        error: undefined,
        summary: undefined,
      },
    }))

    try {
      const content = await readFile(file)
      socket.emit(
        WS_IMPORT_CSV,
        { target, content },
        (response: BackendResponse) => {
          setUploads(prev => ({
            ...prev,
            [target]: {
              ...prev[target],
              isImporting: false,
              summary: isImportCsvResponse(response)
                ? response.summary
                : undefined,
              error: response.success
                ? undefined
                : (response.message ?? 'Import failed. Please try again.'),
            },
          }))
        }
      )
    } catch (err) {
      setUploads(prev => ({
        ...prev,
        [target]: {
          ...prev[target],
          isImporting: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to read selected file.',
        },
      }))
    }
  }

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6'>
      {hero}

      <div className='grid gap-4 md:grid-cols-2'>
        {DATASETS.map(dataset => {
          const state = uploads[dataset.target]
          const hasFile = !!state.file
          const summary = state.summary
          const error = state.error
          return (
            <section
              key={dataset.target}
              className='border-stroke bg-background-secondary flex flex-col gap-4 rounded-3xl border p-6 shadow-lg'
            >
              <div className='flex flex-col gap-1'>
                <h2 className='font-f1 text-lg font-semibold uppercase tracking-wider text-white'>
                  {dataset.title}
                </h2>
                <p className='text-label-secondary text-sm'>
                  {dataset.description}
                </p>
              </div>

              <label className='hover:border-accent/60 focus-within:border-accent/60 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-10 text-center transition focus-within:bg-white/10 hover:bg-white/10'>
                <Upload className='text-label-muted size-8' />
                <div className='flex flex-col gap-1 text-sm'>
                  <span className='text-label-secondary'>
                    Drop CSV here or click to select
                  </span>
                  <span className='text-label-muted text-xs'>
                    Matches files in `/data/*.csv`
                  </span>
                </div>
                <input
                  type='file'
                  accept='.csv'
                  className='sr-only'
                  onChange={event => {
                    const selected = event.target.files?.[0]
                    handleFileChange(dataset.target, selected)
                  }}
                />
              </label>

              {hasFile && (
                <p className='text-label-secondary text-xs'>
                  Selected:{' '}
                  <span className='text-white'>{state.file?.name}</span>
                </p>
              )}

              <button
                type='button'
                onClick={() => handleImport(dataset.target)}
                disabled={state.isImporting || !hasFile}
                className='to-accent-secondary from-accent font-f1 shadow-accent/60 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-tr px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {state.isImporting ? 'Importing...' : 'Import CSV'}
              </button>

              {summary && (
                <div className='border-stroke text-label-secondary rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs'>
                  {formatSummary(summary)}
                </div>
              )}

              {error && (
                <div className='border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200'>
                  {error}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
