import type { SessionResponse } from '@backend/database/schema'
import type { UserInfo } from '@common/models/user'
import type { VariantProps } from 'class-variance-authority'
import {
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  type LucideIcon,
} from 'lucide-react'
import type { buttonVariants } from '../ui/button'

export const RESPONSE_OPTIONS: {
  response: SessionResponse
  Icon: LucideIcon
  variant: VariantProps<typeof buttonVariants>['variant']
}[] = [
  { response: 'yes', Icon: CircleCheck, variant: 'default' },
  { response: 'maybe', Icon: CircleQuestionMark, variant: 'outline' },
  { response: 'no', Icon: CircleX, variant: 'destructive' },
]

export function getUserSortName(user: UserInfo) {
  return user.shortName ?? `${user.firstName} ${user.lastName ?? ''}`
}
