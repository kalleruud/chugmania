import { toastPromise } from '@/app/utils/sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import { useState, type ComponentProps, type FormEvent } from 'react'
import { twMerge } from 'tailwind-merge'
import { USER_ROLES, type UserRole } from '../../../backend/database/schema'
import { type UserInfo } from '../../../common/models/user'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
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
  const [role, setRole] = useState<UserRole>(user?.role ?? 'user')
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
              role,
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

      <div className='flex gap-2' hidden={!isEditing && !isRegistering}>
        <Field
          id='first_name'
          name={loc.no.user.form.firstName}
          type='text'
          disabled={disabled && canEdit}
          required
          show={variant === 'edit' || variant === 'register'}
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
          show={variant === 'edit' || variant === 'register'}
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          placeholder='Nordmann'
        />
      </div>

      <Field
        id='short_name'
        name={loc.no.user.form.shortName}
        type='text'
        disabled={disabled && canEdit}
        minLength={3}
        maxLength={3}
        required
        show={variant === 'edit' || variant === 'register'}
        value={shortName}
        onChange={e => setShortName(e.target.value.toUpperCase())}
        placeholder='NOR'
      />

      <Field
        className='lowercase'
        id='password'
        name={
          variant === 'edit'
            ? loc.no.user.form.oldPassword
            : loc.no.user.form.password
        }
        type='password'
        minLength={8}
        disabled={disabled && canEdit}
        required
        show={isEditing || loggedInUser?.role !== 'admin'}
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder='•••••••••••'
      />

      <Field
        className='lowercase'
        id='new_password'
        name={loc.no.user.form.newPassword}
        type='password'
        minLength={8}
        disabled={disabled && canEdit}
        value={newPassword}
        show={variant === 'edit'}
        onChange={e => setNewPassword(e.target.value)}
        placeholder='•••••••••••'
      />

      <div
        hidden={!isAdmin}
        className='border-border rounded-md border border-dashed p-2'>
        <Select value={role} onValueChange={r => setRole(r as UserRole)}>
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Theme' />
          </SelectTrigger>
          <SelectContent>
            {USER_ROLES.map(r => (
              <SelectItem key={r} value={r}>
                {loc.no.user.role[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  )
}

function Field({
  show,
  ...props
}: Readonly<{ show?: boolean } & Parameters<typeof Input>[0]>) {
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
