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
import { Link } from 'react-router'

export function ErrorPage({
  error,
  resetErrorBoundary,
}: Readonly<FallbackProps>) {
  const message =
    error instanceof Error ? error.message : loc.no.error.description

  return (
    <div className='flex w-full justify-center-safe'>
      <Empty className='m-safe-or-4 max-w-2xl border border-dashed'>
        <EmptyHeader>
          <EmptyTitle>{loc.no.error.title}</EmptyTitle>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant='outline' asChild>
            <Link to='/' onClick={resetErrorBoundary}>
              {loc.no.error.retryAction}
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
