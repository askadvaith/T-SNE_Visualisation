/**
 * Step-by-Step t-SNE Implementation
 * Exposes each algorithm phase for visualization purposes
 */

import {
  computeDistanceMatrix,
  findSigma,
  computeConditionalProbabilities,
  computeQMatrix,
  klDivergence,
  computeGradient,
  initializeEmbedding,
  clone2D,
  gradientMagnitude
} from './math-utils.js';

/**
 * t-SNE Algorithm Steps Enum
 */
export const TSNESteps = {
  INIT: 'init',
  COMPUTE_DISTANCES: 'compute_distances',
  COMPUTE_SIGMAS: 'compute_sigmas',
  COMPUTE_P_CONDITIONAL: 'compute_p_conditional',
  SYMMETRIZE_P: 'symmetrize_p',
  APPLY_EARLY_EXAGGERATION: 'apply_early_exaggeration',
  INITIALIZE_EMBEDDING: 'initialize_embedding',
  COMPUTE_Q: 'compute_q',
  COMPUTE_GRADIENT: 'compute_gradient',
  UPDATE_EMBEDDING: 'update_embedding',
  REMOVE_EXAGGERATION: 'remove_exaggeration',
  COMPLETE: 'complete'
};

/**
 * Step descriptions and formulas for UI display
 */
export const StepInfo = {
  [TSNESteps.INIT]: {
    title: 'Initialize',
    description: 'Set up the t-SNE algorithm with input data and parameters. We start with N points in high-dimensional space and aim to find a low-dimensional representation that preserves local structure.',
    formula: null,
    intuition: 'Think of this as preparing to compress a complex map into a simpler one while keeping nearby cities close together.'
  },
  [TSNESteps.COMPUTE_DISTANCES]: {
    title: 'Compute Pairwise Distances',
    description: 'Calculate the squared Euclidean distance between every pair of points in the high-dimensional space.',
    formula: 'D_{ij} = \\|x_i - x_j\\|^2 = \\sum_{d=1}^{D}(x_{i,d} - x_{j,d})^2',
    intuition: 'Measure how far apart each pair of points is. Closer points will have stronger connections.'
  },
  [TSNESteps.COMPUTE_SIGMAS]: {
    title: 'Find Bandwidth (σ) for Each Point',
    description: 'Use binary search to find the σᵢ for each point that achieves the target perplexity. Perplexity controls the effective number of neighbors.',
    formula: 'Perp(P_i) = 2^{H(P_i)} = 2^{-\\sum_j p_{j|i} \\log_2 p_{j|i}}',
    intuition: 'Dense regions get smaller σ (focus on nearby points), sparse regions get larger σ (look further for neighbors). This makes t-SNE adaptive to local density.'
  },
  [TSNESteps.COMPUTE_P_CONDITIONAL]: {
    title: 'Compute Conditional Probabilities',
    description: 'Convert distances to probabilities using a Gaussian kernel centered on each point. p(j|i) represents the probability that point i would pick point j as a neighbor.',
    formula: 'p_{j|i} = \\frac{\\exp(-\\|x_i - x_j\\|^2 / 2\\sigma_i^2)}{\\sum_{k \\neq i} \\exp(-\\|x_i - x_k\\|^2 / 2\\sigma_i^2)}',
    intuition: 'Transform raw distances into "similarity scores" that sum to 1. Nearby points get high probability, distant points get low probability.'
  },
  [TSNESteps.SYMMETRIZE_P]: {
    title: 'Symmetrize Probabilities',
    description: 'Average the conditional probabilities to create symmetric joint probabilities. This ensures the similarity between i and j equals the similarity between j and i.',
    formula: 'p_{ij} = \\frac{p_{j|i} + p_{i|j}}{2N}',
    intuition: 'If A thinks B is a close neighbor, but B doesn\'t think A is close, we compromise by averaging their opinions.'
  },
  [TSNESteps.APPLY_EARLY_EXAGGERATION]: {
    title: 'Apply Early Exaggeration',
    description: 'Multiply all P values by an exaggeration factor (typically 4-12). This creates stronger attractive forces early on, helping clusters form more quickly.',
    formula: 'p_{ij}^{exag} = \\alpha \\cdot p_{ij}',
    intuition: 'Temporarily amplify the "pull" between similar points so they rush together quickly, forming initial cluster structures.'
  },
  [TSNESteps.INITIALIZE_EMBEDDING]: {
    title: 'Initialize Low-Dimensional Embedding',
    description: 'Place all points at random positions in the low-dimensional space. Positions are sampled from a tiny Gaussian distribution near the origin.',
    formula: 'y_i \\sim \\mathcal{N}(0, 10^{-4})',
    intuition: 'Start with all points clustered near zero. The optimization will spread them out while preserving similarities.'
  },
  [TSNESteps.COMPUTE_Q]: {
    title: 'Compute Low-Dimensional Similarities (Q)',
    description: 'Compute similarities in the low-dimensional space using a Student\'s t-distribution (with 1 degree of freedom). The heavy tails allow moderate distances in the embedding to model small distances in the original space.',
    formula: 'q_{ij} = \\frac{(1 + \\|y_i - y_j\\|^2)^{-1}}{\\sum_{k \\neq l}(1 + \\|y_k - y_l\\|^2)^{-1}}',
    intuition: 'The t-distribution\'s heavy tails prevent the "crowding problem"—it allows dissimilar points to be placed farther apart without penalty.'
  },
  [TSNESteps.COMPUTE_GRADIENT]: {
    title: 'Compute Gradient (Forces)',
    description: 'Calculate the gradient of the KL divergence with respect to each point\'s position. The gradient has attractive terms (from P) and repulsive terms (from Q).',
    formula: '\\frac{\\partial C}{\\partial y_i} = 4\\sum_j (p_{ij} - q_{ij})(y_i - y_j)(1 + \\|y_i - y_j\\|^2)^{-1}',
    intuition: 'Each point feels forces: pulled toward points it should be near (high pᵢⱼ), pushed away from points it should be far from (high qᵢⱼ).'
  },
  [TSNESteps.UPDATE_EMBEDDING]: {
    title: 'Update Positions (Gradient Descent)',
    description: 'Move each point in the direction that reduces the cost function. Uses momentum to accelerate convergence and avoid local minima.',
    formula: 'y_i^{(t)} = y_i^{(t-1)} - \\eta \\frac{\\partial C}{\\partial y_i} + \\alpha(y_i^{(t-1)} - y_i^{(t-2)})',
    intuition: 'Like a ball rolling downhill with momentum. Points gradually settle into positions that best preserve the high-dimensional neighborhood structure.'
  },
  [TSNESteps.REMOVE_EXAGGERATION]: {
    title: 'Remove Early Exaggeration',
    description: 'After initial iterations (typically ~250), remove the exaggeration factor to allow fine-tuning of the embedding.',
    formula: 'p_{ij} = p_{ij}^{exag} / \\alpha',
    intuition: 'Switch from "rough sketching" to "fine detailing". Clusters are formed, now we refine the exact positions.'
  },
  [TSNESteps.COMPLETE]: {
    title: 'Optimization Complete',
    description: 'The algorithm has converged or reached the maximum number of iterations. The final embedding preserves local neighborhood structure from the original high-dimensional data.',
    formula: 'C = KL(P \\| Q) = \\sum_{i \\neq j} p_{ij} \\log\\frac{p_{ij}}{q_{ij}}',
    intuition: 'The final positions represent a 2D/1D "map" where points that were close in the original space remain close, revealing clusters and structure.'
  }
};

