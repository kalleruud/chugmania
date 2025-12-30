export type Ranking = {
  user: string
  ranking: number
  // Visible for now as per plan context discussion, can be hidden in UI if needed
  totalRating: number
  matchRating: number
  trackRating: number
}
