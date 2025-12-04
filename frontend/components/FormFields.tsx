import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { useState, type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from './ui/button'
import { Calendar } from './ui/calendar'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Textarea } from './ui/textarea'

export function Field({
  hidden,
  ...props
}: Readonly<Parameters<typeof Input>[0]>) {
  if (hidden) return undefined
  return (
    <div className='grid w-full gap-2'>
      <Label htmlFor={props.id} className='gap-1'>
        {props.name} {props.required && <span className='text-primary'>*</span>}
      </Label>
      <Input {...props} />
    </div>
  )
}

export function TextField({
  hidden,
  ...props
}: Readonly<Parameters<typeof Textarea>[0]>) {
  if (hidden) return undefined
  return (
    <div className='grid w-full gap-2'>
      <Label htmlFor={props.id} className='gap-1'>
        {props.name} {props.required && <span className='text-primary'>*</span>}
      </Label>
      <Textarea {...props} />
    </div>
  )
}

export function SelectField<T extends string>({
  hidden,
  id,
  name,
  entries,
  value,
  onValueChange,
  ...props
}: Readonly<
  {
    id?: string
    hidden?: boolean
    entries: { key: T; label: string }[]
    value?: T
    onValueChange?: (value: T) => void
  } & Omit<ComponentProps<typeof Select>, 'value' | 'onValueChange'>
>) {
  if (hidden) return undefined
  return (
    <div className='flex w-full flex-col gap-2'>
      <Label htmlFor={id} className='gap-1'>
        {name} {props.required && <span className='text-primary'>*</span>}
      </Label>
      <Select
        value={value}
        onValueChange={onValueChange as (value: string) => void}
        {...props}>
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

export function CalendarField({
  id,
  name,
  hidden,
  selected,
  onSelect,
  disabled,
  required,
}: Readonly<{
  id: string
  name: string
  hidden?: boolean
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: boolean
  required?: boolean
}>) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [time, setTime] = useState<string | undefined>(dateToTime(selected))

  const isEmpty = selected === undefined

  if (hidden) return undefined

  function dateToTime(date: Date | undefined) {
    if (!date) return undefined
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }

  function handleTimeChange(timeString: string) {
    if (!timeString) {
      onSelect?.(date)
      setTime(undefined)
      return
    }

    const [h, m] = timeString.split(':').map(Number)

    const newDate = isEmpty ? new Date() : new Date(selected)
    newDate.setHours(h)
    newDate.setMinutes(m)
    onSelect?.(newDate)
    setDate(newDate)
    setTime(timeString)
  }

  function handleDateSelect(date: Date) {
    const newDate = new Date(date)
    setDate(newDate)

    if (time) {
      const [h, m] = time.split(':').map(Number)
      newDate.setHours(h)
      newDate.setMinutes(m)
    }

    onSelect?.(newDate)
    setOpen(false)
  }

  return (
    <div className='flex w-full flex-col gap-2'>
      <Label htmlFor={id} className='gap-1'>
        {name}
        <span className='text-primary'>*</span>
      </Label>
      <div className='flex gap-2'>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='outline'
              id='date-picker'
              className={twMerge(
                'flex-1 justify-between font-normal',
                isEmpty && 'text-muted-foreground'
              )}
              disabled={disabled}>
              {selected?.toLocaleDateString() ?? 'Velg dato'}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-auto overflow-hidden p-0' align='start'>
            <Calendar
              mode='single'
              required
              showOutsideDays
              showWeekNumber
              selected={selected}
              onSelect={handleDateSelect}
            />
          </PopoverContent>
        </Popover>

        <Select
          value={time}
          required={required}
          onValueChange={handleTimeChange}
          disabled={disabled}>
          <SelectTrigger className='w-32'>
            <SelectValue placeholder='Tid' />
          </SelectTrigger>
          <SelectContent>
            {[...new Array(24).keys()].reverse().map(hour => {
              const h = String(hour).padStart(2, '0')
              const value = `${h}:00`
              return (
                <SelectItem key={value} value={value}>
                  <span>{h}:00</span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
