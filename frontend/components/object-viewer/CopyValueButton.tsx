import loc from '@common/locale/locales'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'

export default function CopyValueButton({
  value,
}: Readonly<{ value: string }>) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(loc.no.objectViewer.copied)
    } catch {
      toast.error(loc.no.objectViewer.copyFailed)
    }
  }
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      className='shrink-0 text-muted-foreground'
      aria-label={loc.no.objectViewer.copy}
      onClick={copy}>
      <Copy />
    </Button>
  )
}
