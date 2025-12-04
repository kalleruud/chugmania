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
  const [timeError, setTimeError] = useState<string | undefined>()

  const now = new Date()
  const isEmpty = selected === undefined

  if (hidden) return undefined

  function dateToTime(date: Date | undefined) {
    if (!date) return undefined
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }

  function handleTimeChange(timeString: string) {
    setTime(timeString)
  }

  function handleTimeBlur() {
    if (!time?.trim()) {
      setTimeError(undefined)
      onSelect?.(date)
      return
    }

    const parsed = parseTimeInput(time)
    if (!parsed) {
      setTimeError('Ugyldig tid')
      return
    }

    setTimeError(undefined)
    const newDate = isEmpty ? new Date() : new Date(selected)
    newDate.setHours(parsed.hours)
    newDate.setMinutes(parsed.minutes)
    newDate.setSeconds(parsed.seconds)
    onSelect?.(newDate)
    setDate(newDate)
    setTime(
      Object.values(parsed)
        .map(v => v.toString().padStart(2, '0'))
        .join(':')
    )
  }

  function handleDateSelect(date: Date) {
    const newDate = new Date(date)
    setDate(newDate)

    if (time) {
      const parsed = parseTimeInput(time)
      if (parsed) {
        newDate.setHours(parsed.hours)
        newDate.setMinutes(parsed.minutes)
        newDate.setSeconds(parsed.seconds)
      }
    }

    onSelect?.(newDate)
    setOpen(false)
  }

  return (
    <div className='flex w-full flex-col gap-2'>
      <Label htmlFor={id} className='gap-1'>
        {name}
        {required && <span className='text-primary'>*</span>}
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
              {selected?.toLocaleDateString() ?? now.toLocaleDateString()}
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

        <div className='flex w-32 flex-col gap-1'>
          <Input
            type='text'
            placeholder={now.toLocaleTimeString()}
            value={time ?? ''}
            onChange={e => handleTimeChange(e.target.value)}
            onBlur={handleTimeBlur}
            disabled={disabled}
            required={required}
            className={twMerge(
              timeError && 'border-destructive ring-destructive ring-2'
            )}
          />
        </div>
      </div>
    </div>
  )
}

function parseTimeInput(
  input: string
): { hours: number; minutes: number; seconds: number } | null {
  if (!input.trim()) return null

  const separators = /[:.\s]/
  const hasSeparators = separators.test(input)

  if (hasSeparators) {
    const parts = input.split(separators).filter(p => p.length > 0)

    if (parts.length < 2 || parts.length > 3) return null

    const hours = Number.parseInt(parts[0])
    const minutes = Number.parseInt(parts[1])
    const seconds = parts.length === 3 ? Number.parseInt(parts[2]) : 0

    if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds))
      return null
    if (hours < 0 || hours > 23) return null
    if (minutes < 0 || minutes > 59) return null
    if (seconds < 0 || seconds > 59) return null

    return { hours, minutes, seconds }
  }

  const digits = input.replaceAll(/\D/g, '')
  if (digits.length < 1 || digits.length > 6) return null

  const padded = digits.padEnd(6, '0')
  const hoursStr = padded.slice(0, 2)
  const minutesStr = padded.slice(2, 4)
  const secondsStr = padded.slice(4, 6)

  const hours = Number.parseInt(hoursStr)
  const minutes = Number.parseInt(minutesStr)
  const seconds = Number.parseInt(secondsStr)

  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds))
    return null
  if (hours > 23 || minutes > 59 || seconds > 59) return null

  return { hours, minutes, seconds }
}
