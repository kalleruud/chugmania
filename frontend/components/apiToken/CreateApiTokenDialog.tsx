import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import {
  DEFAULT_API_TOKEN_DAYS,
  MAX_API_TOKEN_NAME_LENGTH,
} from '@common/models/apiToken'
import { formatDateWithYear } from '@common/utils/date'
import { ChevronDownIcon } from '@heroicons/react/24/solid'
import { DateTime } from 'luxon'
import { useState, type SubmitEvent } from 'react'
import { toast } from 'sonner'
import { Field } from '../FormFields'
import { Button } from '../ui/button'
import { Calendar } from '../ui/calendar'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Label } from '../ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'

type ExpiryMode = 'date' | 'never'

function defaultExpiry() {
  return DateTime.now().plus({ days: DEFAULT_API_TOKEN_DAYS }).toJSDate()
}

export default function CreateApiTokenDialog({
  open,
  onOpenChange,
  onCreated,
}: Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (value: string) => void
}>) {
  const { socket } = useConnection()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<ExpiryMode>('date')
  const [date, setDate] = useState(defaultExpiry)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = () => {
    setName('')
    setMode('date')
    setDate(defaultExpiry())
  }

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    const request = socket
      .emitWithAck('create_api_token', {
        type: 'CreateApiTokenRequest',
        name,
        expiresAt:
          mode === 'never'
            ? null
            : DateTime.fromJSDate(date).endOf('day').toMillis(),
      })
      .then(r => {
        if (!r.success) throw new Error(r.message)
        return r
      })
    toast.promise(request, loc.no.apiTokens.createRequest)
    const response = await request.catch(() => undefined)
    setIsSubmitting(false)
    if (!response) return
    reset()
    onOpenChange(false)
    onCreated(response.value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.apiTokens.createTitle}</DialogTitle>
          <DialogDescription>
            {loc.no.apiTokens.createDescription}
          </DialogDescription>
        </DialogHeader>

        <form
          id='createApiTokenForm'
          className='flex flex-col gap-4 py-2'
          onSubmit={handleSubmit}>
          <Field
            id='apiTokenName'
            name={loc.no.apiTokens.name}
            placeholder={loc.no.apiTokens.namePlaceholder}
            value={name}
            maxLength={MAX_API_TOKEN_NAME_LENGTH}
            onChange={e => setName(e.target.value)}
            required
            autoFocus
          />

          <div className='flex flex-col gap-2'>
            <Label>{loc.no.apiTokens.expiry}</Label>
            <div className='flex flex-wrap gap-2'>
              <ToggleGroup
                type='single'
                value={mode}
                onValueChange={value => {
                  if (value === 'date' || value === 'never') setMode(value)
                }}
                variant='outline'>
                <ToggleGroupItem value='date'>
                  {loc.no.apiTokens.expiryDate}
                </ToggleGroupItem>
                <ToggleGroupItem value='never'>
                  {loc.no.apiTokens.expiryNever}
                </ToggleGroupItem>
              </ToggleGroup>

              {mode === 'date' && (
                <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      className='flex-1 justify-between font-normal'>
                      {formatDateWithYear(date)}
                      <ChevronDownIcon />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className='w-auto overflow-hidden p-0'
                    align='start'>
                    <Calendar
                      mode='single'
                      required
                      showOutsideDays
                      showWeekNumber
                      weekStartsOn={1}
                      selected={date}
                      defaultMonth={date}
                      disabled={{ before: new Date() }}
                      onSelect={selected => {
                        setDate(selected)
                        setIsPickerOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline' disabled={isSubmitting}>
              {loc.no.common.cancel}
            </Button>
          </DialogClose>
          <Button
            type='submit'
            form='createApiTokenForm'
            disabled={isSubmitting || !name.trim()}>
            {loc.no.apiTokens.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
