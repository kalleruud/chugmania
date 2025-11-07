import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import loc from '@/lib/locales'
import { type FallbackProps } from 'react-error-boundary'
import { Link } from 'react-router-dom'
import { getRandomItem } from '../utils/utils'

export function ErrorPage({
  error,
  resetErrorBoundary,
}: Readonly<FallbackProps>) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{loc.no.error.title}</EmptyTitle>
        <EmptyDescription>
          {error.message ?? getRandomItem(loc.no.error.descriptions)}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant='outline' asChild>
          <Link to='/' onClick={resetErrorBoundary}>
            {loc.no.error.retryAction}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
