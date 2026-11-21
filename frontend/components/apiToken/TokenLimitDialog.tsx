import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import { MAX_API_TOKENS, type ApiToken } from '@common/models/apiToken'
import { useState } from 'react'
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
import { Item, ItemActions, ItemContent, ItemTitle } from '../ui/item'
import { LastUsed } from './ApiTokenRow'
import { revokeApiToken } from './apiTokens'

function byLeastRecentlyUsed(a: ApiToken, b: ApiToken) {
  return (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0)
}

export default function TokenLimitDialog({
  open,
  onOpenChange,
  tokens,
  onRevoked,
}: Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  tokens: ApiToken[]
  onRevoked: () => void
}>) {
  const { socket } = useConnection()
  const [isRevoking, setIsRevoking] = useState(false)

  const handleRevoke = async (id: string) => {
    setIsRevoking(true)
    const revoked = await revokeApiToken(socket, id).then(
      () => true,
      () => false
    )
    setIsRevoking(false)
    if (!revoked) return
    onOpenChange(false)
    onRevoked()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {loc.no.apiTokens.limitTitle(MAX_API_TOKENS)}
          </DialogTitle>
          <DialogDescription>
            {loc.no.apiTokens.limitDescription}
          </DialogDescription>
        </DialogHeader>

        <div className='flex max-h-96 flex-col gap-1 overflow-y-auto'>
          {tokens.toSorted(byLeastRecentlyUsed).map(token => (
            <Item key={token.id} size='sm' variant='outline'>
              <ItemContent className='min-w-0'>
                <ItemTitle className='truncate'>{token.name}</ItemTitle>
                <LastUsed
                  lastUsedAt={token.lastUsedAt}
                  className='text-xs text-muted-foreground'
                />
              </ItemContent>
              <ItemActions>
                <Button
                  size='sm'
                  variant='destructive'
                  disabled={isRevoking}
                  onClick={() => handleRevoke(token.id)}>
                  {loc.no.apiTokens.revoke}
                </Button>
              </ItemActions>
            </Item>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>{loc.no.common.cancel}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
