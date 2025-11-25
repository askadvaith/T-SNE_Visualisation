/**
 * Precomputed t-SNE Engine
 * Runs the full t-SNE algorithm and stores snapshots at each step
 * for leisurely exploration by the user
 */

import { 
  computeDistanceMatrix, 
  findSigma, 
  computeQMatrix, 
  klDivergence,
  computeGradient 
} from './math-utils.js';

/**
 * Enum for t-SNE algorithm steps
 */
export const TSNESteps = {
  INTRO: 'intro',
  INPUT_DATA: 'input-data',
  COMPUTE_DISTANCES: 'compute-distances',
  COMPUTE_SIGMAS: 'compute-sigmas',
  COMPUTE_P_CONDITIONAL: 'compute-p-conditional',
  SYMMETRIZE_P: 'symmetrize-p',
  EARLY_EXAGGERATION: 'early-exaggeration',
  INITIALIZE_EMBEDDING: 'initialize-embedding',
  COMPUTE_Q: 'compute-q',
  COMPUTE_GRADIENT: 'compute-gradient',
  UPDATE_EMBEDDING: 'update-embedding',
  ITERATION_PROGRESS: 'iteration-progress',
  REMOVE_EXAGGERATION: 'remove-exaggeration',
  FINAL_RESULT: 'final-result'
};

/**
 * Step metadata with explanations
 */
export const StepInfo = {
  [TSNESteps.INTRO]: {
    title: 'Introduction to t-SNE',
    category: 'overview',
    shortDesc: 'What is t-SNE and why use it?'
  },
  [TSNESteps.INPUT_DATA]: {
    title: 'Input Data',
    category: 'input',
    shortDesc: 'Our 3D dataset to be reduced'
  },
  [TSNESteps.COMPUTE_DISTANCES]: {
    title: 'Compute Pairwise Distances',
    category: 'high-dim',
    shortDesc: 'Calculate distances between all points'
  },
  [TSNESteps.COMPUTE_SIGMAS]: {
    title: 'Find Sigma Values',
    category: 'high-dim',
    shortDesc: 'Binary search for optimal σ per point'
  },
  [TSNESteps.COMPUTE_P_CONDITIONAL]: {
    title: 'Compute Conditional Probabilities',
    category: 'high-dim',
    shortDesc: 'P(j|i) - similarity in high-D'
  },
  [TSNESteps.SYMMETRIZE_P]: {
    title: 'Symmetrize Probabilities',
    category: 'high-dim',
    shortDesc: 'Create joint distribution P'
  },
  [TSNESteps.EARLY_EXAGGERATION]: {
    title: 'Apply Early Exaggeration',
    category: 'optimization',
    shortDesc: 'Multiply P by 4 initially'
  },
  [TSNESteps.INITIALIZE_EMBEDDING]: {
    title: 'Initialize Low-D Embedding',
    category: 'low-dim',
    shortDesc: 'Random starting positions'
  },
  [TSNESteps.COMPUTE_Q]: {
    title: 'Compute Q Distribution',
    category: 'low-dim',
    shortDesc: 'Student-t similarities in low-D'
  },
  [TSNESteps.COMPUTE_GRADIENT]: {
    title: 'Compute Gradient',
    category: 'optimization',
    shortDesc: 'Direction to minimize KL divergence'
  },
  [TSNESteps.UPDATE_EMBEDDING]: {
    title: 'Update Positions',
    category: 'optimization',
    shortDesc: 'Move points along gradient'
  },
  [TSNESteps.ITERATION_PROGRESS]: {
    title: 'Iteration Progress',
    category: 'optimization',
    shortDesc: 'Watch clusters form over iterations'
  },
  [TSNESteps.REMOVE_EXAGGERATION]: {
    title: 'Remove Exaggeration',
    category: 'optimization',
    shortDesc: 'Fine-tune without exaggeration'
  },
  [TSNESteps.FINAL_RESULT]: {
    title: 'Final Result',
    category: 'result',
    shortDesc: 'The completed embedding'
  }
};

/**
 * Box-Muller transform for Gaussian random numbers
 */
function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Deep clone an array or matrix
 */
function deepClone(arr) {
  if (!arr) return arr;
  if (Array.isArray(arr[0])) {
    return arr.map(row => [...row]);
  }
  return [...arr];
}

/**
 * PrecomputedTSNE class - runs full algorithm and stores all snapshots
 */
