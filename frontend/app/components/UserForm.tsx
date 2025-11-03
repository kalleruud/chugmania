import { AtSign, Lock, Type, User, type LucideProps } from 'lucide-react'
import {
  type ComponentType,
  type DetailedHTMLProps,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../../contexts/AuthContext'


function Field({
  Icon,
  name,
  className,
  required,
  ...props
}: { Icon?: ComponentType<LucideProps> } & DetailedHTMLProps<
  InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>) {
  return (
    <div className='grid gap-1'>
      <div className='flex gap-0.5'>
        <h3 className='text-label-muted text-sm'>{name}</h3>
        {required && <h3 className='text-accent text-sm'>*</h3>}
      </div>
      <label className='focus-within:ring-accent/60 focus-within:border-accent flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition focus-within:ring-2'>
        <span className='sr-only'>{name}</span>

        {Icon && <Icon className='text-label-muted size-4' />}
        <input
          name={name}
          required={required}
          className={twMerge(
            'placeholder:text-label-muted/50 w-full outline-none transition focus:ring-transparent',
            className
          )}
          {...props}
        />
      </label>
    </div>
  )
}

type UserFormMode = 'register' | 'login' | 'edit'

interface UserFormProps {
  mode: UserFormMode
  email: string
  firstName: string
  lastName: string
  shortName: string
  password: string
  newPassword?: string
  onEmailChange: (value: string) => void
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onShortNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onNewPasswordChange?: (value: string) => void
  onSubmit: (e: FormEvent) => void
  errorMessage?: string | null
  successMessage?: string | null
  isSubmitting?: boolean
  submitLabel?: string
  showRequiredPassword?: boolean
}

export default function UserForm({
  mode,
  email,
  firstName,
  lastName,
  shortName,
  password,
  newPassword = '',
  onEmailChange,
  onFirstNameChange,
  onLastNameChange,
  onShortNameChange,
  onPasswordChange,
  onNewPasswordChange,
  onSubmit,
  errorMessage,
  successMessage,
  isSubmitting = false,
  submitLabel,
}: Readonly<UserFormProps>) {
  const { user } = useAuth()

  const isRegistering = mode === 'register'
  const isEditing = mode === 'edit'
  const isLogin = mode === 'login'

  const passwordLabel = isEditing ? 'Current password' : 'Password'

  let defaultSubmitLabel: string
  if (isLogin) {
    defaultSubmitLabel = 'Sign in'
  } else if (isRegistering) {
    defaultSubmitLabel = 'Sign up'
  } else {
    defaultSubmitLabel = 'Save changes'
  }

  return (
    <form onSubmit={onSubmit} className='grid gap-4'>
      <div className='grid gap-3'>
        <Field
          name='Email'
          Icon={AtSign}
          type='email'
          value={email}
          placeholder='you@example.com'
          required={true}
          onChange={e => onEmailChange(e.target.value)}
        />

        {(isRegistering || isEditing) && (
          <>
            <div className='flex gap-2'>
              <Field
                name='First name'
                Icon={User}
                type='text'
                value={firstName}
                placeholder='Ola'
                maxLength={24}
                minLength={2}
                onChange={e => onFirstNameChange(e.target.value)}
                required={true}
              />

              <Field
                name='Last name'
                type='text'
                value={lastName}
                placeholder='Normann'
                maxLength={24}
                minLength={2}
                onChange={e => onLastNameChange(e.target.value)}
                required={true}
              />
            </div>

            <Field
              name='Short name'
              type='text'
              Icon={Type}
              maxLength={3}
              minLength={3}
              placeholder='NOR'
              value={shortName}
              onChange={e => onShortNameChange(e.target.value.toUpperCase())}
              required={true}
            />
          </>
        )}

        {!(isEditing && user?.role === 'admin') && (
          <Field
            name={passwordLabel}
            Icon={Lock}
            type='password'
            value={password}
            maxLength={32}
            minLength={8}
            placeholder='••••••••'
            required={true}
            onChange={e => onPasswordChange(e.target.value)}
          />
        )}

        {isEditing && (
          <Field
            name='New password'
            Icon={Lock}
            type='password'
            value={newPassword}
            maxLength={32}
            minLength={8}
            placeholder='••••••••'
            onChange={e => onNewPasswordChange?.(e.target.value)}
          />
        )}
      </div>

      {errorMessage && (
        <p className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300'>
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className='rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300'>
          {successMessage}
        </p>
      )}

      <Button
        type='submit'
        variant='primary'
        size={isEditing ? 'sm' : 'md'}
        className={isEditing ? '' : 'w-full'}
        disabled={isSubmitting}>
        {isSubmitting && isEditing
          ? 'Saving…'
          : (submitLabel ?? defaultSubmitLabel)}
      </Button>
    </form>
  )
}
