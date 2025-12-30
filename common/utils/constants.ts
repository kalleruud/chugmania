// Rating System Constants
export const RATING_CONSTANTS = {
  INITIAL_RATING: 1200,
  NO_DATA_RATING: 600,

  // Penalty for high deviation, prevents players with few entries from dominating the rankings
  DEVIATION_PENALTY: 2,

  // Weighting match vs. laptime ratings
  MATCH_WEIGHT: 2 / 3,
}
