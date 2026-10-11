import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { WebhookDraft } from '@common/models/webhook'
import WebhookDraftInput from './WebhookDraftInput'

export default function WebhookDraftEditButton({
  draft,
}: Readonly<{ draft: WebhookDraft }>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size='sm' variant='outline'>
          Åpne utkast
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[90dvh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Løpsutkast</DialogTitle>
          <DialogDescription>
            Tildel spillere, velg bane og kontroller tidene før publisering.
          </DialogDescription>
        </DialogHeader>
        <WebhookDraftInput draft={draft} />
      </DialogContent>
    </Dialog>
  )
}
