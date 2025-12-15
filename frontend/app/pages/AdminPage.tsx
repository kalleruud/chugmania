import FileDrop from '@/components/FileDrop'
import { PageHeader, PageSubheader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  DocumentIcon,
} from '@heroicons/react/24/solid'
import { useState, type ComponentProps } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'

type Table = keyof typeof loc.no.admin.tables

const tableNames = Object.keys(loc.no.admin.tables) as Table[]

export default function AdminPage() {
  const { isLoading, loggedInUser } = useAuth()

  if (isLoading) {
    return (
      <div className='h-dvh-safe flex w-full items-center justify-center'>
        <Spinner />
      </div>
    )
  }

  // Check admin access
  if (loggedInUser?.role !== 'admin') {
    throw new Error(loc.no.error.messages.insufficient_permissions)
  }

  return (
    <div className='flex flex-col gap-4'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{loc.no.admin.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={loc.no.admin.title}
        description={loc.no.admin.description}
        icon='ShieldExclamationIcon'
      />

      <div className='grid gap-2'>
        <PageSubheader
          title={loc.no.admin.tableManagement}
          description={`${tableNames.length}`}
        />
        {tableNames.map(t => (
          <div
            key={t}
            className='bg-background-secondary flex flex-col rounded-sm border'>
            <TableRow table={t} />
          </div>
        ))}
      </div>
    </div>
  )
}

function hasSelectedFiles(
  fileList: FileList | undefined | null
): fileList is FileList {
  return !!fileList && fileList.length > 0
}

function TableRow({
  table,
  className,
  ...props
}: Readonly<{ table: Table } & ComponentProps<'div'>>) {
  const { socket } = useConnection()

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedFiles, setSelectedFiles] = useState<FileList | undefined>(
    undefined
  )

  const handleImport = async () => {
    if (!hasSelectedFiles(selectedFiles)) {
      toast.error(loc.no.error.messages.missing_files)
      return
    }

    setIsLoading(true)

    await Promise.all(
      Array.from(selectedFiles).map(async file => {
        return socket
          .emitWithAck('import_csv', {
            table,
            content: await file.text(),
          })
          .then(r => {
            if (r.success)
              return toast.success(
                loc.no.admin.importRequest.success(
                  file.name,
                  r.created,
                  r.updated
                )
              )
            toast.error(r.message)
          })
      })
    )

    setSelectedFiles(undefined)
    setIsLoading(false)
  }

  const handleExport = () => {
    setIsLoading(true)

    toast.promise(
      socket
        .emitWithAck('export_csv', {
          table,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
          downloadFile(table, r.csv)
        }),
      loc.no.admin.exportRequest
    )
    setIsLoading(false)
  }

  return (
    <div
      className={twMerge(
        'flex items-center justify-between gap-2 rounded-md p-4',
        className
      )}
      {...props}>
      <h4>{loc.no.admin.tables[table]}</h4>

      <div className='flex items-center gap-2'>
        {hasSelectedFiles(selectedFiles) &&
          Array.from(selectedFiles).map(f => (
            <Badge
              key={f.name}
              variant='outline'
              className='size-fit font-mono'>
              {f.name}
            </Badge>
          ))}

        <FileDrop
          onSelect={setSelectedFiles}
          accept={'.csv'}
          isLoading={isLoading}>
          <Button size='sm' variant='outline'>
            <DocumentIcon />
            {loc.no.admin.selectFiles}
          </Button>
        </FileDrop>

        <Button
          size='sm'
          variant='outline'
          onClick={handleImport}
          disabled={!hasSelectedFiles(selectedFiles)}>
          <CloudArrowUpIcon />
          {loc.no.admin.import}
        </Button>

        <Button size='sm' onClick={handleExport}>
          <CloudArrowDownIcon />
          {loc.no.admin.export}
        </Button>
      </div>
    </div>
  )
}

function downloadFile(filename: string, content: string) {
  const element = document.createElement('a')
  element.setAttribute(
    'href',
    'data:text/csv;charset=utf-8,' + encodeURIComponent(content)
  )
  element.setAttribute('download', `${filename}.csv`)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  element.remove()
}
