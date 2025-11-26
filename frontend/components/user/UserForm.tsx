import { toastPromise } from '@/app/utils/sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import { ChevronDownIcon } from 'lucide-react'
import { useState, type ComponentProps, type FormEvent } from 'react'
import { twMerge } from 'tailwind-merge'
import type { UserRole } from '../../../backend/database/schema'
import { type UserInfo } from '../../../common/models/user'
import { Button } from '../ui/button'
import { Calendar } from '../ui/calendar'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

type UserFormProps = {
  user?: UserInfo
  variant: 'login' | 'register' | 'edit'
  disabled?: boolean
  onSubmitResponse?: (success: boolean) => void
} & ({ variant: 'edit'; user: UserInfo } | { variant: 'login' | 'register' }) &
  ComponentProps<'form'>

export default function UserForm({
  user,
  variant,
  className,
  disabled,
  onSubmitResponse,
  onSubmit,
  ...rest
}: Readonly<UserFormProps>) {
  const { socket } = useConnection()
  const { login, loggedInUser, isLoggedIn } = useAuth()

  const [email, setEmail] = useState(user?.email ?? '')
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [shortName, setShortName] = useState(user?.shortName ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>(user?.role ?? 'user')
  const [createdAt, setCreatedAt] = useState<Date>(
    user?.createdAt ? new Date(user.createdAt) : new Date()
  )

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isSelf = isLoggedIn && loggedInUser.id === user?.id
  const isEditing = variant === 'edit'
  const isRegistering = variant === 'register'

  const canEdit = isEditing && (isSelf || isAdmin)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    switch (variant) {
      case 'login':
        login?.({ email, password }).then(() => onSubmitResponse?.(isLoggedIn))
        return
      case 'edit':
        return toastPromise(
          socket
            .emitWithAck('edit_user', {
              type: 'EditUserRequest',
              id: user.id,
              email,
              firstName,
              lastName,
              shortName,
              password,
              newPassword,
              role: role as UserRole,
              createdAt,
            })
            .then(r => {
              onSubmitResponse?.(r.success)
              return r
            }),
          loc.no.user.edit.request
        )

      case 'register':
        return console.log('Registering...')
    }
  }

  return (
    <form
      className={twMerge('grid gap-4', className)}
      onSubmit={onSubmit ?? handleSubmit}
      {...rest}>
      <Field
        id='email'
        name={loc.no.user.form.email}
        type='email'
        disabled={disabled && canEdit}
        required
        show
        value={email}
        onChange={e => setEmail(e.target.value.toLowerCase())}
        placeholder='cumguzzler69@chugmania.no'
      />

      <div
        className='grid grid-cols-2 gap-x-2 gap-y-4'
        hidden={!isEditing && !isRegistering}>
        <Field
          id='first_name'
          name={loc.no.user.form.firstName}
          type='text'
          disabled={disabled && canEdit}
          required
          show={isEditing || isRegistering}
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          placeholder='Ola'
        />

        <Field
          id='last_name'
          name={loc.no.user.form.lastName}
          type='text'
          disabled={disabled && canEdit}
          required
          show={isEditing || isRegistering}
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          placeholder='Nordmann'
        />

        <Field
          id='short_name'
          name={loc.no.user.form.shortName}
          type='text'
          disabled={disabled && canEdit}
          minLength={3}
          maxLength={3}
          required
          show={isEditing || isRegistering}
          value={shortName}
          onChange={e => setShortName(e.target.value.toUpperCase())}
          placeholder='NOR'
        />

        <SelectField
          id='role'
          show={isAdmin}
          disabled={disabled}
          required
          value={role}
          onValueChange={r => setRole(r)}
          name={loc.no.user.form.role}
          entries={Object.entries(loc.no.user.role).map(([key, label]) => ({
            key,
            label,
          }))}
        />
      </div>

      <div hidden={!isAdmin} className='-mx-3 flex flex-col gap-2'>
        <Label className='pl-3'>{loc.no.user.form.advanced}</Label>
        <div className='border-border rounded-md border border-dashed p-3'>
          <CalendarField
            id='created_at'
            show={isAdmin}
            selected={createdAt}
            onSelect={setCreatedAt}
            disabled={disabled}
            name={loc.no.user.form.createdAt}
          />
        </div>
      </div>

      <div className='flex gap-2' hidden={!isEditing && !isRegistering}>
        <Field
          id='password'
          name={
            isEditing ? loc.no.user.form.oldPassword : loc.no.user.form.password
          }
          type='password'
          minLength={8}
          disabled={disabled && canEdit}
          required
          show={canEdit && !isAdmin}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder='•••••••••••'
        />

        <Field
          id='new_password'
          name={loc.no.user.form.newPassword}
          type='password'
          minLength={8}
          disabled={disabled && canEdit}
          value={newPassword}
          show={isEditing}
          onChange={e => setNewPassword(e.target.value)}
          placeholder='•••••••••••'
        />
      </div>
    </form>
  )
}

function Field({
  show,
  ...props
}: Readonly<{ show: boolean } & Parameters<typeof Input>[0]>) {
  if (!show) return undefined
  return (
    <div className='grid w-full gap-2'>
      <Label htmlFor={props.id} className='gap-1'>
        {props.name} {props.required && <span className='text-primary'>*</span>}
      </Label>
      <Input {...props} />
    </div>
  )
}

function SelectField({
  show,
  id,
  name,
  entries,
  ...props
}: Readonly<
  {
    show: boolean
    id?: string
    entries: { key: string; label: string }[]
  } & Parameters<typeof Select>[0]
>) {
  if (!show) return undefined
  return (
    <div className='flex w-full flex-col gap-2'>
      <Label htmlFor={id} className='gap-1'>
        {name} {props.required && <span className='text-primary'>*</span>}
      </Label>
      <Select {...props}>
        <SelectTrigger className='w-full'>
          <SelectValue placeholder={name} />
        </SelectTrigger>
        <SelectContent id={id}>
          {entries.map(({ key, label }) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function CalendarField({
  show,
  id,
  name,
  ...props
}: Readonly<
  {
    show: boolean
    id: string
    name: string
  } & Parameters<typeof Calendar>[0]
>) {
  const [open, setOpen] = useState(false)
  if (!show) return undefined
  return (
    <div className='flex w-full flex-col gap-2'>
      <Label htmlFor={id} className='gap-1'>
        {name} {props.required && <span className='text-primary'>*</span>}
      </Label>
      <div className='flex gap-2'>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='outline'
              id='date-picker'
              className='flex-1 justify-between font-normal'>
              {'selected' in props && props.selected
                ? props.selected.toLocaleDateString()
                : 'Select date'}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-auto overflow-hidden p-0' align='start'>
            <Calendar
              mode='single'
              captionLayout='dropdown'
              timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
              {...props}
            />
          </PopoverContent>
        </Popover>

        <div>
          <Input
            type='time'
            id='time-picker'
            step='1'
            className='bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none'
          />
        </div>
      </div>
    </div>
  )
}
