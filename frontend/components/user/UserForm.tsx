import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import { useState, type ComponentProps, type FormEvent } from 'react'
import { twMerge } from 'tailwind-merge'
import { type UserInfo } from '../../../common/models/user'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type UserFormProps = {
  user?: UserInfo
  variant: 'login' | 'register' | 'edit'
  disabled?: boolean
} & ({ variant: 'edit'; user: UserInfo } | { variant: 'login' | 'register' }) &
  ComponentProps<'form'>

export default function UserForm({
  user,
  variant,
  className,
  disabled,
  onSubmit,
  ...rest
}: Readonly<UserFormProps>) {
  const { login, user: loggedInUser } = useAuth()

  const [email, setEmail] = useState(user?.email ?? '')
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [shortName, setShortName] = useState(user?.shortName ?? '')
  const [password, setPassword] = useState('')

  const canEdit =
    variant !== 'edit' ||
    (loggedInUser &&
      (loggedInUser.id === user.id || loggedInUser.role === 'admin'))

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    switch (variant) {
      case 'login':
        return login({ email, password })
      case 'edit':
        return console.log('Updating...')
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
        autoFocus
        disabled={disabled && canEdit}
        required
        show
        value={email}
        onChange={e => setEmail(e.target.value.toLowerCase())}
        placeholder='cumguzzler69@chugmania.no'
      />

      <div className='flex gap-2'>
        <Field
          id='first_name'
          name={loc.no.user.form.firstName}
          type='text'
          autoFocus
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
          autoFocus
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
        autoFocus
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
        show
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
    <div className='grid gap-2'>
      <Label htmlFor={props.id} className='gap-1'>
        {props.name} {props.required && <span className='text-primary'>*</span>}
      </Label>
      <Input {...props} />
    </div>
  )
}