export class PrecomputedTSNE {
  constructor(options = {}) {
    this.perplexity = options.perplexity || 30;
    this.learningRate = options.learningRate || 200;
    this.maxIterations = options.maxIterations || 500;
    this.targetDim = options.targetDim || 2;
    this.earlyExaggeration = options.earlyExaggeration || 4;
    this.earlyExaggerationIter = options.earlyExaggerationIter || 100;
    this.momentum = 0.5;
    this.finalMomentum = 0.8;
    this.momentumSwitchIter = 250;
    
    // Snapshot storage
    this.snapshots = [];
    this.stepIndex = 0;
    
    // Algorithm state
    this.inputData = null;
    this.labels = null;
    this.n = 0;
    this.distanceMatrix = null;
    this.sigmas = null;
    this.P_conditional = null;
    this.P = null;
    this.P_original = null;
    this.embedding = null;
    this.Q = null;
    this.gradient = null;
    this.velocity = null;
    this.costs = [];
    this.iterationSnapshots = [];
  }
  
  /**
   * Run the complete t-SNE algorithm and store all snapshots
   * @param {number[][]} inputData - Input points (N x D)
   * @param {number[]} labels - Point labels for coloring
   * @returns {object[]} Array of step snapshots
   */
  run(inputData, labels) {
    this.inputData = inputData;
    this.labels = labels;
    this.n = inputData.length;
    this.snapshots = [];
    
    console.log(`Starting t-SNE computation on ${this.n} points, ${inputData[0].length}D → ${this.targetDim}D`);
    
    // Step 0: Introduction
    this._addSnapshot(TSNESteps.INTRO, {
      n: this.n,
      inputDim: inputData[0].length,
      targetDim: this.targetDim,
      perplexity: this.perplexity
    });
    
    // Step 1: Show input data
    this._addSnapshot(TSNESteps.INPUT_DATA, {
      points: deepClone(inputData),
      labels: [...labels],
      n: this.n,
      dim: inputData[0].length
    });
    
    // Step 2: Compute pairwise distances
    this.distanceMatrix = computeDistanceMatrix(inputData);
    this._addSnapshot(TSNESteps.COMPUTE_DISTANCES, {
      distanceMatrix: deepClone(this.distanceMatrix),
      minDist: this._getMinNonZeroDist(),
      maxDist: this._getMaxDist(),
      avgDist: this._getAvgDist()
    });
    
    // Step 3: Find sigma values (binary search)
    const sigmaResult = this._computeAllSigmas();
    this.sigmas = sigmaResult.sigmas;
    this._addSnapshot(TSNESteps.COMPUTE_SIGMAS, {
      sigmas: [...this.sigmas],
      perplexity: this.perplexity,
      searchHistory: sigmaResult.searchHistory,
      avgSigma: this.sigmas.reduce((a, b) => a + b) / this.sigmas.length
    });
    
    // Step 4: Compute conditional probabilities P(j|i)
    this.P_conditional = this._computeConditionalP();
    this._addSnapshot(TSNESteps.COMPUTE_P_CONDITIONAL, {
      P_conditional: deepClone(this.P_conditional),
      exampleRow: this._getExamplePRow(0)
    });
    
    // Step 5: Symmetrize P
    this.P = this._symmetrizeP();
    this.P_original = deepClone(this.P);
    this._addSnapshot(TSNESteps.SYMMETRIZE_P, {
      P: deepClone(this.P),
      P_conditional: deepClone(this.P_conditional)
    });
    
    // Step 6: Apply early exaggeration
    this._applyEarlyExaggeration();
    this._addSnapshot(TSNESteps.EARLY_EXAGGERATION, {
      P_exaggerated: deepClone(this.P),
      P_original: deepClone(this.P_original),
      exaggerationFactor: this.earlyExaggeration
    });
    
    // Step 7: Initialize embedding
    this.embedding = this._initializeEmbedding();
    this.velocity = Array(this.n).fill(null).map(() => 
      Array(this.targetDim).fill(0)
    );
    this._addSnapshot(TSNESteps.INITIALIZE_EMBEDDING, {
      embedding: deepClone(this.embedding),
      targetDim: this.targetDim
    });
    
    // Step 8: Compute Q distribution
    this.Q = computeQMatrix(this.embedding);
    this._addSnapshot(TSNESteps.COMPUTE_Q, {
      Q: deepClone(this.Q),
      embedding: deepClone(this.embedding)
    });
    
    // Step 9: Compute gradient
    this.gradient = computeGradient(this.P, this.Q, this.embedding);
    this._addSnapshot(TSNESteps.COMPUTE_GRADIENT, {
      gradient: deepClone(this.gradient),
      P: deepClone(this.P),
      Q: deepClone(this.Q),
      embedding: deepClone(this.embedding)
    });
    
    // Step 10: First update
    this._updateEmbedding(0);
    this._addSnapshot(TSNESteps.UPDATE_EMBEDDING, {
      embedding: deepClone(this.embedding),
      gradient: deepClone(this.gradient),
      learningRate: this.learningRate
    });
    
    // Step 11: Run iterations and capture key snapshots
    const keyIterations = this._runIterations();
    this._addSnapshot(TSNESteps.ITERATION_PROGRESS, {
      iterations: keyIterations,
      costs: [...this.costs],
      totalIterations: this.maxIterations
    });
    
    // Step 12: Remove exaggeration snapshot (captured at iteration 100)
    this._addSnapshot(TSNESteps.REMOVE_EXAGGERATION, {
      iteration: this.earlyExaggerationIter,
      embedding: deepClone(this.iterationSnapshots.find(s => s.iteration >= this.earlyExaggerationIter)?.embedding || this.embedding),
      P: deepClone(this.P_original)
    });
    
    // Step 13: Final result
    this._addSnapshot(TSNESteps.FINAL_RESULT, {
      embedding: deepClone(this.embedding),
      finalCost: this.costs[this.costs.length - 1],
      costs: [...this.costs],
      labels: [...labels]
    });
    
    console.log(`t-SNE completed. ${this.snapshots.length} steps captured.`);
    return this.snapshots;
  }
  
