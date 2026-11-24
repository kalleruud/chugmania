import { useConnection } from '@/contexts/ConnectionContext'
import { useTimeAgoStrict } from '@/hooks/useTimeAgoStrict'
import loc from '@common/locale/locales'
import {
  CALENDAR_TOKEN_NAME,
  isApiTokenExpired,
  type ApiToken,
} from '@common/models/apiToken'
import {
  CalendarDaysIcon,
  ClipboardIcon,
  KeyIcon,
} from '@heroicons/react/24/solid'
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
  ItemMedia,
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
  const Icon = token.name === CALENDAR_TOKEN_NAME ? CalendarDaysIcon : KeyIcon
  const removeLabel = isExpired
    ? loc.no.apiTokens.remove
    : loc.no.apiTokens.revoke

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
      size='sm'
      className={twMerge(
        'flex-nowrap rounded-none py-3 first:pt-4 last:pb-4',
        isExpired && 'text-muted-foreground'
      )}>
      <ItemMedia
        variant='icon'
        className={twMerge(
          'text-primary',
          isExpired && 'text-muted-foreground'
        )}>
        <Icon />
      </ItemMedia>
      <ItemContent className='min-w-0 gap-0.5'>
        <ItemTitle className='w-full min-w-0'>
          <span className='truncate' title={token.name}>
            {token.name}
          </span>
          {isExpired && (
            <Badge variant='destructive' className='flex-none py-0'>
              {loc.no.apiTokens.expired}
            </Badge>
          )}
        </ItemTitle>
        <ItemDescription className='flex flex-wrap items-center gap-x-3 text-xs'>
          <span>{expiryLabel(token)}</span>
          <LastUsed lastUsedAt={token.lastUsedAt} />
          <span className='font-mono opacity-70'>{token.hint}</span>
        </ItemDescription>
      </ItemContent>
      <ItemActions className='gap-1'>
        {canCopy && !isExpired && (
          <Button
            size='icon-sm'
            variant='ghost'
            className='text-muted-foreground hover:text-foreground'
            title={loc.no.apiTokens.copy}
            aria-label={loc.no.apiTokens.copy}
            onClick={handleCopy}>
            <ClipboardIcon />
          </Button>
        )}
        <ConfirmationButton
          size='sm'
          variant='ghost'
          className='text-muted-foreground hover:text-destructive'
          title={removeLabel}
          aria-label={removeLabel}
          onClick={() =>
            revokeApiToken(socket, token.id).catch(() => undefined)
          }>
          <Trash2 />
        </ConfirmationButton>
      </ItemActions>
    </Item>
  )
}