/**
 * t-SNE class with step-by-step execution
 */
export class TSNE {
  constructor(options = {}) {
    this.perplexity = options.perplexity ?? 30;
    this.learningRate = options.learningRate ?? 200;
    this.momentum = options.momentum ?? 0.8;
    this.earlyExaggeration = options.earlyExaggeration ?? 4;
    this.exaggerationIter = options.exaggerationIter ?? 250;
    this.maxIter = options.maxIter ?? 1000;
    this.targetDim = options.targetDim ?? 2;
    
    this.reset();
  }
  
  /**
   * Reset the algorithm state
   */
  reset() {
    this.X = null;           // Input data
    this.n = 0;              // Number of points
    this.inputDim = 0;       // Input dimensionality
    this.D = null;           // Distance matrix
    this.sigmas = [];        // Per-point bandwidths
    this.sigmaSearchSteps = []; // Binary search history for each point
    this.Pcond = null;       // Conditional probabilities
    this.P = null;           // Joint probabilities
    this.Porig = null;       // Original P (before exaggeration)
    this.Y = null;           // Current embedding
    this.Yprev = null;       // Previous embedding (for momentum)
    this.Q = null;           // Low-dim similarities
    this.Qunnorm = null;     // Unnormalized Q values
    this.gradient = null;    // Current gradient
    this.iteration = 0;
    this.currentStep = TSNESteps.INIT;
    this.costHistory = [];
    this.exaggerationActive = false;
    this.embedHistory = [];  // History of embeddings for animation
    this.currentPointIndex = 0; // For step-through visualization
  }
  
