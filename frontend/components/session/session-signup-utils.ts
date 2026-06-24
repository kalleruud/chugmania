import type { SessionResponse } from '@backend/database/schema'
import type { UserInfo } from '@common/models/user'
import {
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  type LucideIcon,
} from 'lucide-react'

export const RESPONSE_OPTIONS: {
  response: SessionResponse
  Icon: LucideIcon
}[] = [
  { response: 'yes', Icon: CircleCheck },
  { response: 'maybe', Icon: CircleQuestionMark },
  { response: 'no', Icon: CircleX },
]

export function getUserSortName(user: UserInfo) {
  return user.shortName ?? `${user.firstName} ${user.lastName ?? ''}`
}
