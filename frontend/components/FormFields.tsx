import { formatDateWithYear, formatTimeOnly } from '@common/utils/date'
import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { useState, type ComponentProps, type KeyboardEvent } from 'react'
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

function dateToTime(date: Date | undefined) {
  if (!date) return undefined
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

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
      <Select value={value} onValueChange={onValueChange} {...props}>
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

  function handleTimeChange(timeString: string) {
    setTime(formatTimeInput(timeString))
  }

  function handleTimeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const { selectionStart, selectionEnd, value } = e.currentTarget

    if (selectionStart === null || selectionStart !== selectionEnd) return

    const separatorIndex =
      e.key === 'Backspace' ? selectionStart - 1 : selectionStart
    if (value[separatorIndex] !== ':') return

    e.preventDefault()
    setTime(
      formatTimeInput(
        value.slice(0, separatorIndex) + value.slice(separatorIndex + 2)
      )
    )
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
    setTime(formatParsedTime(parsed))
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
              {formatDateWithYear(selected ?? now)}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-auto overflow-hidden p-0' align='start'>
            <Calendar
              mode='single'
              required
              showOutsideDays
              showWeekNumber
              weekStartsOn={1}
              selected={selected}
              onSelect={handleDateSelect}
            />
          </PopoverContent>
        </Popover>

        <div className='flex w-32 flex-col gap-1'>
          <Input
            type='text'
            placeholder={formatTimeOnly(now)}
            value={time}
            onChange={e => handleTimeChange(e.target.value)}
            onKeyDown={handleTimeKeyDown}
            onBlur={handleTimeBlur}
            inputMode='decimal'
            disabled={disabled}
            required={required}
            className={twMerge(
              timeError && 'border-destructive ring-2 ring-destructive'
            )}
          />
        </div>
      </div>
    </div>
  )
}

function validateTime(
  hours: number,
  minutes: number,
  seconds: number
): boolean {
  return (
    !Number.isNaN(hours) &&
    !Number.isNaN(minutes) &&
    !Number.isNaN(seconds) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59 &&
    seconds >= 0 &&
    seconds <= 59
  )
}

function formatTimeInput(input: string): string {
  const normalized = input.replaceAll(/[.,\s]/g, ':')
  if (normalized.includes(':')) return normalized.slice(0, 8)
  if (/\D/.test(normalized)) return normalized.slice(0, 8)

  const digits = normalized.replaceAll(/\D/g, '').slice(0, 6)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`
  if (digits.length === 6 && digits.endsWith('00')) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`
}

function formatParsedTime({
  hours,
  minutes,
  seconds,
}: {
  hours: number
  minutes: number
  seconds: number
}): string {
  const formattedHours = hours.toString().padStart(2, '0')
  const formattedMinutes = minutes.toString().padStart(2, '0')
  if (seconds === 0) return `${formattedHours}:${formattedMinutes}`
  return `${formattedHours}:${formattedMinutes}:${seconds.toString().padStart(2, '0')}`
}

function parseTimeWithSeparators(
  input: string
): { hours: number; minutes: number; seconds: number } | null {
  const parts = input.replaceAll(/[.,\s]/g, ':').split(':')

  if (parts.length < 2 || parts.length > 3) return null
  if (parts.some(part => !/^\d+$/.test(part))) return null

  const hours = Number.parseInt(parts[0], 10)
  const minutes = Number.parseInt(parts[1], 10)
  const seconds = parts.length === 3 ? Number.parseInt(parts[2], 10) : 0

  if (!validateTime(hours, minutes, seconds)) return null

  return { hours, minutes, seconds }
}

function parseTimeWithoutSeparators(
  input: string
): { hours: number; minutes: number; seconds: number } | null {
  if (!/^\d+$/.test(input)) return null

  const digits = input
  if (digits.length < 1 || digits.length > 6) return null

  const padded = digits.padEnd(6, '0')
  const hours = Number.parseInt(padded.slice(0, 2))
  const minutes = Number.parseInt(padded.slice(2, 4))
  const seconds = Number.parseInt(padded.slice(4, 6))

  if (!validateTime(hours, minutes, seconds)) return null

  return { hours, minutes, seconds }
}

function parseTimeInput(
  input: string
): { hours: number; minutes: number; seconds: number } | null {
  if (!input.trim()) return null

  const separators = /[:,.\s]/
  const hasSeparators = separators.test(input)

  return hasSeparators
    ? parseTimeWithSeparators(input)
    : parseTimeWithoutSeparators(input)
}
