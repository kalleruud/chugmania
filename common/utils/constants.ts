// Rating System Constants
export const RATING_CONSTANTS = {
  INITIAL_RATING: 1200,
  MATCH_K_FACTOR: 32, // Standard ELO K-factor

  // Lap Rating Constants
  LAP_RATING_SCALE: 400, // Scale factor for logarithmic performance score
  TRACK_STATS_EMA_ALPHA_MAX: 0.1, // Max alpha for track average EMA
  USER_TRACK_EMA_ALPHA: 0.3, // Alpha for user's per-track rating EMA

  // Track Maturity / Confidence
  TRACK_MATURITY_LAPS: 50, // Laps to reach ~63% confidence
  PRIOR_WEIGHT: 5, // Equivalent to 5 fully mature tracks for Bayesian Prior

  // Weighting
  MATCH_WEIGHT: 0.5,
  LAP_WEIGHT: 0.5,

  // Dampening
  LAP_NORMALIZATION_FACTOR: 0.6, // Dampen variance of LapRating before mixing
}
