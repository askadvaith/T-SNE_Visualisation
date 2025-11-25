/**
 * Step Indicator Component
 * Shows current algorithm step, progress, and explanations
 */

import { TSNESteps, StepInfo } from '../core/tsne.js';

/**
 * Step indicator with progress and explanations
 */
export class StepIndicator {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.options = options;
    this.currentStep = TSNESteps.INIT;
    this.iteration = 0;
    this.maxIter = options.maxIter || 1000;
    
    this._render();
  }
  
  _render() {
    this.container.innerHTML = '';
    this.container.className = 'step-indicator';
    
    // Step title
    this.titleEl = document.createElement('h2');
    this.titleEl.className = 'step-title';
    this.container.appendChild(this.titleEl);
    
    // Progress bar for optimization iterations
    this.progressContainer = document.createElement('div');
    this.progressContainer.className = 'iteration-progress';
    this.progressContainer.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill"></div>
        <div class="exaggeration-marker"></div>
      </div>
      <div class="progress-label">
        <span class="iter-current">0</span> / <span class="iter-max">${this.maxIter}</span>
      </div>
    `;
    this.container.appendChild(this.progressContainer);
    
    // Step phases indicator
    this.phasesEl = document.createElement('div');
    this.phasesEl.className = 'step-phases';
    this._renderPhases();
    this.container.appendChild(this.phasesEl);
    
    // Description
    this.descriptionEl = document.createElement('div');
    this.descriptionEl.className = 'step-description';
    this.container.appendChild(this.descriptionEl);
    
    // Intuition
    this.intuitionEl = document.createElement('div');
    this.intuitionEl.className = 'step-intuition';
    this.container.appendChild(this.intuitionEl);
    
    // Initial update
    this.update(TSNESteps.INIT, 0);
  }
  
  _renderPhases() {
    const phases = [
      { id: 'setup', label: 'Setup', steps: [TSNESteps.INIT, TSNESteps.COMPUTE_DISTANCES] },
      { id: 'probabilities', label: 'Probabilities', steps: [TSNESteps.COMPUTE_SIGMAS, TSNESteps.COMPUTE_P_CONDITIONAL, TSNESteps.SYMMETRIZE_P] },
      { id: 'initialization', label: 'Initialize', steps: [TSNESteps.APPLY_EARLY_EXAGGERATION, TSNESteps.INITIALIZE_EMBEDDING] },
      { id: 'optimization', label: 'Optimize', steps: [TSNESteps.COMPUTE_Q, TSNESteps.COMPUTE_GRADIENT, TSNESteps.UPDATE_EMBEDDING, TSNESteps.REMOVE_EXAGGERATION] },
      { id: 'complete', label: 'Complete', steps: [TSNESteps.COMPLETE] }
    ];
    
    this.phases = phases;
    
    this.phasesEl.innerHTML = phases.map(phase => `
      <div class="phase" data-phase="${phase.id}">
        <div class="phase-dot"></div>
        <div class="phase-label">${phase.label}</div>
      </div>
    `).join('<div class="phase-connector"></div>');
  }
  
  /**
   * Update the step indicator
   * @param {string} step - Current step
   * @param {number} iteration - Current iteration
   */
  update(step, iteration = 0) {
    this.currentStep = step;
    this.iteration = iteration;
    
    const info = StepInfo[step];
    
    // Update title
    this.titleEl.textContent = info ? info.title : step;
    
    // Update description
    this.descriptionEl.innerHTML = info ? `<p>${info.description}</p>` : '';
    
    // Update intuition
    if (info && info.intuition) {
      this.intuitionEl.innerHTML = `
        <div class="intuition-icon">💡</div>
        <div class="intuition-text">${info.intuition}</div>
      `;
      this.intuitionEl.style.display = 'flex';
    } else {
      this.intuitionEl.style.display = 'none';
    }
    
    // Update progress bar
    this._updateProgress(iteration);
    
    // Update phase indicators
    this._updatePhases(step);
  }
  
  _updateProgress(iteration) {
    const fill = this.progressContainer.querySelector('.progress-fill');
    const currentLabel = this.progressContainer.querySelector('.iter-current');
    const exagMarker = this.progressContainer.querySelector('.exaggeration-marker');
    
    const progress = Math.min(100, (iteration / this.maxIter) * 100);
    fill.style.width = `${progress}%`;
    currentLabel.textContent = iteration;
    
    // Position exaggeration marker at 250 iterations (default)
    const exagPercent = (250 / this.maxIter) * 100;
    exagMarker.style.left = `${exagPercent}%`;
    
    // Show/hide progress based on step
    const isOptimizing = [
      TSNESteps.COMPUTE_Q,
      TSNESteps.COMPUTE_GRADIENT,
      TSNESteps.UPDATE_EMBEDDING,
      TSNESteps.REMOVE_EXAGGERATION,
      TSNESteps.COMPLETE
    ].includes(this.currentStep);
    
    this.progressContainer.style.display = isOptimizing ? 'block' : 'none';
  }
  
  _updatePhases(step) {
    // Find which phase this step belongs to
    let activePhaseIndex = -1;
    for (let i = 0; i < this.phases.length; i++) {
      if (this.phases[i].steps.includes(step)) {
        activePhaseIndex = i;
        break;
      }
    }
    
    // Update phase styling
    const phaseEls = this.phasesEl.querySelectorAll('.phase');
    const connectors = this.phasesEl.querySelectorAll('.phase-connector');
    
    phaseEls.forEach((el, i) => {
      el.classList.remove('active', 'completed');
      if (i < activePhaseIndex) {
        el.classList.add('completed');
      } else if (i === activePhaseIndex) {
        el.classList.add('active');
      }
    });
    
    connectors.forEach((el, i) => {
      el.classList.remove('completed');
      if (i < activePhaseIndex) {
        el.classList.add('completed');
      }
    });
  }
  
  /**
   * Set maximum iterations
   */
  setMaxIterations(max) {
    this.maxIter = max;
    this.progressContainer.querySelector('.iter-max').textContent = max;
  }
}

/**
 * Create a compact step list for navigation
 */
export class StepList {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.onStepClick = options.onStepClick || null;
    this.currentStep = null;
    
    this._render();
  }
  
  _render() {
    this.container.innerHTML = '';
    this.container.className = 'step-list';
    
    const steps = [
      { step: TSNESteps.INIT, label: '1. Initialize' },
      { step: TSNESteps.COMPUTE_DISTANCES, label: '2. Compute Distances' },
      { step: TSNESteps.COMPUTE_SIGMAS, label: '3. Find σ (Perplexity)' },
      { step: TSNESteps.COMPUTE_P_CONDITIONAL, label: '4. Compute P(j|i)' },
      { step: TSNESteps.SYMMETRIZE_P, label: '5. Symmetrize P' },
      { step: TSNESteps.APPLY_EARLY_EXAGGERATION, label: '6. Early Exaggeration' },
      { step: TSNESteps.INITIALIZE_EMBEDDING, label: '7. Initialize Y' },
      { step: TSNESteps.COMPUTE_Q, label: '8. Compute Q' },
      { step: TSNESteps.COMPUTE_GRADIENT, label: '9. Compute Gradient' },
      { step: TSNESteps.UPDATE_EMBEDDING, label: '10. Update Y' },
      { step: TSNESteps.COMPLETE, label: '✓ Complete' }
    ];
    
    steps.forEach(({ step, label }) => {
      const item = document.createElement('div');
      item.className = 'step-list-item';
      item.dataset.step = step;
      item.textContent = label;
      
      item.addEventListener('click', () => {
        if (this.onStepClick) {
          this.onStepClick(step);
        }
      });
      
      this.container.appendChild(item);
    });
  }
  
  /**
   * Update the highlighted step
   */
  update(step) {
    this.currentStep = step;
    
    const items = this.container.querySelectorAll('.step-list-item');
    let foundCurrent = false;
    
    items.forEach(item => {
      item.classList.remove('active', 'completed');
      
      if (item.dataset.step === step) {
        item.classList.add('active');
        foundCurrent = true;
      } else if (!foundCurrent) {
        item.classList.add('completed');
      }
    });
  }
}