  /**
   * Set input data
   * @param {number[][]} X - Input data (N x D)
   */
  setData(X) {
    this.X = X;
    this.n = X.length;
    this.inputDim = X[0].length;
    this.currentStep = TSNESteps.INIT;
  }
  
  /**
   * Get current state for visualization
   */
  getState() {
    return {
      step: this.currentStep,
      stepInfo: StepInfo[this.currentStep],
      iteration: this.iteration,
      n: this.n,
      inputDim: this.inputDim,
      targetDim: this.targetDim,
      X: this.X,
      D: this.D,
      sigmas: this.sigmas,
      sigmaSearchSteps: this.sigmaSearchSteps,
      Pcond: this.Pcond,
      P: this.P,
      Y: this.Y,
      Q: this.Q,
      Qunnorm: this.Qunnorm,
      gradient: this.gradient,
      costHistory: this.costHistory,
      exaggerationActive: this.exaggerationActive,
      currentPointIndex: this.currentPointIndex,
      // Parameters
      perplexity: this.perplexity,
      learningRate: this.learningRate,
      earlyExaggeration: this.earlyExaggeration,
      maxIter: this.maxIter
    };
  }
  
  /**
   * Execute the next step of the algorithm
   * @returns {object} Current state after step
   */
  nextStep() {
    switch (this.currentStep) {
      case TSNESteps.INIT:
        this.currentStep = TSNESteps.COMPUTE_DISTANCES;
        break;
        
      case TSNESteps.COMPUTE_DISTANCES:
        this.D = computeDistanceMatrix(this.X);
        this.currentStep = TSNESteps.COMPUTE_SIGMAS;
        this.currentPointIndex = 0;
        break;
        
      case TSNESteps.COMPUTE_SIGMAS:
        this._computeSigmas();
        this.currentStep = TSNESteps.COMPUTE_P_CONDITIONAL;
        break;
        
      case TSNESteps.COMPUTE_P_CONDITIONAL:
        this._computeConditionalP();
        this.currentStep = TSNESteps.SYMMETRIZE_P;
        break;
        
      case TSNESteps.SYMMETRIZE_P:
        this._symmetrizeP();
        this.currentStep = TSNESteps.APPLY_EARLY_EXAGGERATION;
        break;
        
      case TSNESteps.APPLY_EARLY_EXAGGERATION:
        this._applyExaggeration();
        this.currentStep = TSNESteps.INITIALIZE_EMBEDDING;
        break;
        
      case TSNESteps.INITIALIZE_EMBEDDING:
        this._initializeEmbedding();
        this.currentStep = TSNESteps.COMPUTE_Q;
        break;
        
      case TSNESteps.COMPUTE_Q:
        this._computeQ();
        this.currentStep = TSNESteps.COMPUTE_GRADIENT;
        break;
        
      case TSNESteps.COMPUTE_GRADIENT:
        this._computeGradient();
        this.currentStep = TSNESteps.UPDATE_EMBEDDING;
        break;
        
      case TSNESteps.UPDATE_EMBEDDING:
        this._updateEmbedding();
        this.iteration++;
        
        // Check if we should remove exaggeration
        if (this.exaggerationActive && this.iteration >= this.exaggerationIter) {
          this.currentStep = TSNESteps.REMOVE_EXAGGERATION;
        } else if (this.iteration >= this.maxIter) {
          this.currentStep = TSNESteps.COMPLETE;
        } else {
          this.currentStep = TSNESteps.COMPUTE_Q;
        }
        break;
        
      case TSNESteps.REMOVE_EXAGGERATION:
        this._removeExaggeration();
        if (this.iteration >= this.maxIter) {
          this.currentStep = TSNESteps.COMPLETE;
        } else {
          this.currentStep = TSNESteps.COMPUTE_Q;
        }
        break;
        
      case TSNESteps.COMPLETE:
        // Already complete, do nothing
        break;
    }
    
    return this.getState();
  }
  
  /**
   * Run multiple iterations at once
   * @param {number} numIter - Number of iterations to run
   * @returns {object} Current state
   */
  runIterations(numIter) {
    // First ensure we're past initialization
    while (this.currentStep !== TSNESteps.COMPUTE_Q && 
           this.currentStep !== TSNESteps.COMPLETE) {
      this.nextStep();
    }
    
    // Run optimization iterations
    for (let i = 0; i < numIter && this.currentStep !== TSNESteps.COMPLETE; i++) {
      // Full iteration cycle
      if (this.currentStep === TSNESteps.COMPUTE_Q) {
        this.nextStep(); // COMPUTE_Q
        this.nextStep(); // COMPUTE_GRADIENT
        this.nextStep(); // UPDATE_EMBEDDING
        
        // Handle exaggeration removal if needed
        if (this.currentStep === TSNESteps.REMOVE_EXAGGERATION) {
          this.nextStep();
        }
      }
    }
    
    return this.getState();
  }
  
