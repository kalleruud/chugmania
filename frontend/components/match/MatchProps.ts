import type { Match } from '@common/models/match'
import type { BaseRowProps } from '../row/RowProps'

export type DisplayMatch = Omit<Match, 'webhookCapture'>

export type MatchProps = BaseRowProps<DisplayMatch> & {
  hideTrack?: boolean
}
