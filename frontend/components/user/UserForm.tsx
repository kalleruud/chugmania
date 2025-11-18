import { useAuth } from '@/contexts/AuthContext'
import { useState, type ComponentProps, type FormEvent } from 'react'
import { twMerge } from 'tailwind-merge'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type UserFormProps = {
  variant: 'login' | 'register' | 'edit'
  disabled?: boolean
} & ComponentProps<'form'>

export default function UserForm({
  variant,
  className,
  disabled,
  onSubmit,
  ...rest
}: Readonly<UserFormProps>) {
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    login({ email, password })
  }

  return (
    <form
      className={twMerge('grid gap-4', className)}
      onSubmit={onSubmit ?? handleSubmit}
      {...rest}>
      <Field
        className='lowercase'
        id='email'
        name='Email'
        type='email'
        autoFocus
        disabled={disabled}
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder='cumguzzler69@chugmania.no'
      />
      <Field
        className='lowercase'
        id='password'
        name='Password'
        type='password'
        minLength={8}
        disabled={disabled}
        required
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder='•••••••••••'
      />
    </form>
  )
}

function Field(props: Parameters<typeof Input>[0]) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={props.id} className='gap-1'>
        {props.name} {props.required && <span className='text-primary'>*</span>}
      </Label>
      <Input {...props} />
    </div>
  )
}
