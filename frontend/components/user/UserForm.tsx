import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type UserFormProps = {
  variant: 'login' | 'register' | 'edit'
} & ComponentProps<'div'>

export default function UserForm({
  variant,
  className,
  ...rest
}: Readonly<UserFormProps>) {
  return (
    <div className={twMerge('grid gap-4', className)} {...rest}>
      <Field
        className='lowercase'
        id='email'
        name='Email'
        type='email'
        autoFocus
        required
        placeholder='cumguzzler69@chugmania.no'
      />
      <Field
        className='lowercase'
        id='password'
        name='Password'
        type='password'
        min={8}
        required
        placeholder='•••••••••••'
      />
    </div>
  )
}

function Field(props: Parameters<typeof Input>[0]) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={props.id}>{props.name}</Label>
      <Input {...props} />
    </div>
  )
}
