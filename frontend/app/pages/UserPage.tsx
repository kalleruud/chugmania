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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import { Item, ItemContent, ItemTitle } from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import UserForm from '@/components/user/UserForm'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { useParams } from 'react-router-dom'
import { getUserFullName } from '../../../common/models/user'

export default function UserPage() {
  const { id } = useParams()
  const { users } = useData()
  const { user: currentUser, logout, isLoading } = useAuth()

  if (users === undefined) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  if (id === undefined) throw new Error('Ingen id')

  if (!(id in users)) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full flex-col gap-4'>
        <Empty className='border-input text-muted-foreground border text-sm'>
          {loc.no.error.messages.not_in_db('bruker')}
        </Empty>
        <Button asChild variant='outline'>
          <BreadcrumbLink to='/players'>
            {loc.no.error.retryAction}
          </BreadcrumbLink>
        </Button>
      </div>
    )
  }

  const user = users[id]
  const fullName = getUserFullName(user)

  // Permission logic
  const isSelf = currentUser?.id === user.id
  const isAdmin = currentUser?.role === 'admin'
  const canEdit = isSelf || isAdmin
  const canLogout = isSelf

  return (
    <div className='p-safe-or-2 flex flex-col gap-4'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to='/players'>{loc.no.users.title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{fullName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='bg-background flex flex-col items-center justify-between gap-8 rounded-sm border p-2'>
        <div className='flex flex-col items-center justify-center gap-2'>
          <div className='flex flex-col items-center'>
            <h1 className='font-northwell text-primary z-1 -mb-6 pt-4 text-6xl normal-case'>
              {user.firstName}
            </h1>
            <h1 className='font-f1 uppercase'>{user.lastName}</h1>
          </div>
          {user.shortName && (
            <span className='text-f1 text-muted-foreground font-bold'>
              {user.shortName}
            </span>
          )}
          <div className='flex gap-1'>
            <Badge variant='outline' className='capitalize'>
              {user.role}
            </Badge>
            <Badge variant='outline'>
              {`Joined ${user.createdAt.getFullYear()}`}
            </Badge>
            <Badge variant='outline' className='lowercase'>
              {user.email}
            </Badge>
          </div>
        </div>

        <div className='flex w-full flex-col gap-2'>
          <Item>
            <ItemContent>
              <ItemTitle>{loc.no.user.form.email}</ItemTitle>
              <p className='text-muted-foreground text-sm'>{user.email}</p>
            </ItemContent>
          </Item>

          <div className='grid grid-cols-2 gap-2'>
            <Item>
              <ItemContent>
                <ItemTitle>Opprettet</ItemTitle>
                <p className='text-muted-foreground text-sm'>
                  {new Date(user.createdAt).toLocaleDateString('no-NO')}
                </p>
              </ItemContent>
            </Item>
            {user.updatedAt && (
              <Item>
                <ItemContent>
                  <ItemTitle>Sist oppdatert</ItemTitle>
                  <p className='text-muted-foreground text-sm'>
                    {new Date(user.updatedAt).toLocaleDateString('no-NO')}
                  </p>
                </ItemContent>
              </Item>
            )}
          </div>
        </div>

        <div className='flex w-full gap-2'>
          {canEdit && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant='outline' className='flex-1'>
                  {loc.no.user.edit.title}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{loc.no.user.edit.title}</DialogTitle>
                  <DialogDescription>
                    {loc.no.user.edit.description}
                  </DialogDescription>
                </DialogHeader>

                <UserForm
                  id='editForm'
                  variant='edit'
                  user={user}
                  className='py-2'
                  disabled={isLoading}
                />

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant='outline' disabled={isLoading}>
                      {loc.no.dialog.cancel}
                    </Button>
                  </DialogClose>
                  <Button type='submit' form='editForm' disabled={isLoading}>
                    {loc.no.dialog.continue}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {canLogout && (
            <Button onClick={logout} variant='destructive' className='flex-1'>
              {loc.no.user.logout.title}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