  /**
   * Run until complete
   * @returns {object} Final state
   */
  runToCompletion() {
    while (this.currentStep !== TSNESteps.COMPLETE) {
      this.nextStep();
    }
    return this.getState();
  }
  
  // Private methods for each step
  
  _computeSigmas() {
    this.sigmas = [];
    this.sigmaSearchSteps = [];
    
    for (let i = 0; i < this.n; i++) {
      const result = findSigma(this.D[i], this.perplexity, i);
      this.sigmas.push(result.sigma);
      this.sigmaSearchSteps.push(result.searchSteps);
    }
  }
  
  _computeConditionalP() {
    this.Pcond = Array(this.n).fill(null).map(() => Array(this.n).fill(0));
    
    for (let i = 0; i < this.n; i++) {
      const P = computeConditionalProbabilities(this.D[i], this.sigmas[i], i);
      for (let j = 0; j < this.n; j++) {
        this.Pcond[i][j] = P[j];
      }
    }
  }
  
  _symmetrizeP() {
    this.P = Array(this.n).fill(null).map(() => Array(this.n).fill(0));
    
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) {
        const pij = (this.Pcond[i][j] + this.Pcond[j][i]) / (2 * this.n);
        this.P[i][j] = pij;
        this.P[j][i] = pij;
      }
    }
    
    // Store original for later
    this.Porig = clone2D(this.P);
  }
  
  _applyExaggeration() {
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        this.P[i][j] *= this.earlyExaggeration;
      }
    }
    this.exaggerationActive = true;
  }
  
  _removeExaggeration() {
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        this.P[i][j] /= this.earlyExaggeration;
      }
    }
    this.exaggerationActive = false;
  }
  
  _initializeEmbedding() {
    this.Y = initializeEmbedding(this.n, this.targetDim);
    this.Yprev = clone2D(this.Y);
    this.embedHistory.push(clone2D(this.Y));
  }
  
  _computeQ() {
    const result = computeQMatrix(this.Y);
    this.Q = result.Q;
    this.Qunnorm = result.Qunnorm;
    
    // Compute and store cost
    const cost = klDivergence(this.P, this.Q);
    this.costHistory.push({ iteration: this.iteration, cost });
  }
  
  _computeGradient() {
    this.gradient = computeGradient(this.Y, this.P, this.Q, this.Qunnorm);
  }
  
  _updateEmbedding() {
    const Ynew = Array(this.n).fill(null).map(() => Array(this.targetDim).fill(0));
    
    for (let i = 0; i < this.n; i++) {
      for (let d = 0; d < this.targetDim; d++) {
        // Gradient descent with momentum
        const gradStep = this.learningRate * this.gradient[i][d];
        const momentumStep = this.momentum * (this.Y[i][d] - this.Yprev[i][d]);
        Ynew[i][d] = this.Y[i][d] - gradStep + momentumStep;
      }
    }
    
    this.Yprev = clone2D(this.Y);
    this.Y = Ynew;
    
    // Store every 10th embedding for animation
    if (this.iteration % 10 === 0) {
      this.embedHistory.push(clone2D(this.Y));
    }
  }
  
  /**
   * Get gradient information for a specific point
   * @param {number} i - Point index
   * @returns {object} Gradient details for visualization
   */
  getPointGradientDetails(i) {
    if (!this.gradient || !this.P || !this.Q) return null;
    
    const details = {
      pointIndex: i,
      gradientVector: this.gradient[i],
      magnitude: gradientMagnitude(this.gradient[i]),
      attractiveForces: [],
      repulsiveForces: []
    };
    
    for (let j = 0; j < this.n; j++) {
      if (i !== j) {
        const pij = this.P[i][j];
        const qij = this.Q[i][j];
        const diff = pij - qij;
        
        if (diff > 0) {
          details.attractiveForces.push({ j, pij, qij, force: diff });
        } else {
          details.repulsiveForces.push({ j, pij, qij, force: -diff });
        }
      }
    }
    
    // Sort by force magnitude
    details.attractiveForces.sort((a, b) => b.force - a.force);
    details.repulsiveForces.sort((a, b) => b.force - a.force);
    
    return details;
  }
}
