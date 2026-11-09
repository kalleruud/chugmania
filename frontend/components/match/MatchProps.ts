import type { Match } from '@common/models/match'
import type { BaseRowProps } from '../row/RowProps'

export type DisplayMatch = Match

export type MatchProps = BaseRowProps<DisplayMatch> & {
  hideTrack?: boolean
}
