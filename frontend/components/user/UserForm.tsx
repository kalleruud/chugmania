import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import { useState, type ComponentProps, type FormEvent } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { type UserInfo } from '../../../common/models/user'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

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
  onSubmitResponse: onSubmitSuccessful,
  onSubmit,
  ...rest
}: Readonly<UserFormProps>) {
  const { socket } = useConnection()
  const { login, loggedInUser, isLoggedIn } = useAuth()

  const [email, setEmail] = useState(user?.email ?? '')
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [shortName, setShortName] = useState(user?.shortName ?? '')
  const [password, setPassword] = useState('')

  const canEdit =
    variant !== 'edit' ||
    (isLoggedIn &&
      (loggedInUser.id === user.id || loggedInUser.role === 'admin'))

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    switch (variant) {
      case 'login':
        login?.({ email, password }).then(() =>
          onSubmitSuccessful?.(isLoggedIn)
        )
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
            })
            .then(({ success }) => onSubmitSuccessful?.(success)),
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
        className='flex gap-2'
        hidden={variant !== 'edit' && variant !== 'register'}>
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
        show={variant !== 'edit' || loggedInUser?.role !== 'admin'}
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
        value={password}
        show={variant === 'edit'}
        onChange={e => setPassword(e.target.value)}
        placeholder='•••••••••••'
      />
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
