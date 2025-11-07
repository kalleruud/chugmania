import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import loc from '@/lib/locales'
import { type FallbackProps } from 'react-error-boundary'
import { getRandomItem } from '../utils/utils'

export function ErrorPage({
  error,
  resetErrorBoundary,
}: Readonly<FallbackProps>) {
  // Call resetErrorBoundary() to reset the error boundary and retry the render.

  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{loc.no.error.title}</EmptyTitle>
        <EmptyDescription>
          {error.message ?? getRandomItem(loc.no.error.descriptions)}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent></EmptyContent>
    </Empty>
  )
}
