import Combobox from '@/components/combobox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import UserRow from '@/components/user/UserRow'
import loc from '@/lib/locales'
import { userToLookupItem } from '@/lib/lookup-utils'
import type { UserInfo } from '@common/models/user'
import { CircleCheck, CircleX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { SessionResponse } from '../../../backend/database/schema'
import { RESPONSE_OPTIONS } from './session-signup-utils'

type ManageSessionParticipantsDialogProps = {
  availableUsers: UserInfo[]
  disabled?: boolean
  onAddParticipants: (
    response: SessionResponse,
    users: UserInfo[]
  ) => Promise<void>
}

export default function ManageSessionParticipantsDialog({
  availableUsers,
  disabled,
  onAddParticipants,
}: Readonly<ManageSessionParticipantsDialogProps>) {
  const [open, setOpen] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedResponse, setSelectedResponse] =
    useState<SessionResponse>('yes')

  const selectedUsers = useMemo(
    () => availableUsers.filter(user => selectedUserIds.includes(user.id)),
    [availableUsers, selectedUserIds]
  )
  const selectableUsers = useMemo(
    () => availableUsers.filter(user => !selectedUserIds.includes(user.id)),
    [availableUsers, selectedUserIds]
  )

  function handleSelectUser(user: UserInfo | null | undefined) {
    if (!user) return
    setSelectedUserIds(current =>
      current.includes(user.id) ? current : [...current, user.id]
    )
  }

  function removeSelectedUser(userId: string) {
    setSelectedUserIds(current =>
      current.filter(selectedUserId => selectedUserId !== userId)
    )
  }

  function handleAddParticipants() {
    if (selectedUsers.length === 0) return

    toast.promise(
      onAddParticipants(selectedResponse, selectedUsers).then(() => {
        setSelectedUserIds([])
        setOpen(false)
      }),
      loc.no.session.rsvp.manage.addRequest(selectedUsers.length)
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type='button' variant='outline' disabled={disabled}>
          <CircleCheck className='size-4' />
          {loc.no.session.rsvp.manage.add}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.session.rsvp.manage.title}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <Combobox
            placeholder={loc.no.session.rsvp.manage.userPlaceholder}
            emptyLabel={loc.no.common.noItems ?? undefined}
            items={selectableUsers.map(userToLookupItem)}
            selected={undefined}
            setSelected={handleSelectUser}
            CustomRow={props => <UserRow {...props} hideLink hideRanking />}
          />

          {availableUsers.length === 0 && (
            <Empty className='border border-input text-sm text-muted-foreground'>
              {loc.no.common.noItems}
            </Empty>
          )}

          {selectedUsers.length > 0 && (
            <div className='max-h-80 overflow-y-auto rounded-sm bg-background-secondary'>
              {selectedUsers.map(user => (
                <div
                  key={user.id}
                  className='flex items-center gap-2 border-b border-border/60 p-2 last:border-b-0'>
                  <UserRow
                    item={user}
                    hideLink
                    hideRanking
                    className='flex-1 py-2'
                  />
                  <Button
                    type='button'
                    size='icon'
                    variant='ghost'
                    onClick={() => removeSelectedUser(user.id)}>
                    <CircleX className='size-4' />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Select
            value={selectedResponse}
            onValueChange={value =>
              setSelectedResponse(value as SessionResponse)
            }>
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESPONSE_OPTIONS.map(({ response, Icon }) => (
                <SelectItem key={response} value={response}>
                  <Icon className='size-4' />
                  {loc.no.session.rsvp.responses[response]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>{loc.no.common.cancel}</Button>
          </DialogClose>
          <Button
            type='button'
            onClick={handleAddParticipants}
            disabled={selectedUserIds.length === 0}>
            {loc.no.session.rsvp.manage.addSelected}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
