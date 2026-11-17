import loc from '@common/locale/locales'
import { Badge } from '../ui/badge'

export default function BooleanValue({ value }: Readonly<{ value: boolean }>) {
  return (
    <Badge variant={value ? 'secondary' : 'outline'}>
      {value ? loc.no.objectViewer.yes : loc.no.objectViewer.no}
    </Badge>
  )
}
