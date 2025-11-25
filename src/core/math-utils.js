/**
 * Math Utilities for t-SNE
 * Core mathematical functions for distance computation, probability calculations, etc.
 */

/**
 * Compute Euclidean distance between two points
 * @param {number[]} a - First point
 * @param {number[]} b - Second point
 * @returns {number} Euclidean distance
 */
export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Compute squared Euclidean distance between two points
 * @param {number[]} a - First point
 * @param {number[]} b - Second point
 * @returns {number} Squared Euclidean distance
 */
export function squaredEuclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

/**
 * Compute pairwise squared distance matrix for all points
 * @param {number[][]} X - Array of points (N x D)
 * @returns {number[][]} N x N distance matrix
 */
export function computeDistanceMatrix(X) {
  const n = X.length;
  const D = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = squaredEuclideanDistance(X[i], X[j]);
      D[i][j] = dist;
      D[j][i] = dist;
    }
  }
  
  return D;
}

/**
 * Compute Shannon entropy of a probability distribution
 * H(P) = -sum(p * log2(p))
 * @param {number[]} P - Probability distribution
 * @returns {number} Shannon entropy
 */
export function shannonEntropy(P) {
  let H = 0;
  for (let i = 0; i < P.length; i++) {
    if (P[i] > 1e-12) {
      H -= P[i] * Math.log2(P[i]);
    }
  }
  return H;
}

/**
 * Compute perplexity from entropy
 * Perp(P) = 2^H(P)
 * @param {number} entropy - Shannon entropy
 * @returns {number} Perplexity
 */
export function entropyToPerplexity(entropy) {
  return Math.pow(2, entropy);
}

/**
 * Compute conditional probabilities p(j|i) using Gaussian kernel
 * p(j|i) = exp(-||xi - xj||^2 / 2σ²) / sum_k≠i exp(-||xi - xk||^2 / 2σ²)
 * @param {number[]} distances - Squared distances from point i to all other points
 * @param {number} sigma - Bandwidth parameter
 * @param {number} i - Index of the center point (to exclude)
 * @returns {number[]} Conditional probabilities
 */
export function computeConditionalProbabilities(distances, sigma, i) {
  const n = distances.length;
  const twoSigmaSq = 2 * sigma * sigma;
  const P = Array(n).fill(0);
  
  // Compute unnormalized probabilities
  let sum = 0;
  for (let j = 0; j < n; j++) {
    if (j !== i) {
      P[j] = Math.exp(-distances[j] / twoSigmaSq);
      sum += P[j];
    }
  }
  
  // Normalize
  if (sum > 1e-12) {
    for (let j = 0; j < n; j++) {
      P[j] /= sum;
    }
  }
  
  return P;
}

/**
 * Binary search to find sigma that produces target perplexity
 * @param {number[][]} distanceMatrix - Full distance matrix
 * @param {number} i - Index of center point
 * @param {number} targetPerplexity - Target perplexity value
 * @param {boolean} returnHistory - Whether to return search history
 * @param {number} maxIter - Maximum iterations for binary search
 * @param {number} tol - Tolerance for convergence
 * @returns {{sigma: number, P: number[], entropy: number, history: object[]}}
 */
export function findSigma(distanceMatrix, i, targetPerplexity, returnHistory = false, maxIter = 50, tol = 1e-5) {
  const distances = distanceMatrix[i];
  const targetEntropy = Math.log2(targetPerplexity);
  
  let sigmaMin = 1e-10;
  let sigmaMax = 1e10;
  let sigma = 1.0;
  
  const history = [];
  
  for (let iter = 0; iter < maxIter; iter++) {
    const P = computeConditionalProbabilities(distances, sigma, i);
    const entropy = shannonEntropy(P);
    const perplexity = entropyToPerplexity(entropy);
    
    if (returnHistory) {
      history.push({
        iteration: iter,
        sigma: sigma,
        perplexity: perplexity
      });
    }
    
    const entropyDiff = entropy - targetEntropy;
    
    if (Math.abs(entropyDiff) < tol) {
      return { sigma, P, entropy, perplexity, history };
    }
    
    if (entropyDiff > 0) {
      // Entropy too high, decrease sigma
      sigmaMax = sigma;
      sigma = (sigmaMin + sigma) / 2;
    } else {
      // Entropy too low, increase sigma
      sigmaMin = sigma;
      sigma = (sigma + sigmaMax) / 2;
      if (sigmaMax === 1e10) {
        sigma *= 2;
      }
    }
  }
  
  const P = computeConditionalProbabilities(distances, sigma, i);
  const entropy = shannonEntropy(P);
  const perplexity = entropyToPerplexity(entropy);
  
  return { sigma, P, entropy, perplexity, history };
}

/**
 * Compute Gaussian PDF value
 * @param {number} x - Input value
 * @param {number} mu - Mean
 * @param {number} sigma - Standard deviation
 * @returns {number} PDF value
 */
