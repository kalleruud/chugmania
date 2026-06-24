import { useAuth } from '@/contexts/useAuth'
import { useConnection } from '@/contexts/useConnection'
import { useObjectState } from '@/hooks/useObjectState'
import loc from '@/lib/locales'
import { type UserInfo } from '@common/models/user'
import type { ComponentProps, SubmitEvent } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { UserRole } from '../../../backend/database/schema'
import { CalendarField, Field, SelectField } from '../FormFields'
import { Label } from '../ui/label'

type UserFormProps = {
  user?: UserInfo
  variant: 'login' | 'create' | 'edit'
  disabled?: boolean
  onSubmitResponse?: (success: boolean) => void
} & ({ variant: 'edit'; user: UserInfo } | { variant: 'login' | 'create' }) &
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

  const [form, setForm] = useObjectState({
    email: user?.email ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    shortName: user?.shortName ?? '',
    newPassword: '',
    password: '',
    role: user?.role ?? 'user',
    createdAt: user?.createdAt,
  })
  const {
    email,
    firstName,
    lastName,
    shortName,
    newPassword,
    password,
    role,
    createdAt,
  } = form

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isSelf = isLoggedIn && loggedInUser.id === user?.id
  const isEditing = variant === 'edit'
  const isCreating = variant === 'create'
  const isLoggingIn = variant === 'login'

  const canEdit = isEditing && (isSelf || isAdmin)

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    switch (variant) {
      case 'login':
        login?.({ email, password }).then(() => onSubmitResponse?.(isLoggedIn))
        return
      case 'edit':
        return toast.promise(
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
              if (!r.success) throw new Error(r.message)
              return r
            }),
          loc.no.user.edit.request
        )

      case 'create':
        return toast.promise(
          socket
            .emitWithAck('register', {
              type: 'RegisterRequest',
              email,
              firstName,
              lastName,
              shortName,
              password,
              role,
              createdAt,
            })
            .then(r => {
              onSubmitResponse?.(r.success)
              if (!r.success) throw new Error(r.message)
              return r
            }),
          loc.no.user.create.request
        )
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
        value={email}
        onChange={e => setForm({ email: e.target.value.toLowerCase() })}
        placeholder='cumguzzler69@chugmania.no'
      />

      <div
        className='grid grid-cols-2 gap-x-2 gap-y-4'
        hidden={!isEditing && !isCreating}>
        <Field
          id='first_name'
          name={loc.no.user.form.firstName}
          type='text'
          disabled={disabled && canEdit}
          required
          hidden={isLoggingIn}
          value={firstName}
          onChange={e => setForm({ firstName: e.target.value })}
          placeholder='Ola'
        />

        <Field
          id='last_name'
          name={loc.no.user.form.lastName}
          type='text'
          disabled={disabled && canEdit}
          required
          hidden={isLoggingIn}
          value={lastName}
          onChange={e => setForm({ lastName: e.target.value })}
          placeholder='Nordmann'
        />

        <Field
          id='short_name'
          name={loc.no.user.form.shortName}
          type='text'
          disabled={disabled && canEdit}
          minLength={2}
          maxLength={4}
          required
          hidden={isLoggingIn}
          value={shortName}
          onChange={e => setForm({ shortName: e.target.value.toUpperCase() })}
          placeholder='NOR'
        />

        <SelectField
          id='role'
          hidden={!isAdmin}
          disabled={disabled}
          required
          value={role}
          onValueChange={role => setForm({ role })}
          name={loc.no.user.form.role}
          entries={Object.entries(loc.no.user.role).map(([key, label]) => ({
            key: key as UserRole,
            label,
          }))}
        />
      </div>

      <div hidden={!isAdmin} className='-mx-3 flex flex-col gap-2'>
        <Label className='pl-3'>{loc.no.user.form.advanced}</Label>
        <div className='rounded-md border border-dashed border-border p-3'>
          <CalendarField
            id='created_at'
            selected={createdAt}
            onSelect={createdAt => setForm({ createdAt })}
            disabled={disabled}
            name={loc.no.user.form.createdAt}
          />
        </div>
      </div>

      <div className='flex gap-2'>
        <Field
          id='password'
          name={
            isEditing ? loc.no.user.form.oldPassword : loc.no.user.form.password
          }
          type='password'
          minLength={8}
          disabled={disabled && canEdit}
          required
          hidden={isAdmin && !isCreating}
          value={password}
          onChange={e => setForm({ password: e.target.value })}
          placeholder='•••••••••••'
        />

        <Field
          id='new_password'
          name={loc.no.user.form.newPassword}
          type='password'
          minLength={8}
          disabled={disabled && canEdit}
          value={newPassword}
          hidden={!isEditing}
          onChange={e => setForm({ newPassword: e.target.value })}
          placeholder='•••••••••••'
        />
      </div>
    </form>
  )
}
