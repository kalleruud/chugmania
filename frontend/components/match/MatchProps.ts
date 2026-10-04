import type { Match } from '@common/models/match'
import type { BaseRowProps } from '../row/RowProps'

export type MatchProps = BaseRowProps<Match> & {
  hideTrack?: boolean
}
