import ApiTokenRow, {
  type ApiTokenRowProps,
} from '@/components/apiToken/ApiTokenRow'
import {
  getOwnActiveTokens,
  isAtTokenLimit,
} from '@/components/apiToken/apiTokens'
import CreateApiTokenDialog from '@/components/apiToken/CreateApiTokenDialog'
import TokenLimitDialog from '@/components/apiToken/TokenLimitDialog'
import TokenValueDialog from '@/components/apiToken/TokenValueDialog'
import GroupedList from '@/components/grouped-list/GroupedList'
import type { Grouping } from '@/components/grouped-list/grouping'
import { PageHeader } from '@/components/PageHeader'
import SegmentedProgress from '@/components/SegmentedProgress'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import {
  isApiTokenExpired,
  MAX_API_TOKENS,
  type ApiToken,
} from '@common/models/apiToken'
import { getUserFullName, type UserInfo } from '@common/models/user'
import { KeyIcon, PlusIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'

type Scope = 'mine' | 'all'

function userGrouping(users: UserInfo[]): Grouping<ApiToken> {
  return {
    key: token => token.user,
    label: key => {
      const user = users.find(u => u.id === key)
      return user ? getUserFullName(user) : key
    },
  }
}

function byStatusAndAge(a: ApiToken, b: ApiToken) {
  const expired = Number(isApiTokenExpired(a)) - Number(isApiTokenExpired(b))
  return expired || b.createdAt - a.createdAt
}

export default function TokensPage() {
  const { isLoading, loggedInUser } = useAuth()
  const { apiTokens, users } = useData()
  const [scope, setScope] = useState<Scope>('mine')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLimitOpen, setIsLimitOpen] = useState(false)
  const [revealedValue, setRevealedValue] = useState<string>()

  if (isLoading || (loggedInUser && apiTokens === undefined)) {
    return (
      <div className='flex h-dvh-safe w-full items-center justify-center'>
        <Spinner />
      </div>
    )
  }

  if (!loggedInUser) throw new Error(loc.no.user.notLoggedIn)

  const isAdmin = loggedInUser.role === 'admin'
  const ownActive = getOwnActiveTokens(apiTokens, loggedInUser)
  const visibleTokens = (apiTokens ?? [])
    .filter(
      token => (isAdmin && scope === 'all') || token.user === loggedInUser.id
    )
    .toSorted(byStatusAndAge)

  const handleCreate = () => {
    if (isAtTokenLimit(apiTokens, loggedInUser)) setIsLimitOpen(true)
    else setIsCreateOpen(true)
  }

  const rowProps = (token: ApiToken): ApiTokenRowProps => ({
    token,
    canCopy: token.user === loggedInUser.id,
    onShowValue: setRevealedValue,
  })

  return (
    <div className='flex flex-col gap-2'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{loc.no.apiTokens.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='flex flex-col gap-2 rounded-sm border bg-background p-2'>
        <PageHeader
          title={loc.no.apiTokens.title}
          description={loc.no.apiTokens.description}
          Icon={KeyIcon}
        />

        {!isAdmin && (
          <SegmentedProgress
            segments={[
              {
                label: loc.no.apiTokens.activeCount,
                value: ownActive.length,
                total: MAX_API_TOKENS,
                colorClassName:
                  ownActive.length >= MAX_API_TOKENS
                    ? 'bg-destructive'
                    : 'bg-primary',
              },
            ]}
          />
        )}

        {isAdmin && (
          <Tabs
            value={scope}
            onValueChange={value => {
              if (value === 'mine' || value === 'all') setScope(value)
            }}>
            <TabsList>
              <TabsTrigger value='mine'>{loc.no.apiTokens.mine}</TabsTrigger>
              <TabsTrigger value='all'>{loc.no.apiTokens.allUsers}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <GroupedList
          items={visibleTokens}
          Row={ApiTokenRow}
          rowProps={rowProps}
          getKey={token => token.id}
          itemsClassName='gap-0 rounded-sm bg-background-secondary'
          grouping={scope === 'all' && users ? userGrouping(users) : undefined}
        />

        <Button
          variant='ghost'
          size='sm'
          className='w-fit text-muted-foreground'
          onClick={handleCreate}>
          <PlusIcon />
          {loc.no.apiTokens.create}
        </Button>
      </div>

      <CreateApiTokenDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={setRevealedValue}
      />
      <TokenLimitDialog
        open={isLimitOpen}
        onOpenChange={setIsLimitOpen}
        tokens={ownActive}
        onRevoked={() => setIsCreateOpen(true)}
      />
      <TokenValueDialog
        value={revealedValue}
        onClose={() => setRevealedValue(undefined)}
      />
    </div>
  )
}
