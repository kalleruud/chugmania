import loc from '@common/locale/locales'
import { ClipboardIcon } from '@heroicons/react/24/solid'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '../ui/alert'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { copyToClipboard } from './apiTokens'

export default function TokenValueDialog({
  value,
  onClose,
}: Readonly<{ value: string | undefined; onClose: () => void }>) {
  return (
    <Dialog
      open={value !== undefined}
      onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.apiTokens.createdTitle}</DialogTitle>
          <DialogDescription>{loc.no.apiTokens.title}</DialogDescription>
        </DialogHeader>

        <Alert variant='destructive'>
          <TriangleAlert />
          <AlertDescription>
            {loc.no.apiTokens.createdDescription}
          </AlertDescription>
        </Alert>

        <Input
          readOnly
          value={value ?? ''}
          className='font-mono text-xs'
          onFocus={e => e.currentTarget.select()}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>{loc.no.apiTokens.close}</Button>
          </DialogClose>
          <Button
            onClick={async () => {
              if (!value) return
              if (!(await copyToClipboard(value)))
                toast.error(loc.no.apiTokens.copyFailed)
            }}>
            <ClipboardIcon />
            {loc.no.apiTokens.copy}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
