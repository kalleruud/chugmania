import type { Match } from '@common/models/match'
import type { UserInfo } from '@common/models/user'
import type { BaseRowProps } from '../row/RowProps'

export type MatchProps = BaseRowProps<Match> & {
  hideTrack?: boolean
  readOnly?: boolean
  user1?: UserInfo
  user2?: UserInfo
}
