/**
 * t-SNE Step-by-Step Visualizer
 * Main Application - Pre-computed results with leisurely exploration
 */

import './styles/main.css';

// Core
import { generateDataset, generateLargeDataset, getAvailablePresets, getLabelColor, generateDefaultDataset } from './core/data-generator.js';
import { precomputeTSNE, TSNESteps, StepInfo } from './core/precomputed-tsne.js';

// Visualizations
import { Scatter2D, NumberLine1D } from './visualizations/scatter-2d.js';
import { Scatter3D } from './visualizations/scatter-3d.js';
import { Heatmap, MatrixComparison } from './visualizations/heatmap.js';
import { GaussianDistribution, DistributionComparison, SigmaSearchViz } from './visualizations/distribution.js';
import { GradientField, CostChart } from './visualizations/gradient-field.js';

// Formula display
import { FormulaDisplay } from './ui/formula-display.js';

/**
 * Main Application Class
 */
class TSNEVisualizer {
  constructor() {
    // State
    this.snapshots = null;
    this.currentStepIndex = 0;
    this.currentMode = '3d-2d'; // Default: 3D → 2D
    this.isComputing = false;
    this.selectedPointIndex = 0;
    
    // Settings
    this.settings = {
      preset: 'simple-blobs',
      perplexity: 30,
      learningRate: 200,
      maxIterations: 500
    };
    
    // Visualization objects
    this.visualizations = {};
    this.scatter3D = null; // 3D scatter plot reference
    
    // Initialize
    this._initUI();
    this._loadDefaultDataset();
  }
  
