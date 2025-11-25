/**
 * Data Generator for t-SNE Visualization
 * Creates synthetic 3D datasets for demonstrating t-SNE dimensionality reduction
 */

/**
 * Box-Muller transform for Gaussian random numbers
 * @returns {number} Random number from N(0, 1)
 */
function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Seeded random number generator for reproducible datasets
 */
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed;
  }
  
  next() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  gaussian() {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

/**
 * Generate 3D Gaussian blobs (clusters)
 * @param {object} options - Configuration options
 * @returns {{points: number[][], labels: number[], centers: number[][]}}
 */
export function generate3DBlobs(options = {}) {
  const {
    numClusters = 3,
    pointsPerCluster = 15,
    clusterSpread = 0.5,
    clusterSeparation = 4,
    seed = null
  } = options;
  
  const rng = seed ? new SeededRandom(seed) : null;
  const rand = () => rng ? rng.gaussian() : gaussianRandom();
  
  const points = [];
  const labels = [];
  const centers = [];
  
  // Generate cluster centers in 3D space
  // Use spherical distribution for better separation
  for (let c = 0; c < numClusters; c++) {
    const phi = (2 * Math.PI * c) / numClusters;
    const theta = Math.PI * (0.3 + 0.4 * (c % 2)); // Alternate between upper and lower hemisphere
    
    const x = clusterSeparation * Math.sin(theta) * Math.cos(phi);
    const y = clusterSeparation * Math.sin(theta) * Math.sin(phi);
    const z = clusterSeparation * Math.cos(theta) * (c % 2 === 0 ? 1 : -0.5);
    
    centers.push([x, y, z]);
  }
  
  // Generate points around each center
  for (let c = 0; c < numClusters; c++) {
    for (let p = 0; p < pointsPerCluster; p++) {
      const point = [
        centers[c][0] + rand() * clusterSpread,
        centers[c][1] + rand() * clusterSpread,
        centers[c][2] + rand() * clusterSpread
      ];
      points.push(point);
      labels.push(c);
    }
  }
  
  return { points, labels, centers };
}

/**
 * Generate 3D Swiss Roll dataset
 * @param {object} options - Configuration options
 * @returns {{points: number[][], labels: number[]}}
 */
export function generate3DSwissRoll(options = {}) {
  const {
    numPoints = 50,
    noise = 0.3,
    seed = null
  } = options;
  
  const rng = seed ? new SeededRandom(seed) : null;
  const rand = () => rng ? rng.next() : Math.random();
  const randGauss = () => rng ? rng.gaussian() : gaussianRandom();
  
  const points = [];
  const labels = [];
  
  for (let i = 0; i < numPoints; i++) {
    const t = 1.5 * Math.PI * (1 + 2 * rand());
    const x = t * Math.cos(t) + randGauss() * noise;
    const y = 10 * rand() + randGauss() * noise;
    const z = t * Math.sin(t) + randGauss() * noise;
    
    points.push([x / 5, y / 5, z / 5]); // Scale down
    labels.push(Math.floor(t / (Math.PI * 1.5))); // Color by angle
  }
  
  return { points, labels };
}

/**
 * Generate 3D helix (spiral) dataset
 * @param {object} options - Configuration options
 * @returns {{points: number[][], labels: number[]}}
 */
export function generate3DHelix(options = {}) {
  const {
    numPoints = 50,
    numTurns = 2,
    noise = 0.1,
    seed = null
  } = options;
  
  const rng = seed ? new SeededRandom(seed) : null;
  const randGauss = () => rng ? rng.gaussian() : gaussianRandom();
  
  const points = [];
  const labels = [];
  const pointsPerHelix = Math.floor(numPoints / 2);
  
  // First helix
  for (let i = 0; i < pointsPerHelix; i++) {
    const t = (i / pointsPerHelix) * numTurns * 2 * Math.PI;
    const x = Math.cos(t) + randGauss() * noise;
    const y = t / (numTurns * Math.PI) + randGauss() * noise;
    const z = Math.sin(t) + randGauss() * noise;
    points.push([x, y, z]);
    labels.push(0);
  }
  
  // Second helix (offset)
  for (let i = 0; i < pointsPerHelix; i++) {
    const t = (i / pointsPerHelix) * numTurns * 2 * Math.PI + Math.PI;
    const x = Math.cos(t) + randGauss() * noise;
    const y = t / (numTurns * Math.PI) + randGauss() * noise;
    const z = Math.sin(t) + randGauss() * noise;
    points.push([x, y, z]);
    labels.push(1);
  }
  
  return { points, labels };
}

/**
 * Generate 3D layered clusters (stacked in Z)
 * @param {object} options - Configuration options
 * @returns {{points: number[][], labels: number[]}}
 */
export function generate3DLayers(options = {}) {
  const {
    numLayers = 3,
    pointsPerLayer = 15,
    layerSpread = 0.4,
    layerSeparation = 2,
    seed = null
  } = options;
  
  const rng = seed ? new SeededRandom(seed) : null;
  const randGauss = () => rng ? rng.gaussian() : gaussianRandom();
  
  const points = [];
  const labels = [];
  
  for (let layer = 0; layer < numLayers; layer++) {
    const zCenter = (layer - (numLayers - 1) / 2) * layerSeparation;
    
    for (let i = 0; i < pointsPerLayer; i++) {
      const angle = (2 * Math.PI * i) / pointsPerLayer;
      const radius = 1.5 + randGauss() * 0.2;
      
      const x = radius * Math.cos(angle) + randGauss() * layerSpread;
      const y = radius * Math.sin(angle) + randGauss() * layerSpread;
      const z = zCenter + randGauss() * layerSpread * 0.5;
      
      points.push([x, y, z]);
      labels.push(layer);
    }
  }
  
  return { points, labels };
}

/**
 * Get a preset dataset configuration
 * @param {string} preset - Preset name
 * @returns {object} Dataset configuration
 */
export function getPreset(preset) {
  const presets = {
    'simple-blobs': {
      generator: 'blobs',
      name: 'Simple Clusters',
      description: '3 well-separated clusters in 3D space',
      options: {
        numClusters: 3,
        pointsPerCluster: 16,
        clusterSpread: 0.5,
        clusterSeparation: 4
      }
    },
    'tight-clusters': {
      generator: 'blobs',
      name: 'Tight Clusters',
      description: '4 tightly packed clusters',
      options: {
        numClusters: 4,
        pointsPerCluster: 12,
        clusterSpread: 0.25,
        clusterSeparation: 5
      }
    },
    'overlapping': {
      generator: 'blobs',
      name: 'Overlapping Clusters',
      description: '3 clusters with some overlap',
      options: {
        numClusters: 3,
        pointsPerCluster: 16,
        clusterSpread: 1.0,
        clusterSeparation: 3
      }
    },
    'swiss-roll': {
      generator: 'swiss-roll',
      name: 'Swiss Roll',
      description: 'Classic manifold learning test case',
      options: {
        numPoints: 50,
        noise: 0.3
      }
    },
    'helix': {
      generator: 'helix',
      name: 'Double Helix',
      description: 'Two intertwined spirals',
      options: {
        numPoints: 50,
        numTurns: 2,
        noise: 0.1
      }
    },
    'layers': {
      generator: 'layers',
      name: 'Stacked Layers',
      description: '3 horizontal layers stacked vertically',
      options: {
        numLayers: 3,
        pointsPerLayer: 16,
        layerSpread: 0.4,
        layerSeparation: 2.5
      }
    }
  };
  
  return presets[preset] || presets['simple-blobs'];
}

/**
 * Generate dataset based on preset name or custom options
 * @param {string|object} config - Preset name or custom configuration
 * @param {object} overrides - Override options
 * @returns {{points: number[][], labels: number[], config: object}}
 */
export function generateDataset(config, overrides = {}) {
  let preset;
  
  if (typeof config === 'string') {
    preset = getPreset(config);
  } else {
    preset = config;
  }
  
  // Merge overrides
  const options = { ...preset.options, ...overrides };
  
  let result;
  switch (preset.generator) {
    case 'blobs':
      result = generate3DBlobs(options);
      break;
    case 'swiss-roll':
      result = generate3DSwissRoll(options);
      break;
    case 'helix':
      result = generate3DHelix(options);
      break;
    case 'layers':
      result = generate3DLayers(options);
      break;
    default:
      result = generate3DBlobs(options);
  }
  
  return { ...result, config: preset };
}

/**
 * Get list of available presets
 * @returns {object[]} Preset info
 */
export function getAvailablePresets() {
  return [
    { id: 'simple-blobs', name: 'Simple Clusters' },
    { id: 'tight-clusters', name: 'Tight Clusters' },
    { id: 'overlapping', name: 'Overlapping' },
    { id: 'swiss-roll', name: 'Swiss Roll' },
    { id: 'helix', name: 'Double Helix' },
    { id: 'layers', name: 'Stacked Layers' }
  ];
}

/**
 * Get color for a label index
 * @param {number} label - Label index
 * @returns {string} Color hex string
 */
export function getLabelColor(label) {
  const colors = [
    '#e41a1c', // red
    '#377eb8', // blue
    '#4daf4a', // green
    '#984ea3', // purple
    '#ff7f00', // orange
    '#a65628', // brown
    '#f781bf', // pink
    '#999999'  // gray
  ];
  return colors[label % colors.length];
}

/**
 * Generate the default precomputed dataset
 * Uses a fixed seed for reproducibility - 50 points for quick exploration
 * @returns {{points: number[][], labels: number[]}}
 */
export function generateDefaultDataset() {
  return generate3DBlobs({
    numClusters: 3,
    pointsPerCluster: 16, // ~50 points total
    clusterSpread: 0.5,
    clusterSeparation: 4,
    seed: 42 // Fixed seed for reproducibility
  });
}

/**
 * Generate dataset for user-triggered generation
 * 500 points for more detailed visualization
 * @param {string} preset - Preset name
 * @param {object} overrides - Override options
 * @returns {{points: number[][], labels: number[], config: object}}
 */
export function generateLargeDataset(preset, overrides = {}) {
  const presetConfig = getPreset(preset);
  
  // Override to get ~500 points
  let options = { ...presetConfig.options, ...overrides };
  
  if (presetConfig.generator === 'blobs') {
    options.numClusters = options.numClusters || 5;
    options.pointsPerCluster = 100; // 500 points total
  } else if (presetConfig.generator === 'swiss-roll' || presetConfig.generator === 'helix') {
    options.numPoints = 500;
  } else if (presetConfig.generator === 'layers') {
    options.numLayers = options.numLayers || 5;
    options.pointsPerLayer = 100; // 500 points total
  }
  
  return generateDataset({ ...presetConfig, options }, {});
}
