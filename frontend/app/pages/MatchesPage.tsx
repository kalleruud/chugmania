import MatchInput from '@/components/match/MatchInput'
import MatchList from '@/components/match/MatchList'
import { PageHeader } from '@/components/PageHeader'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import { PlusIcon } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export default function MatchesPage() {
  return (
    <div className='flex flex-col gap-2'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{loc.no.match.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <MatchesContent />
    </div>
  )
}

export function MatchesContent({
  className,
  showLink,
  ...props
}: Readonly<{ showLink?: boolean } & ComponentProps<'div'>>) {
  const { matches } = useData()
  const { isLoggedIn } = useAuth()
  const [open, setOpen] = useState(false)
  const [editingMatch, setEditingMatch] = useState<Partial<Match> | undefined>(
    undefined
  )

  const handleCreate = () => {
    setEditingMatch({})
    setOpen(true)
  }

  const handleEdit = (match: Match) => {
    setEditingMatch(match)
    setOpen(true)
  }

  return (
    <div className={twMerge('flex flex-col gap-2', className)} {...props}>
      <div className='flex items-center justify-between pr-2'>
        <PageHeader
          title={loc.no.match.title}
          description={loc.no.match.description}
          icon='TrophyIcon'
          to={showLink ? '/matches' : undefined}
        />
        {isLoggedIn && !showLink && (
          <Button onClick={handleCreate} size='sm'>
            <PlusIcon className='mr-2 size-4' />
            {loc.no.match.create}
          </Button>
        )}
      </div>

      <MatchList
        matches={matches ?? []}
        onCreate={showLink ? undefined : handleCreate}
        onSelect={handleEdit}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMatch?.id ? loc.no.match.edit : loc.no.match.new}
            </DialogTitle>
          </DialogHeader>
          {editingMatch && (
            <MatchInput
              editingMatch={editingMatch}
              onSubmitResponse={success => {
                if (success) setOpen(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