  /**
   * Initialize UI elements
   */
  _initUI() {
    // Mode toggle buttons
    this._setupModeButtons();
    
    // Dataset controls
    this._setupDatasetControls();
    
    // Navigation
    this._setupNavigation();
    
    // Point selector
    this._setupPointSelector();
    
    // Initialize formula display
    this.formulaDisplay = new FormulaDisplay('#formula-display');
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        this._nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this._prevStep();
      }
    });
  }
  
  /**
   * Setup mode toggle (3D→2D vs 3D→1D)
   */
  _setupModeButtons() {
    const container = document.getElementById('mode-buttons');
    if (!container) return;
    
    container.innerHTML = `
      <button class="mode-btn active" data-mode="3d-2d">3D → 2D</button>
      <button class="mode-btn" data-mode="3d-1d">3D → 1D</button>
    `;
    
    container.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMode = btn.dataset.mode;
        
        // Re-compute if we have data
        if (this.snapshots) {
          this._recompute();
        }
      });
    });
  }
  
  /**
   * Setup dataset controls
   */
  _setupDatasetControls() {
    // Preset selector
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect) {
      const presets = getAvailablePresets();
      presetSelect.innerHTML = presets.map(p => 
        `<option value="${p.id}" ${p.id === this.settings.preset ? 'selected' : ''}>${p.name}</option>`
      ).join('');
      
      presetSelect.addEventListener('change', () => {
        this.settings.preset = presetSelect.value;
      });
    }
    
    // Perplexity slider
    const perplexitySlider = document.getElementById('perplexity-slider');
    const perplexityValue = document.getElementById('perplexity-value');
    if (perplexitySlider) {
      perplexitySlider.value = this.settings.perplexity;
      perplexityValue.textContent = this.settings.perplexity;
      
      perplexitySlider.addEventListener('input', () => {
        this.settings.perplexity = parseInt(perplexitySlider.value);
        perplexityValue.textContent = this.settings.perplexity;
      });
    }
    
    // Learning rate slider
    const lrSlider = document.getElementById('lr-slider');
    const lrValue = document.getElementById('lr-value');
    if (lrSlider) {
      lrSlider.value = this.settings.learningRate;
      lrValue.textContent = this.settings.learningRate;
      
      lrSlider.addEventListener('input', () => {
        this.settings.learningRate = parseInt(lrSlider.value);
        lrValue.textContent = this.settings.learningRate;
      });
    }
    
    // Iterations slider
    const iterSlider = document.getElementById('iterations-slider');
    const iterValue = document.getElementById('iterations-value');
    if (iterSlider) {
      iterSlider.value = this.settings.maxIterations;
      iterValue.textContent = this.settings.maxIterations;
      
      iterSlider.addEventListener('input', () => {
        this.settings.maxIterations = parseInt(iterSlider.value);
        iterValue.textContent = this.settings.maxIterations;
      });
    }
    
    // Generate button
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this._generateAndCompute());
    }
  }
  
  /**
   * Setup step navigation
   */
  _setupNavigation() {
    const prevBtn = document.getElementById('prev-step-btn');
    const nextBtn = document.getElementById('next-step-btn');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this._prevStep());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this._nextStep());
    }
  }
  
  /**
   * Setup point selector for detailed view
   */
  _setupPointSelector() {
    const selector = document.getElementById('point-selector');
    if (!selector) return;
    
    selector.addEventListener('change', () => {
      this.selectedPointIndex = parseInt(selector.value);
      this._updateCurrentStep();
    });
  }
  
  /**
   * Load default precomputed dataset
   */
  _loadDefaultDataset() {
    this._showLoading(true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const { points, labels } = generateDefaultDataset();
      this._runTSNE(points, labels);
    }, 100);
  }
  
  /**
   * Generate new dataset and compute t-SNE
   * Uses 500 points for user-generated datasets
   */
  _generateAndCompute() {
    this._showLoading(true);
    
    setTimeout(() => {
      const { points, labels } = generateLargeDataset(this.settings.preset);
      this._runTSNE(points, labels);
    }, 100);
  }
  
  /**
   * Recompute with same data but different mode
   */
  _recompute() {
    if (!this.snapshots || !this.snapshots[0]?.inputData) return;
    
    this._showLoading(true);
    
    setTimeout(() => {
      const inputSnapshot = this.snapshots.find(s => s.stepType === TSNESteps.INPUT_DATA);
      if (inputSnapshot) {
        this._runTSNE(inputSnapshot.data.points, inputSnapshot.labels);
      }
    }, 100);
  }
  
  /**
   * Run t-SNE and store results
   */
  _runTSNE(points, labels) {
    const targetDim = this.currentMode === '3d-1d' ? 1 : 2;
    
    const result = precomputeTSNE(points, labels, {
      perplexity: this.settings.perplexity,
      learningRate: this.settings.learningRate,
      maxIterations: this.settings.maxIterations,
      targetDim
    });
    
    this.snapshots = result.snapshots;
    this.currentStepIndex = 0;
    
    // Update point selector
    this._updatePointSelector(points.length);
    
    // Build step list
    this._buildStepList();
    
    // Show first step
    this._updateCurrentStep();
    
    this._showLoading(false);
  }
  
  /**
   * Update point selector dropdown
   */
  _updatePointSelector(numPoints) {
    const selector = document.getElementById('point-selector');
    if (!selector) return;
    
    const snapshot = this.snapshots?.find(s => s.stepType === TSNESteps.INPUT_DATA);
    const labels = snapshot?.labels || [];
    
    selector.innerHTML = Array.from({ length: numPoints }, (_, i) => 
      `<option value="${i}">Point ${i} (Cluster ${labels[i] ?? '?'})</option>`
    ).join('');
    
    this.selectedPointIndex = 0;
  }
  
  /**
   * Build the step list in the sidebar
   */
  _buildStepList() {
    const container = document.getElementById('step-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    this.snapshots.forEach((snapshot, index) => {
      const item = document.createElement('div');
      item.className = `step-item ${index === 0 ? 'active' : ''}`;
      item.dataset.index = index;
      
      const info = snapshot.info;
      item.innerHTML = `
        <div class="step-number">${index + 1}</div>
        <div class="step-content">
          <div class="step-title">${info.title}</div>
          <div class="step-desc">${info.shortDesc}</div>
        </div>
      `;
      
      item.addEventListener('click', () => {
        this.currentStepIndex = index;
        this._updateCurrentStep();
      });
      
      container.appendChild(item);
    });
  }
  
  /**
   * Navigate to previous step
   */
  _prevStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this._updateCurrentStep();
    }
  }
  
  /**
   * Navigate to next step
   */
  _nextStep() {
    if (this.currentStepIndex < this.snapshots.length - 1) {
      this.currentStepIndex++;
      this._updateCurrentStep();
    }
  }
  
  /**
   * Update display for current step
   */
  _updateCurrentStep() {
    if (!this.snapshots) return;
    
    const snapshot = this.snapshots[this.currentStepIndex];
    
    // Update step list highlighting
    document.querySelectorAll('.step-item').forEach((item, i) => {
      item.classList.toggle('active', i === this.currentStepIndex);
    });
    
    // Scroll active step into view
    const activeItem = document.querySelector('.step-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prev-step-btn');
    const nextBtn = document.getElementById('next-step-btn');
    if (prevBtn) prevBtn.disabled = this.currentStepIndex === 0;
    if (nextBtn) nextBtn.disabled = this.currentStepIndex === this.snapshots.length - 1;
    
    // Update step counter
    const counter = document.getElementById('step-counter');
    if (counter) {
      counter.textContent = `Step ${this.currentStepIndex + 1} of ${this.snapshots.length}`;
    }
    
    // Render step-specific content
    this._renderStep(snapshot);
  }
  
  /**
   * Render a specific step
   */
  _renderStep(snapshot) {
    const vizContainer = document.getElementById('visualization-area');
    const explanationContainer = document.getElementById('explanation-area');
    
    if (!vizContainer || !explanationContainer) return;
    
    // Clean up 3D scatter if we're not on input data step
    if (snapshot.stepType !== TSNESteps.INPUT_DATA && this.scatter3D) {
      this.scatter3D.dispose();
      this.scatter3D = null;
    }
    
    // Clear previous visualizations
    vizContainer.innerHTML = '';
    
    // Render based on step type
    switch (snapshot.stepType) {
      case TSNESteps.INTRO:
        this._renderIntro(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.INPUT_DATA:
        this._renderInputData(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.COMPUTE_DISTANCES:
        this._renderDistances(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.COMPUTE_SIGMAS:
        this._renderSigmas(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.COMPUTE_P_CONDITIONAL:
        this._renderPConditional(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.SYMMETRIZE_P:
        this._renderSymmetrize(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.EARLY_EXAGGERATION:
        this._renderExaggeration(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.INITIALIZE_EMBEDDING:
        this._renderInitEmbedding(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.COMPUTE_Q:
        this._renderComputeQ(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.COMPUTE_GRADIENT:
        this._renderGradient(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.UPDATE_EMBEDDING:
        this._renderUpdate(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.ITERATION_PROGRESS:
        this._renderIterations(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.REMOVE_EXAGGERATION:
        this._renderRemoveExaggeration(snapshot, vizContainer, explanationContainer);
        break;
      case TSNESteps.FINAL_RESULT:
        this._renderFinalResult(snapshot, vizContainer, explanationContainer);
        break;
    }
  }
  
  // ========== Step Renderers ==========
  
  _renderIntro(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    
    vizContainer.innerHTML = `
      <div class="intro-explanation">
        <h2>What is t-SNE?</h2>
        <p><strong>t-Distributed Stochastic Neighbour Embedding (t-SNE)</strong> is a technique for dimensionality reduction that preserves local structure. You can find a beautiful and succinct explanation of the theory behind it here: <a href="https://www.youtube.com/watch?v=NEaUSP4YerM" target="_blank" rel="noopener noreferrer">StatQuest t-SNE</a></p>
        
        <h3>The Goal</h3>
        <p>We have <strong>${data.n} points</strong> in <strong>${data.inputDim}D space</strong>. We want to place them in <strong>${data.targetDim}D space</strong> such that:</p>
        <ul>
          <li>Points that are <em>close</em> in high-D stay <em>close</em> in low-D</li>
          <li>Points that are <em>far</em> in high-D stay <em>far</em> in low-D</li>
        </ul>
        
        <h3>Key Idea</h3>
        <p>t-SNE converts <strong>distances</strong> into <strong>probabilities</strong>:</p>
        <ul>
          <li>High probability = points are neighbours</li>
          <li>Low probability = points are distant</li>
        </ul>
        <p>Then it tries to match these probabilities between high-D and low-D.</p>
        
        <h3>Perplexity: ${data.perplexity}</h3>
        <p>Perplexity roughly represents "number of effective neighbours". Higher values consider more neighbours.</p>
      </div>
    `;
    
    explanationContainer.innerHTML = `
      <div class="tip-box">
        <strong>💡 Getting Started:</strong> Use the <strong>Next →</strong> button or press the right arrow key to walk through each step of the t-SNE algorithm. You can also click on any step in the right panel to jump directly to it.
      </div>
    `;
    
    this.formulaDisplay.showFormula('overview', {});
  }
  
  _renderInputData(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    const i = this.selectedPointIndex;
    
    vizContainer.innerHTML = `
      <div class="viz-grid">
        <div class="viz-panel" id="input-3d-view">
          <h4>3D Input Data (Interactive - drag to rotate)</h4>
          <div id="input-scatter-3d"></div>
        </div>
        <div class="viz-panel" id="point-focus">
          <h4>Selected Point Details</h4>
          <div class="point-details">
            <div class="detail-row">
              <span class="detail-label">Point Index:</span>
              <span class="detail-value">${i}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Cluster:</span>
              <span class="detail-value" style="color: ${getLabelColor(labels[i])}">${labels[i]}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Coordinates:</span>
              <span class="detail-value">(${data.points[i].map(v => v.toFixed(2)).join(', ')})</span>
            </div>
          </div>
          <div id="cluster-legend"></div>
        </div>
      </div>
    `;
    
    // Create true 3D visualization
    // Dispose of previous 3D scatter if exists
    if (this.scatter3D) {
      this.scatter3D.dispose();
    }
    
    this.scatter3D = new Scatter3D('#input-scatter-3d', {
      width: 450,
      height: 380,
      onPointClick: (idx) => {
        this.selectedPointIndex = idx;
        document.getElementById('point-selector').value = idx;
        this._updateCurrentStep();
      }
    });
    
    this.scatter3D.update(data.points, labels);
    this.scatter3D.highlightPoint(i);
    
    // Cluster legend
    const clusterCounts = {};
    labels.forEach(l => { clusterCounts[l] = (clusterCounts[l] || 0) + 1; });
    
    document.getElementById('cluster-legend').innerHTML = `
      <h5>Clusters</h5>
      ${Object.entries(clusterCounts).map(([cluster, count]) => `
        <div class="legend-item">
          <span class="legend-color" style="background: ${getLabelColor(parseInt(cluster))}"></span>
          <span>Cluster ${cluster}: ${count} points</span>
        </div>
      `).join('')}
    `;
    
    explanationContainer.innerHTML = `
      <h2>Our Input Data</h2>
      <p>We're visualizing <strong>${data.n} points</strong> in <strong>3D space</strong>.</p>
      
      <h3>Interacting with the 3D View</h3>
      <p><strong>Drag</strong> to rotate, <strong>scroll</strong> to zoom, <strong>click</strong> on points to select them. Each color represents a different cluster.</p>
      
      <h3>Single Point Focus: Point ${i}</h3>
      <p>This point belongs to <strong style="color: ${getLabelColor(labels[i])}">Cluster ${labels[i]}</strong> and is located at:</p>
      <ul>
        <li>X = ${data.points[i][0].toFixed(3)}</li>
        <li>Y = ${data.points[i][1].toFixed(3)}</li>
        <li>Z = ${data.points[i][2].toFixed(3)}</li>
      </ul>
      
      <h3>Cluster Structure</h3>
      <p>The data contains ${Object.keys(clusterCounts).length} clusters. t-SNE should preserve these clusters in the final 2D/1D embedding.</p>
      
      <div class="tip-box">
        <strong>💡 Tip:</strong> Click on any point in the scatter plot to analyze it, or use the point selector above.
      </div>
    `;
    
    this.formulaDisplay.clear();
  }
  
  _renderDistances(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    const i = this.selectedPointIndex;
    
    vizContainer.innerHTML = `
      <div class="viz-grid">
        <div class="viz-panel">
          <h4>Distance Matrix</h4>
          <div id="distance-heatmap"></div>
        </div>
        <div class="viz-panel">
          <h4>Distances from Point ${i}</h4>
          <div id="distance-from-point"></div>
        </div>
      </div>
    `;
    
    // Distance heatmap
    const heatmap = new Heatmap('#distance-heatmap', {
      width: 350,
      height: 350,
      title: '',
      colorScheme: 'viridis'
    });
    heatmap.update(data.distanceMatrix, labels);
    heatmap.highlightRow(i);
    
    // Distances from selected point
    const distancesFromI = data.distanceMatrix[i]
      .map((d, j) => ({ j, distance: d, label: labels[j] }))
      .filter(d => d.j !== i)
      .sort((a, b) => a.distance - b.distance);
    
    const nearest = distancesFromI.slice(0, 5);
    const farthest = distancesFromI.slice(-3);
    
    document.getElementById('distance-from-point').innerHTML = `
      <div class="distance-list">
        <h5>Nearest neighbours</h5>
        ${nearest.map((d, rank) => `
          <div class="distance-item">
            <span class="rank">#${rank + 1}</span>
            <span class="point-badge" style="background: ${getLabelColor(d.label)}">Point ${d.j}</span>
            <span class="distance">${d.distance.toFixed(3)}</span>
          </div>
        `).join('')}
        
        <h5 style="margin-top: 15px;">Farthest Points</h5>
        ${farthest.reverse().map((d, rank) => `
          <div class="distance-item farthest">
            <span class="point-badge" style="background: ${getLabelColor(d.label)}">Point ${d.j}</span>
            <span class="distance">${d.distance.toFixed(3)}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="stats-box">
        <div class="stat">
          <span class="stat-label">Min Distance</span>
          <span class="stat-value">${data.minDist.toFixed(3)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Max Distance</span>
          <span class="stat-value">${data.maxDist.toFixed(3)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Avg Distance</span>
          <span class="stat-value">${data.avgDist.toFixed(3)}</span>
        </div>
      </div>
    `;
    
    explanationContainer.innerHTML = `
      <h2>Step 1: Compute Pairwise Distances</h2>
      
      <h3>What We're Doing</h3>
      <p>We calculate the <strong>Euclidean distance</strong> between every pair of points in our 3D dataset.</p>
      
      <h3>The Formula</h3>
      <div id="formula-display"></div>
      
      <h3>Single Point Analysis: Point ${i}</h3>
      <p>Looking at Point ${i}, we found:</p>
      <ul>
        <li><strong>Nearest neighbour:</strong> Point ${nearest[0].j} at distance ${nearest[0].distance.toFixed(3)}</li>
        <li><strong>Farthest point:</strong> Point ${farthest[0].j} at distance ${farthest[0].distance.toFixed(3)}</li>
      </ul>
      
      <h3>Cluster Perspective</h3>
      <p>Notice in the heatmap how points within the same cluster (diagonal blocks) have smaller distances (darker colors), while points in different clusters are farther apart.</p>
      
      <h3>Overall Statistics</h3>
      <ul>
        <li>Minimum distance: ${data.minDist.toFixed(3)}</li>
        <li>Maximum distance: ${data.maxDist.toFixed(3)}</li>
        <li>Average distance: ${data.avgDist.toFixed(3)}</li>
      </ul>
    `;
    
    this.formulaDisplay.showFormula('euclidean_distance', {});
  }
  
  _renderSigmas(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const i = this.selectedPointIndex;
    
    vizContainer.innerHTML = `
      <div class="viz-grid">
        <div class="viz-panel">
          <h4>Binary Search for σ (Point ${i})</h4>
          <div id="sigma-search-viz"></div>
        </div>
        <div class="viz-panel">
          <h4>All σ Values</h4>
          <div id="sigma-distribution"></div>
        </div>
      </div>
    `;
    
    // Binary search visualization for the selected point
    const searchHistory = data.searchHistory.find(h => h.pointIndex === i);
    
    if (searchHistory) {
      const searchViz = new SigmaSearchViz('#sigma-search-viz', {
        width: 380,
        height: 280,
        title: ''
      });
      searchViz.update(searchHistory.history, data.perplexity);
    } else {
      document.getElementById('sigma-search-viz').innerHTML = `
        <p class="info-text">Binary search history available for points 0, 1, 2.</p>
        <p class="info-text">Point ${i} has σ = ${data.sigmas[i].toFixed(4)}</p>
      `;
    }
    
    // Sigma distribution
    document.getElementById('sigma-distribution').innerHTML = `
      <div class="sigma-stats">
        <div class="stat-large">
          <span class="stat-label">σ for Point ${i}</span>
          <span class="stat-value">${data.sigmas[i].toFixed(4)}</span>
        </div>
        <div class="stat-large">
          <span class="stat-label">Average σ</span>
          <span class="stat-value">${data.avgSigma.toFixed(4)}</span>
        </div>
      </div>
      <div class="sigma-list">
        <h5>All σ Values (sorted)</h5>
        <div class="sigma-bars">
          ${[...data.sigmas]
            .map((s, idx) => ({ s, idx }))
            .sort((a, b) => a.s - b.s)
            .map(({ s, idx }) => `
              <div class="sigma-bar ${idx === i ? 'highlighted' : ''}" 
                   style="width: ${(s / Math.max(...data.sigmas)) * 100}%"
                   title="Point ${idx}: σ = ${s.toFixed(4)}">
                <span>${idx}</span>
              </div>
            `).join('')}
        </div>
      </div>
    `;
    
    explanationContainer.innerHTML = `
      <h2>Step 2: Find σ Values</h2>
      
      <h3>Why σ Matters</h3>
      <p>Each point needs its own σ (sigma) that controls how it "sees" its neighbours. Points in dense regions need smaller σ, while isolated points need larger σ.</p>
      
      <h3>The Goal: Match Perplexity</h3>
      <p>We want each point to have a specific <strong>perplexity = ${data.perplexity}</strong>. Perplexity roughly means "effective number of neighbours".</p>
      
      <h3>Binary Search Process</h3>
      <p>For each point, we:</p>
      <ol>
        <li>Guess a σ value</li>
        <li>Compute the resulting perplexity</li>
        <li>If perplexity is too high → decrease σ</li>
        <li>If perplexity is too low → increase σ</li>
        <li>Repeat until we match target perplexity</li>
      </ol>
      
      <h3>Point ${i}'s Result</h3>
      <p>After binary search, Point ${i} has <strong>σ = ${data.sigmas[i].toFixed(4)}</strong></p>
      
      <h3>Cluster Insight</h3>
      <p>Points in dense clusters typically have <strong>smaller σ</strong> because they have many nearby neighbours. Isolated points need <strong>larger σ</strong> to "reach" their neighbours.</p>
    `;
    
    this.formulaDisplay.showFormula('perplexity', { perplexity: data.perplexity });
  }
  
  _renderPConditional(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    const i = this.selectedPointIndex;
    
    vizContainer.innerHTML = `
      <div class="viz-grid">
        <div class="viz-panel">
          <h4>Conditional Probability Matrix P(j|i)</h4>
          <div id="p-cond-heatmap"></div>
        </div>
        <div class="viz-panel">
          <h4>Gaussian Kernel for Point ${i}</h4>
          <div id="gaussian-viz"></div>
        </div>
      </div>
    `;
    
    // P conditional heatmap
    const heatmap = new Heatmap('#p-cond-heatmap', {
      width: 350,
      height: 350,
      title: '',
      colorScheme: 'blues'
    });
    heatmap.update(data.P_conditional, labels);
    heatmap.highlightRow(i);
    
    // Gaussian visualization
    const sigmasSnapshot = this.snapshots.find(s => s.stepType === TSNESteps.COMPUTE_SIGMAS);
    const distSnapshot = this.snapshots.find(s => s.stepType === TSNESteps.COMPUTE_DISTANCES);
    
    if (sigmasSnapshot && distSnapshot) {
      const sigma = sigmasSnapshot.data.sigmas[i];
      const distances = distSnapshot.data.distanceMatrix[i];
      
      const points = distances
        .map((d, j) => ({ distance: d, probability: data.P_conditional[i][j], label: `j=${j}`, color: getLabelColor(labels[j]) }))
        .filter((_, j) => j !== i)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);
      
      const gaussian = new GaussianDistribution('#gaussian-viz', {
        width: 380,
        height: 250,
        title: ''
      });
      gaussian.update(sigma, 0, points);
    }
    
    // Top probabilities
    const topProbs = data.P_conditional[i]
      .map((p, j) => ({ j, p, label: labels[j] }))
      .filter(d => d.j !== i)
      .sort((a, b) => b.p - a.p)
      .slice(0, 5);
    
    explanationContainer.innerHTML = `
      <h2>Step 3: Compute Conditional Probabilities</h2>
      
      <h3>Converting Distances to Probabilities</h3>
      <p>We use a Gaussian kernel centered on each point. The probability P(j|i) tells us "if we randomly pick a neighbour of point i, what's the chance we pick point j?"</p>
      
      <h3>The Gaussian Curve</h3>
      <p>Points closer to i get higher probabilities. The curve's width is controlled by σ<sub>i</sub>.</p>
      
      <h3>Point ${i}'s Neighbourhood</h3>
      <p>The most likely neighbours of Point ${i} are:</p>
      <ol>
        ${topProbs.map(d => `
          <li><strong style="color: ${getLabelColor(d.label)}">Point ${d.j}</strong>: P = ${(d.p * 100).toFixed(2)}%</li>
        `).join('')}
      </ol>
      
      <h3>Matrix Interpretation</h3>
      <p>The heatmap shows P(j|i) for all pairs. Bright colors = high probability = likely neighbours. Row ${i} is highlighted.</p>
      
      <div class="tip-box">
        <strong>Note:</strong> This matrix is NOT symmetric! P(j|i) ≠ P(i|j) in general.
      </div>
    `;
    
    this.formulaDisplay.showFormula('conditional_probability', {});
  }
  
  _renderSymmetrize(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    const i = this.selectedPointIndex;
    
    vizContainer.innerHTML = `
      <div class="viz-grid">
        <div class="viz-panel">
          <h4>P(j|i) - Asymmetric</h4>
          <div id="p-cond-matrix"></div>
        </div>
        <div class="viz-panel">
          <h4>P<sub>ij</sub> - Symmetrized</h4>
          <div id="p-sym-matrix"></div>
        </div>
      </div>
    `;
    
    // Both heatmaps
    const condHeatmap = new Heatmap('#p-cond-matrix', {
      width: 300,
      height: 300,
      colorScheme: 'blues'
    });
    condHeatmap.update(data.P_conditional, labels);
    
    const symHeatmap = new Heatmap('#p-sym-matrix', {
      width: 300,
      height: 300,
      colorScheme: 'purples'
    });
    symHeatmap.update(data.P, labels);
    
    // Show specific comparison
    const j = (i + 1) % labels.length;
    const pji = data.P_conditional[i][j];
    const pij = data.P_conditional[j][i];
    const pSym = data.P[i][j];
    
    explanationContainer.innerHTML = `
      <h2>Step 4: Symmetrize Probabilities</h2>
      
      <h3>The Problem</h3>
      <p>The conditional probabilities P(j|i) are not symmetric. If point i is in a dense region and j is isolated, P(j|i) might be very different from P(i|j).</p>
      
      <h3>The Solution</h3>
      <p>We create a symmetric joint probability:</p>
      <div class="formula-box">
        P<sub>ij</sub> = (P(j|i) + P(i|j)) / 2n
      </div>
      
      <h3>Example: Points ${i} and ${j}</h3>
      <table class="data-table">
        <tr>
          <th>Value</th>
          <th>Before</th>
          <th>After</th>
        </tr>
        <tr>
          <td>P(${j}|${i})</td>
          <td>${pji.toExponential(3)}</td>
          <td rowspan="2">${pSym.toExponential(3)}</td>
        </tr>
        <tr>
          <td>P(${i}|${j})</td>
          <td>${pij.toExponential(3)}</td>
        </tr>
      </table>
      
      <h3>Why Symmetrize?</h3>
      <ul>
        <li>Makes the optimization simpler</li>
        <li>If i is a neighbour of j, then j should be a neighbour of i</li>
        <li>Produces nicer gradients</li>
      </ul>
    `;
    
    this.formulaDisplay.showFormula('symmetrize', {});
  }
  
  _renderExaggeration(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    
    vizContainer.innerHTML = `
      <div class="viz-grid">
        <div class="viz-panel">
          <h4>Original P (before)</h4>
          <div id="p-original"></div>
        </div>
        <div class="viz-panel">
          <h4>Exaggerated P (× ${data.exaggerationFactor})</h4>
          <div id="p-exaggerated"></div>
        </div>
      </div>
    `;
    
    const origHeatmap = new Heatmap('#p-original', {
      width: 300,
      height: 300,
      colorScheme: 'blues'
    });
    origHeatmap.update(data.P_original, labels);
    
    const exagHeatmap = new Heatmap('#p-exaggerated', {
      width: 300,
      height: 300,
      colorScheme: 'reds'
    });
    exagHeatmap.update(data.P_exaggerated, labels);
    
    explanationContainer.innerHTML = `
      <h2>Step 5: Apply Early Exaggeration</h2>
      
      <h3>What is Early Exaggeration?</h3>
      <p>We multiply all P values by <strong>${data.exaggerationFactor}</strong> during the first 100 iterations.</p>
      
      <h3>Why Do This?</h3>
      <p>Early exaggeration creates <strong>stronger attractive forces</strong> between neighbours. This helps:</p>
      <ul>
        <li>Clusters form more quickly and clearly</li>
        <li>Points that should be together "find each other" early</li>
        <li>Creates separation between clusters from the start</li>
      </ul>
      
      <h3>Visual Effect</h3>
      <p>Compare the two heatmaps - the exaggerated version has much brighter (higher) values. This means neighbours pull on each other ${data.exaggerationFactor}× harder initially.</p>
      
      <h3>Later...</h3>
      <p>After 100 iterations, we'll remove the exaggeration and let the embedding fine-tune with normal forces.</p>
    `;
    
    this.formulaDisplay.showFormula('early_exaggeration', { factor: data.exaggerationFactor });
  }
  
  _renderInitEmbedding(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    const is1D = data.targetDim === 1;
    
    vizContainer.innerHTML = `
      <div class="viz-single">
        <h4>Initial Random Embedding (${data.targetDim}D)</h4>
        <div id="init-embedding"></div>
      </div>
    `;
    
    if (is1D) {
      const numberLine = new NumberLine1D('#init-embedding', {
        width: 600,
        height: 100,
        title: ''
      });
      numberLine.update(data.embedding, labels);
    } else {
      const scatter = new Scatter2D('#init-embedding', {
        width: 500,
        height: 400,
        title: ''
      });
      scatter.update(data.embedding, labels);
    }
    
    explanationContainer.innerHTML = `
      <h2>Step 6: Initialize Low-D Embedding</h2>
      
      <h3>Starting Point</h3>
      <p>We initialize all points with <strong>small random values</strong> close to zero. This is our starting configuration in ${data.targetDim}D space.</p>
      
      <h3>Why Random?</h3>
      <ul>
        <li>We don't want to bias the result toward any particular structure</li>
        <li>The optimization will move points to their correct positions</li>
        <li>Different random starts can give slightly different results</li>
      </ul>
      
      <h3>Current State</h3>
      <p>All ${data.embedding.length} points are clustered near the origin. They look like random noise - no structure yet!</p>
      <p>Scale: points are initialized with values around ±0.0001</p>
      
      <h3>What's Next</h3>
      <p>The optimization process will gradually move these points apart, forming clusters that match the original 3D structure.</p>
    `;
    
    this.formulaDisplay.clear();
  }
  
  _renderComputeQ(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    const i = this.selectedPointIndex;
    
    vizContainer.innerHTML = `
      <div class="viz-grid">
        <div class="viz-panel">
          <h4>Q Matrix (Low-D Similarities)</h4>
          <div id="q-matrix"></div>
        </div>
        <div class="viz-panel">
          <h4>Gaussian vs t-Distribution</h4>
          <div id="dist-comparison"></div>
        </div>
      </div>
    `;
    
    const qHeatmap = new Heatmap('#q-matrix', {
      width: 350,
      height: 350,
      colorScheme: 'greens'
    });
    qHeatmap.update(data.Q, labels);
    qHeatmap.highlightRow(i);
    
    const distComp = new DistributionComparison('#dist-comparison', {
      width: 400,
      height: 280,
      title: ''
    });
    distComp.update();
    distComp.highlightTails();
    
    explanationContainer.innerHTML = `
      <h2>Step 7: Compute Q Distribution</h2>
      
      <h3>Low-Dimensional Similarities</h3>
      <p>Now we compute similarities in the low-D space. We use a <strong>Student's t-distribution</strong> instead of Gaussian.</p>
      
      <h3>Why t-Distribution?</h3>
      <p>The t-distribution has <strong>heavier tails</strong> (highlighted in red on the chart). This means:</p>
      <ul>
        <li>Moderate distances get similar probabilities to Gaussian</li>
        <li>Large distances get HIGHER probabilities than Gaussian would give</li>
        <li>This prevents the "crowding problem" where everything gets squished together</li>
      </ul>
      
      <h3>The "Crowding Problem"</h3>
      <p>When we squeeze 3D data into 2D, there's less "room" for points. The t-distribution compensates by allowing distant points to be even further apart.</p>
      
      <h3>Current Q Matrix</h3>
      <p>Since our embedding is still random, the Q matrix doesn't match P well yet. The optimization will fix this.</p>
    `;
    
    this.formulaDisplay.showFormula('q_distribution', {});
  }
  
  _renderGradient(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    const i = this.selectedPointIndex;
    
    vizContainer.innerHTML = `
      <div class="viz-single">
        <h4>Gradient Forces</h4>
        <div id="gradient-field"></div>
      </div>
    `;
    
    const gradField = new GradientField('#gradient-field', {
      width: 550,
      height: 450,
      title: ''
    });
    gradField.update(data.embedding, data.gradient, labels);
    gradField.showForceBreakdown(i, data.embedding, data.P, data.Q, labels);
    
    // Compute gradient magnitude for selected point
    const gi = data.gradient[i];
    const mag = Math.sqrt(gi.reduce((sum, v) => sum + v * v, 0));
    
    explanationContainer.innerHTML = `
      <h2>Step 8: Compute Gradient</h2>
      
      <h3>The Gradient of KL Divergence</h3>
      <p>The gradient tells each point which direction to move to minimize the difference between P and Q.</p>
      
      <h3>Two Types of Forces</h3>
      <ul>
        <li><strong style="color: #27ae60">Attractive (green):</strong> P<sub>ij</sub> > Q<sub>ij</sub> → points should be closer</li>
        <li><strong style="color: #e74c3c">Repulsive (red):</strong> P<sub>ij</sub> < Q<sub>ij</sub> → points should be farther</li>
      </ul>
      
      <h3>Point ${i}'s Gradient</h3>
      <p>Gradient vector: (${gi.map(v => v.toFixed(4)).join(', ')})</p>
      <p>Magnitude: ${mag.toFixed(4)}</p>
      
      <h3>Visualizing Forces</h3>
      <p>The arrows show the net force on each point. Longer arrows = stronger gradients = points need to move more.</p>
      
      <div class="tip-box">
        <strong>Key Insight:</strong> Points that are neighbours in 3D (high P<sub>ij</sub>) but far apart in 2D (low Q<sub>ij</sub>) experience strong attractive forces.
      </div>
    `;
    
    this.formulaDisplay.showFormula('gradient', {});
  }
  
  _renderUpdate(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    
    vizContainer.innerHTML = `
      <div class="viz-single">
        <h4>Embedding After First Update</h4>
        <div id="updated-embedding"></div>
      </div>
    `;
    
    const is1D = data.embedding[0].length === 1;
    
    if (is1D) {
      const numberLine = new NumberLine1D('#updated-embedding', {
        width: 600,
        height: 100,
        title: ''
      });
      numberLine.update(data.embedding, labels);
    } else {
      const scatter = new Scatter2D('#updated-embedding', {
        width: 500,
        height: 400,
        title: '',
        showGradients: true
      });
      scatter.update(data.embedding, labels, { gradients: data.gradient });
    }
    
    explanationContainer.innerHTML = `
      <h2>Step 9: Update Positions</h2>
      
      <h3>Gradient Descent Step</h3>
      <p>Each point moves in the direction opposite to its gradient (downhill on the cost surface).</p>
      
      <h3>The Update Rule</h3>
      <div class="formula-box">
        y<sub>i</sub><sup>(t+1)</sup> = y<sub>i</sub><sup>(t)</sup> + η · ∇C + α · (y<sub>i</sub><sup>(t)</sup> - y<sub>i</sub><sup>(t-1)</sup>)
      </div>
      
      <h3>Key Parameters</h3>
      <ul>
        <li><strong>Learning Rate (η):</strong> ${data.learningRate} - controls step size</li>
        <li><strong>Momentum (α):</strong> 0.5 initially, 0.8 later - accelerates convergence</li>
      </ul>
      
      <h3>After One Update</h3>
      <p>Points have moved slightly based on the gradient. It's still chaotic, but the optimization has begun!</p>
      
      <h3>Centering</h3>
      <p>After each update, we center the embedding (subtract the mean) to prevent drift.</p>
    `;
    
    this.formulaDisplay.showFormula('update_rule', { lr: data.learningRate });
  }
  
  _renderIterations(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    
    // Create grid of iteration snapshots
    const keyIters = data.iterations;
    
    vizContainer.innerHTML = `
      <div class="iteration-viewer">
        <div class="iteration-grid" id="iteration-grid"></div>
        <div class="cost-chart-container">
          <h4>KL Divergence Over Time</h4>
          <div id="cost-chart"></div>
        </div>
      </div>
    `;
    
    // Create mini scatter plots for each key iteration
    const grid = document.getElementById('iteration-grid');
    const is1D = keyIters[0]?.embedding[0].length === 1;
    
    keyIters.forEach((iter, idx) => {
      const panel = document.createElement('div');
      panel.className = 'iteration-panel';
      panel.innerHTML = `
        <div class="iter-header">Iteration ${iter.iteration}</div>
        <div class="iter-scatter" id="iter-${idx}"></div>
        <div class="iter-cost">Cost: ${iter.cost.toFixed(4)}</div>
      `;
      grid.appendChild(panel);
      
      // Small scatter plot
      setTimeout(() => {
        if (is1D) {
          const nl = new NumberLine1D(`#iter-${idx}`, { width: 180, height: 50 });
          nl.update(iter.embedding, labels);
        } else {
          const scatter = new Scatter2D(`#iter-${idx}`, { 
            width: 180, 
            height: 150,
            margin: { top: 5, right: 5, bottom: 5, left: 5 }
          });
          scatter.update(iter.embedding, labels);
        }
      }, 0);
    });
    
    // Cost chart
    const costHistory = data.costs.map((cost, i) => ({ iteration: i, cost }));
    const costChart = new CostChart('#cost-chart', {
      width: 500,
      height: 200,
      title: ''
    });
    costChart.update(costHistory, 100);
    costChart.showExaggerationLabel();
    
    explanationContainer.innerHTML = `
      <h2>Step 10: Optimization Progress</h2>
      
      <h3>Watching Clusters Form</h3>
      <p>The grid shows the embedding at key iterations. Watch how the random blob transforms into distinct clusters!</p>
      
      <h3>What's Happening</h3>
      <ol>
        <li><strong>Early iterations (0-50):</strong> Points start spreading out</li>
        <li><strong>With exaggeration (0-100):</strong> Strong attractive forces pull clusters together</li>
        <li><strong>After removing exaggeration (100+):</strong> Fine-tuning the positions</li>
        <li><strong>Late iterations (200+):</strong> Convergence, minimal changes</li>
      </ol>
      
      <h3>The Cost (KL Divergence)</h3>
      <p>The cost measures how different Q is from P. Lower = better match = better embedding.</p>
      <ul>
        <li>Initial cost: ${data.costs[0]?.toFixed(4) || 'N/A'}</li>
        <li>Final cost: ${data.costs[data.costs.length - 1]?.toFixed(4) || 'N/A'}</li>
      </ul>
      
      <h3>Yellow Zone</h3>
      <p>The highlighted yellow region shows the early exaggeration phase where P is multiplied by 4.</p>
    `;
    
    this.formulaDisplay.showFormula('kl_divergence', {});
  }
  
  _renderRemoveExaggeration(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    
    vizContainer.innerHTML = `
      <div class="viz-single">
        <h4>Embedding at Iteration ${data.iteration} (Exaggeration Removed)</h4>
        <div id="post-exag-embedding"></div>
      </div>
    `;
    
    const is1D = data.embedding[0].length === 1;
    
    if (is1D) {
      const numberLine = new NumberLine1D('#post-exag-embedding', {
        width: 600,
        height: 100
      });
      numberLine.update(data.embedding, labels);
    } else {
      const scatter = new Scatter2D('#post-exag-embedding', {
        width: 500,
        height: 400
      });
      scatter.update(data.embedding, labels);
    }
    
    explanationContainer.innerHTML = `
      <h2>Step 11: Remove Early Exaggeration</h2>
      
      <h3>Switching to Normal Mode</h3>
      <p>At iteration ${data.iteration}, we stop multiplying P by 4. The forces return to their normal strength.</p>
      
      <h3>Current State</h3>
      <p>By now, the major cluster structure has formed. The clusters are separated and points within each cluster are grouped.</p>
      
      <h3>What Happens Next</h3>
      <p>With normal (unexaggerated) forces:</p>
      <ul>
        <li>Attractive and repulsive forces are balanced</li>
        <li>Points fine-tune their positions</li>
        <li>The embedding settles into its final configuration</li>
      </ul>
      
      <h3>Momentum Increase</h3>
      <p>At iteration 250, momentum increases from 0.5 to 0.8, helping the optimization move faster through flat regions of the cost surface.</p>
    `;
    
    this.formulaDisplay.clear();
  }
  
  _renderFinalResult(snapshot, vizContainer, explanationContainer) {
    const data = snapshot.data;
    const labels = snapshot.labels;
    
    const is1D = data.embedding[0].length === 1;
    
    vizContainer.innerHTML = `
      <div class="viz-grid final-result">
        <div class="viz-panel">
          <h4>Final ${is1D ? '1D' : '2D'} Embedding</h4>
          <div id="final-embedding"></div>
        </div>
        <div class="viz-panel">
          <h4>Summary Statistics</h4>
          <div class="summary-stats">
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-info">
                <div class="stat-value">${data.embedding.length}</div>
                <div class="stat-label">Points Embedded</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📉</div>
              <div class="stat-info">
                <div class="stat-value">${data.finalCost.toFixed(4)}</div>
                <div class="stat-label">Final KL Divergence</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">🔄</div>
              <div class="stat-info">
                <div class="stat-value">${data.costs.length}</div>
                <div class="stat-label">Iterations</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📐</div>
              <div class="stat-info">
                <div class="stat-value">3D → ${is1D ? '1D' : '2D'}</div>
                <div class="stat-label">Dimension Reduction</div>
              </div>
            </div>
          </div>
          <div id="final-cost-chart"></div>
        </div>
      </div>
    `;
    
    if (is1D) {
      const numberLine = new NumberLine1D('#final-embedding', {
        width: 500,
        height: 120
      });
      numberLine.update(data.embedding, labels);
    } else {
      const scatter = new Scatter2D('#final-embedding', {
        width: 450,
        height: 380
      });
      scatter.update(data.embedding, labels);
    }
    
    // Mini cost chart
    const costHistory = data.costs.map((cost, i) => ({ iteration: i, cost }));
    const costChart = new CostChart('#final-cost-chart', {
      width: 350,
      height: 150,
      title: 'Convergence'
    });
    costChart.update(costHistory, 100);
    
    // Count clusters preserved
    const clusters = [...new Set(labels)].length;
    
    explanationContainer.innerHTML = `
      <h2>🎉 Final Result</h2>
      
      <h3>Success!</h3>
      <p>t-SNE has successfully reduced our ${data.embedding.length}-point dataset from <strong>3D</strong> to <strong>${is1D ? '1D' : '2D'}</strong>.</p>
      
      <h3>What We Achieved</h3>
      <ul>
        <li><strong>${clusters} clusters</strong> are clearly visible in the embedding</li>
        <li>Points that were close in 3D remain close in ${is1D ? '1D' : '2D'}</li>
        <li>Cluster separation is preserved</li>
      </ul>
      
      <h3>Final Statistics</h3>
      <table class="data-table">
        <tr>
          <td>Initial KL Divergence</td>
          <td>${data.costs[0]?.toFixed(4)}</td>
        </tr>
        <tr>
          <td>Final KL Divergence</td>
          <td>${data.finalCost.toFixed(4)}</td>
        </tr>
        <tr>
          <td>Improvement</td>
          <td>${((1 - data.finalCost / data.costs[0]) * 100).toFixed(1)}%</td>
        </tr>
      </table>
      
      <h3>Try Different Settings</h3>
      <p>Go back to the controls and try:</p>
      <ul>
        <li>Different perplexity values</li>
        <li>Different datasets</li>
        <li>3D → 1D mode</li>
      </ul>
      
      <div class="tip-box success">
        <strong>✅ Complete!</strong> You've walked through all ${this.snapshots.length} steps of the t-SNE algorithm.
      </div>
    `;
    
    this.formulaDisplay.clear();
  }
  
  /**
   * Show/hide loading indicator
   */
  _showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
    }
    this.isComputing = show;
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TSNEVisualizer();
});