export function gaussianPDF(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/**
 * Compute Student's t-distribution PDF (1 degree of freedom = Cauchy)
 * @param {number} x - Input value
 * @returns {number} PDF value
 */
export function studentTPDF(x) {
  return 1 / (Math.PI * (1 + x * x));
}

/**
 * Compute Q matrix (low-dimensional similarities using t-distribution)
 * q_ij = (1 + ||yi - yj||^2)^-1 / sum_k≠l (1 + ||yk - yl||^2)^-1
 * @param {number[][]} Y - Low-dimensional embedding (N x d)
 * @returns {number[][]} Normalized Q matrix
 */
export function computeQMatrix(Y) {
  const n = Y.length;
  const Qunnorm = Array(n).fill(null).map(() => Array(n).fill(0));
  
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const distSq = squaredEuclideanDistance(Y[i], Y[j]);
      const qij = 1 / (1 + distSq);
      Qunnorm[i][j] = qij;
      Qunnorm[j][i] = qij;
      sum += 2 * qij;
    }
  }
  
  // Normalize
  const Q = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        Q[i][j] = Math.max(Qunnorm[i][j] / sum, 1e-12);
      }
    }
  }
  
  return Q;
}

/**
 * Compute Q matrix with unnormalized values (for gradient computation)
 * @param {number[][]} Y - Low-dimensional embedding (N x d)
 * @returns {{Q: number[][], Qunnorm: number[][]}} Normalized and unnormalized Q matrices
 */
export function computeQMatrixFull(Y) {
  const n = Y.length;
  const Qunnorm = Array(n).fill(null).map(() => Array(n).fill(0));
  
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const distSq = squaredEuclideanDistance(Y[i], Y[j]);
      const qij = 1 / (1 + distSq);
      Qunnorm[i][j] = qij;
      Qunnorm[j][i] = qij;
      sum += 2 * qij;
    }
  }
  
  // Normalize
  const Q = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        Q[i][j] = Math.max(Qunnorm[i][j] / sum, 1e-12);
      }
    }
  }
  
  return { Q, Qunnorm };
}

/**
 * Compute KL divergence between P and Q
 * KL(P||Q) = sum_ij p_ij * log(p_ij / q_ij)
 * @param {number[][]} P - High-dimensional joint probabilities
 * @param {number[][]} Q - Low-dimensional joint probabilities
 * @returns {number} KL divergence
 */
export function klDivergence(P, Q) {
  const n = P.length;
  let kl = 0;
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && P[i][j] > 1e-12) {
        kl += P[i][j] * Math.log(P[i][j] / Q[i][j]);
      }
    }
  }
  
  return kl;
}

/**
 * Compute gradient of KL divergence with respect to Y
 * dC/dy_i = 4 * sum_j (p_ij - q_ij)(y_i - y_j)(1 + ||y_i - y_j||^2)^-1
 * @param {number[][]} P - High-dimensional probabilities
 * @param {number[][]} Q - Low-dimensional probabilities
 * @param {number[][]} Y - Current embedding
 * @returns {number[][]} Gradient matrix (N x d)
 */
export function computeGradient(P, Q, Y) {
  const n = Y.length;
  const d = Y[0].length;
  const grad = Array(n).fill(null).map(() => Array(d).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const distSq = squaredEuclideanDistance(Y[i], Y[j]);
        const qunnorm = 1 / (1 + distSq);
        const mult = 4 * (P[i][j] - Q[i][j]) * qunnorm;
        for (let dim = 0; dim < d; dim++) {
          grad[i][dim] += mult * (Y[i][dim] - Y[j][dim]);
        }
      }
    }
  }
  
  return grad;
}

/**
 * Compute magnitude of gradient for a single point
 * @param {number[]} gradPoint - Gradient vector for one point
 * @returns {number} Magnitude
 */
export function gradientMagnitude(gradPoint) {
  let sum = 0;
  for (let i = 0; i < gradPoint.length; i++) {
    sum += gradPoint[i] * gradPoint[i];
  }
  return Math.sqrt(sum);
}

/**
 * Initialize low-dimensional embedding with small random values
 * @param {number} n - Number of points
 * @param {number} d - Target dimension
 * @param {number} scale - Scale of random initialization
 * @returns {number[][]} Initial embedding
 */
export function initializeEmbedding(n, d, scale = 0.0001) {
  const Y = [];
  for (let i = 0; i < n; i++) {
    const point = [];
    for (let j = 0; j < d; j++) {
      point.push((Math.random() - 0.5) * 2 * scale);
    }
    Y.push(point);
  }
  return Y;
}

/**
 * Deep clone a 2D array
 * @param {number[][]} arr - Array to clone
 * @returns {number[][]} Cloned array
 */
export function clone2D(arr) {
  return arr.map(row => [...row]);
}
