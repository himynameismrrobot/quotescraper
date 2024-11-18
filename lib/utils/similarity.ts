/**
 * Calculate the cosine distance between two vectors.
 * Cosine distance = 1 - cosine similarity
 * @param a First vector
 * @param b Second vector
 * @returns Cosine distance between vectors
 */
export function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 1; // Maximum distance for zero vectors
  }

  const similarity = dotProduct / (magnitudeA * magnitudeB);
  // Clamp similarity to [-1, 1] to handle floating point errors
  const clampedSimilarity = Math.max(-1, Math.min(1, similarity));
  // Convert similarity to distance
  return 1 - clampedSimilarity;
}
