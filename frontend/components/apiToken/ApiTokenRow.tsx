import { useConnection } from '@/contexts/ConnectionContext'
import { useTimeAgoStrict } from '@/hooks/useTimeAgoStrict'
import loc from '@common/locale/locales'
import {
  CALENDAR_TOKEN_NAME,
  isApiTokenExpired,
  type ApiToken,
} from '@common/models/apiToken'
import { ClipboardIcon } from '@heroicons/react/24/solid'
import { Trash2 } from 'lucide-react'
import { type ComponentProps } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import ConfirmationButton from '../ConfirmationButton'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '../ui/item'
import { copyToClipboard, formatTokenDate, revokeApiToken } from './apiTokens'

export type ApiTokenRowProps = {
  token: ApiToken
  canCopy: boolean
  onShowValue: (value: string) => void
}

function TimeAgo({ date }: Readonly<{ date: number }>) {
  return loc.no.apiTokens.lastUsed(useTimeAgoStrict({ date: new Date(date) }))
}

export function LastUsed({
  lastUsedAt,
  ...props
}: Readonly<{ lastUsedAt: number | null } & ComponentProps<'span'>>) {
  return (
    <span {...props}>
      {lastUsedAt === null ? (
        loc.no.apiTokens.neverUsed
      ) : (
        <TimeAgo date={lastUsedAt} />
      )}
    </span>
  )
}

function expiryLabel(token: ApiToken) {
  if (token.expiresAt === null) return loc.no.apiTokens.neverExpires
  return loc.no.apiTokens.expires(formatTokenDate(token.expiresAt))
}

export default function ApiTokenRow({
  token,
  canCopy,
  onShowValue,
}: Readonly<ApiTokenRowProps>) {
  const { socket } = useConnection()
  const isExpired = isApiTokenExpired(token)

  const handleCopy = async () => {
    const response = await socket.emitWithAck('reveal_api_token', {
      type: 'ApiTokenRequest',
      id: token.id,
    })
    if (!response.success) {
      toast.error(response.message)
      return
    }
    if (!(await copyToClipboard(response.value))) onShowValue(response.value)
  }

  return (
    <Item
      variant='outline'
      className={twMerge(
        'flex-wrap bg-background-secondary',
        isExpired && 'opacity-60'
      )}>
      <ItemContent className='min-w-0'>
        <ItemTitle className='flex-wrap'>
          <span className='truncate'>{token.name}</span>
          {token.name === CALENDAR_TOKEN_NAME && (
            <Badge variant='secondary'>{loc.no.apiTokens.calendar}</Badge>
          )}
          <Badge variant={isExpired ? 'destructive' : 'outline'}>
            {isExpired ? loc.no.apiTokens.expired : loc.no.apiTokens.active}
          </Badge>
        </ItemTitle>
        <ItemDescription className='flex flex-wrap gap-x-3'>
          <span className='font-mono'>{token.hint}</span>
          <span>{expiryLabel(token)}</span>
          <LastUsed lastUsedAt={token.lastUsedAt} />
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {canCopy && !isExpired && (
          <Button size='sm' variant='outline' onClick={handleCopy}>
            <ClipboardIcon />
            {loc.no.apiTokens.copy}
          </Button>
        )}
        <ConfirmationButton
          size='sm'
          variant='destructive'
          onClick={() =>
            revokeApiToken(socket, token.id).catch(() => undefined)
          }>
          <Trash2 />
          {isExpired ? loc.no.apiTokens.remove : loc.no.apiTokens.revoke}
        </ConfirmationButton>
      </ItemActions>
    </Item>
  )
}
