import FileDrop from '@/components/FileDrop'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'

type Table = 'users' | 'tracks' | 'sessions' | 'timeEntries'

type ImportResult = {
  imported: number
  total: number
}

const TABLES: { value: Table; label: string }[] = [
  { value: 'users', label: 'Users' },
  { value: 'tracks', label: 'Tracks' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'timeEntries', label: 'Time Entries' },
]

export default function AdminPage() {
  const { loggedInUser, isLoggedIn } = useAuth()
  const { socket } = useConnection()
  const [selectedImportTable, setSelectedImportTable] = useState<Table>('users')
  const [selectedExportTable, setSelectedExportTable] = useState<Table>('users')
  const [importFile, setImportFile] = useState<
    { content: string } | undefined
  >()
  const [importResult, setImportResult] = useState<ImportResult | undefined>()
  const [importLoading, setImportLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // Check admin access
  if (!isLoggedIn || loggedInUser?.role !== 'admin') {
    return <Navigate to='/' replace />
  }

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a file to import')
      return
    }

    setImportLoading(true)
    try {
      const result = await socket.emitWithAck('import_csv', {
        table: selectedImportTable,
        content: importFile.content,
      })

      if (result.success) {
        toast.success(`Import completed for ${selectedImportTable}`)
        setImportResult({
          imported: result.imported || 0,
          total: result.total || 0,
        })
        setImportFile(undefined)
      } else {
        toast.error(result.message || 'Import failed')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed'
      toast.error(message)
    } finally {
      setImportLoading(false)
    }
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const result = await socket.emitWithAck('export_csv', {
        table: selectedExportTable,
      })

      if (result.success && result.csv) {
        const element = document.createElement('a')
        element.setAttribute(
          'href',
          'data:text/csv;charset=utf-8,' + encodeURIComponent(result.csv)
        )
        element.setAttribute('download', `${selectedExportTable}.csv`)
        element.style.display = 'none'
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)
        toast.success(`Export completed for ${selectedExportTable}`)
      } else {
        toast.error(result.message || 'Export failed')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      toast.error(message)
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className='flex flex-col gap-6'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Admin</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='grid gap-6 md:grid-cols-2'>
        {/* Import Card */}
        <Card>
          <CardHeader>
            <CardTitle>Import CSV</CardTitle>
            <CardDescription>
              Upload a CSV file to import data into the database
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Table</label>
              <Select
                value={selectedImportTable}
                onValueChange={v => setSelectedImportTable(v as Table)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLES.map(table => (
                    <SelectItem key={table.value} value={table.value}>
                      {table.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FileDrop
              accept='.csv'
              label='Drop CSV file here or click to select'
              hint='Select a CSV file to import'
              onSelect={file =>
                setImportFile(file ? { content: file.content } : undefined)
              }
            />

            {importResult && (
              <div className='border-input bg-background-secondary rounded-sm border p-3 text-sm'>
                <div className='font-medium'>Import Results</div>
                <div className='text-label-secondary mt-2 space-y-1'>
                  <div>Total rows: {importResult.total}</div>
                  <div>Rows processed: {importResult.imported}</div>
                </div>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={!importFile || importLoading}
              className='w-full'>
              {importLoading ? (
                <>
                  <Spinner className='mr-2 size-4' />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Export Card */}
        <Card>
          <CardHeader>
            <CardTitle>Export CSV</CardTitle>
            <CardDescription>Download table data as a CSV file</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Table</label>
              <Select
                value={selectedExportTable}
                onValueChange={v => setSelectedExportTable(v as Table)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLES.map(table => (
                    <SelectItem key={table.value} value={table.value}>
                      {table.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='border-input bg-background-secondary rounded-sm border p-3 text-sm'>
              <div className='font-medium'>Export Information</div>
              <div className='text-label-secondary mt-2'>
                Select a table and click Export to download the data as a CSV
                file. Sensitive columns like passwords are automatically
                excluded.
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={exportLoading}
              className='w-full'>
              {exportLoading ? (
                <>
                  <Spinner className='mr-2 size-4' />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className='mr-2 size-4' />
                  Export
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