  /**
   * Get minimum non-zero distance
   */
  _getMinNonZeroDist() {
    let min = Infinity;
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        if (i !== j && this.distanceMatrix[i][j] < min) {
          min = this.distanceMatrix[i][j];
        }
      }
    }
    return min;
  }
  
  /**
   * Get maximum distance
   */
  _getMaxDist() {
    let max = 0;
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        if (this.distanceMatrix[i][j] > max) {
          max = this.distanceMatrix[i][j];
        }
      }
    }
    return max;
  }
  
  /**
   * Get average distance
   */
  _getAvgDist() {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) {
        sum += this.distanceMatrix[i][j];
        count++;
      }
    }
    return sum / count;
  }
  
  /**
   * Compute all sigma values with search history
   */
  _computeAllSigmas() {
    const sigmas = [];
    const searchHistory = [];
    
    for (let i = 0; i < this.n; i++) {
      const result = findSigma(this.distanceMatrix, i, this.perplexity, true);
      sigmas.push(result.sigma);
      if (i < 3) { // Only store first few for visualization
        searchHistory.push({
          pointIndex: i,
          history: result.history
        });
      }
    }
    
    return { sigmas, searchHistory };
  }
  
  /**
   * Compute conditional probability matrix P(j|i)
   */
  _computeConditionalP() {
    const P = Array(this.n).fill(null).map(() => Array(this.n).fill(0));
    
    for (let i = 0; i < this.n; i++) {
      const sigma = this.sigmas[i];
      const sigma2 = 2 * sigma * sigma;
      
      let sum = 0;
      for (let j = 0; j < this.n; j++) {
        if (i !== j) {
          const dist = this.distanceMatrix[i][j];
          P[i][j] = Math.exp(-dist * dist / sigma2);
          sum += P[i][j];
        }
      }
      
      // Normalize
      if (sum > 0) {
        for (let j = 0; j < this.n; j++) {
          P[i][j] /= sum;
        }
      }
    }
    
    return P;
  }
  
  /**
   * Get example P row for a single point
   */
  _getExamplePRow(pointIndex) {
    return {
      pointIndex,
      probabilities: [...this.P_conditional[pointIndex]],
      sigma: this.sigmas[pointIndex]
    };
  }
  
  /**
   * Symmetrize P matrix: P_ij = (P(j|i) + P(i|j)) / 2n
   */
  _symmetrizeP() {
    const P = Array(this.n).fill(null).map(() => Array(this.n).fill(0));
    
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) {
        const pij = (this.P_conditional[i][j] + this.P_conditional[j][i]) / (2 * this.n);
        P[i][j] = pij;
        P[j][i] = pij;
      }
    }
    
    // Ensure minimum probability
    const minP = 1e-12;
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        P[i][j] = Math.max(P[i][j], minP);
      }
    }
    
    return P;
  }
  
  /**
   * Apply early exaggeration
   */
  _applyEarlyExaggeration() {
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        this.P[i][j] *= this.earlyExaggeration;
      }
    }
  }
  
  /**
   * Remove early exaggeration
   */
  _removeEarlyExaggeration() {
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        this.P[i][j] = this.P_original[i][j];
      }
    }
  }
  
  /**
   * Initialize embedding with small random values
   */
  _initializeEmbedding() {
    const scale = 0.0001;
    return Array(this.n).fill(null).map(() =>
      Array(this.targetDim).fill(0).map(() => gaussianRandom() * scale)
    );
  }
  
  /**
   * Update embedding positions
   */
  _updateEmbedding(iteration) {
    const mom = iteration < this.momentumSwitchIter ? this.momentum : this.finalMomentum;
    
    for (let i = 0; i < this.n; i++) {
      for (let d = 0; d < this.targetDim; d++) {
        this.velocity[i][d] = mom * this.velocity[i][d] - this.learningRate * this.gradient[i][d];
        this.embedding[i][d] += this.velocity[i][d];
      }
    }
    
    // Center embedding
    for (let d = 0; d < this.targetDim; d++) {
      let mean = 0;
      for (let i = 0; i < this.n; i++) {
        mean += this.embedding[i][d];
      }
      mean /= this.n;
      for (let i = 0; i < this.n; i++) {
        this.embedding[i][d] -= mean;
      }
    }
  }
  
  /**
   * Run optimization iterations
   */
  _runIterations() {
    const keyIterations = [];
    const captureIterations = [0, 5, 10, 25, 50, 75, 100, 150, 200, 300, 400, this.maxIterations - 1];
    
    this.iterationSnapshots = [];
    
    for (let iter = 1; iter < this.maxIterations; iter++) {
      // Remove exaggeration at the right time
      if (iter === this.earlyExaggerationIter) {
        this._removeEarlyExaggeration();
      }
      
      // Compute Q and gradient
      this.Q = computeQMatrix(this.embedding);
      this.gradient = computeGradient(this.P, this.Q, this.embedding);
      
      // Update embedding
      this._updateEmbedding(iter);
      
      // Compute cost
      const cost = klDivergence(this.P, this.Q);
      this.costs.push(cost);
      
      // Capture key iterations
      if (captureIterations.includes(iter)) {
        const snapshot = {
          iteration: iter,
          embedding: deepClone(this.embedding),
          Q: deepClone(this.Q),
          gradient: deepClone(this.gradient),
          cost
        };
        keyIterations.push(snapshot);
        this.iterationSnapshots.push(snapshot);
      }
    }
    
    return keyIterations;
  }
  
  /**
   * Add a snapshot to the collection
   */
  _addSnapshot(stepType, data) {
    this.snapshots.push({
      stepId: this.stepIndex++,
      stepType,
      info: StepInfo[stepType],
      data,
      labels: [...(this.labels || [])],
      inputData: this.inputData ? deepClone(this.inputData) : null
    });
  }
  
  /**
   * Get all snapshots
   */
  getSnapshots() {
    return this.snapshots;
  }
  
  /**
   * Get snapshot by step type
   */
  getSnapshotByType(stepType) {
    return this.snapshots.find(s => s.stepType === stepType);
  }
  
  /**
   * Get snapshot by index
   */
  getSnapshotByIndex(index) {
    return this.snapshots[index];
  }
}

/**
 * Precompute t-SNE for a dataset
 * @param {number[][]} points - 3D input points
 * @param {number[]} labels - Point labels
 * @param {object} options - t-SNE options
 * @returns {object} { snapshots, tsne }
 */
export function precomputeTSNE(points, labels, options = {}) {
  const tsne = new PrecomputedTSNE({
    perplexity: Math.min(options.perplexity || 15, Math.floor((points.length - 1) / 3)),
    learningRate: options.learningRate || 200,
    maxIterations: options.maxIterations || 500,
    targetDim: options.targetDim || 2,
    earlyExaggeration: options.earlyExaggeration || 4,
    earlyExaggerationIter: options.earlyExaggerationIter || 100
  });
  
  const snapshots = tsne.run(points, labels);
  
  return { snapshots, tsne };
}
