import ConfirmationButton from '@/components/ConfirmationButton'
import SessionCard from '@/components/session/SessionCard'
import SessionForm from '@/components/session/SessionForm'
import SessionSignupPanel from '@/components/session/SessionSignupPanel'
import TournamentTab from '@/components/tournament/TournamentTab'
import TrackLeaderboard from '@/components/track/TrackLeaderboard'
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
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import WebhookDraftPanel from '@/components/webhook/WebhookDraftPanel'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import { useTimeEntryInput } from '@/contexts/TimeEntryInputContext'
import loc from '@common/locale/locales'
import { isInactiveFinalReset } from '@common/utils/tournament'
import { PencilIcon, PlusIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { SubscribeButton } from './SessionsPage'

export default function SessionPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { socket, isConnected } = useConnection()
  const { open, openMatch } = useTimeEntryInput()
  const { sessions, tracks, timeEntries, matches, tournaments, isLoadingData } =
    useData()
  const { loggedInUser, isLoggedIn, isLoading } = useAuth()
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canEdit = isAdmin || isModerator

  const handleDeleteSession = (sessionId: string) => {
    toast.promise(
      socket
        .emitWithAck('delete_session', {
          type: 'DeleteSessionRequest',
          id: sessionId,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
          return r
        }),
      {
        loading: 'Sletter session...',
        success: 'Sesjonen ble slettet',
        error: (err: Error) => `Sletting feilet: ${err.message}`,
      }
    )
  }

  if (isLoadingData) {
    return (
      <div className='flex h-dvh w-full items-center-safe justify-center-safe'>
        <Spinner className='size-6' />
      </div>
    )
  }

  const session = sessions.find(s => s.id === id)
  if (!session)
    throw new Error(loc.no.error.messages.not_in_db(`sessions/${id}`))

  const isCancelled = session.status === 'cancelled'
  const tournament = tournaments.find(t => t.config.session === session.id)
  const sessionTracks = tracks.filter(track => {
    const hasLaps = timeEntries.some(
      entry => entry.session === session.id && entry.track === track.id
    )
    const hasMatches = matches.some(
      match =>
        match.session === session.id &&
        match.track === track.id &&
        !match.tournament &&
        !isInactiveFinalReset(match)
    )
    return hasLaps || hasMatches
  })

  return (
    <div className='flex flex-col gap-6'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to='/sessions'>
              {loc.no.session.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{session.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <SessionCard className='px-2' item={session} hideLink />

      <div className='flex items-center gap-1'>
        <SubscribeButton className='flex-1' />
        {canEdit && (
          <>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant='outline'>
                  <PencilIcon className='size-4' />
                  {loc.no.session.edit}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{loc.no.session.edit}</DialogTitle>
                </DialogHeader>
                <SessionForm
                  id='editForm'
                  variant='edit'
                  session={session}
                  onSubmitResponse={success => {
                    if (success) setEditDialogOpen(false)
                  }}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant='outline' disabled={isLoading}>
                      {loc.no.common.cancel}
                    </Button>
                  </DialogClose>
                  <ConfirmationButton form='editForm' disabled={isLoading}>
                    {loc.no.common.continue}
                  </ConfirmationButton>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <ConfirmationButton
              variant='destructive'
              onClick={() => handleDeleteSession(session.id)}
              disabled={isLoading}>
              <Trash2 />
              {loc.no.common.delete}
            </ConfirmationButton>
          </>
        )}
      </div>

      <Tabs
        defaultValue={
          tournament || searchParams.get('tab') === 'tournament'
            ? loc.no.tournament.title
            : loc.no.session.session
        }>
        <TabsList className='-mt-2 mb-2 w-full bg-background-secondary'>
          <TabsTrigger value={loc.no.session.session}>
            {loc.no.session.session}
          </TabsTrigger>
          <TabsTrigger value={loc.no.session.participants}>
            {loc.no.session.participants}
          </TabsTrigger>
          <TabsTrigger value={loc.no.tournament.title}>
            {loc.no.tournament.title}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={loc.no.session.participants}>
          <SessionSignupPanel
            className='rounded-sm border bg-background p-2'
            disabled={isCancelled}
            session={session}
          />
        </TabsContent>
        <TabsContent
          className='flex flex-col gap-4'
          value={loc.no.session.session}>
          <WebhookDraftPanel key={session.id} session={session.id} />
          {sessionTracks.length === 0 && (
            <Empty className='border border-input'>
              <div className='flex flex-wrap justify-center gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={!isLoggedIn || !isConnected || isCancelled}
                  onClick={() => open({ session: session.id })}>
                  <PlusIcon />
                  {loc.no.timeEntry.input.create.title}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={!canEdit || !isConnected || isCancelled}
                  onClick={() => openMatch({ session: session.id })}>
                  <PlusIcon />
                  {loc.no.match.new}
                </Button>
              </div>
            </Empty>
          )}
          {sessionTracks.map(track => (
            <TrackLeaderboard
              key={track.id}
              track={track}
              session={session.id}
              highlight={e => isLoggedIn && loggedInUser.id === e.id}
              filter='all'
              excludeTournamentMatches
            />
          ))}
        </TabsContent>
        <TabsContent value={loc.no.tournament.title}>
          <TournamentTab session={session} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
