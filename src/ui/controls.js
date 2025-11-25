/**
 * UI Controls Panel
 * Sliders for parameters, playback controls, and mode selection
 */

/**
 * Create a labeled slider control
 * @param {object} options - Slider configuration
 * @returns {HTMLElement} Slider container element
 */
export function createSlider(options) {
  const {
    id,
    label,
    min,
    max,
    value,
    step = 1,
    onChange,
    formatValue = v => v
  } = options;
  
  const container = document.createElement('div');
  container.className = 'control-slider';
  
  container.innerHTML = `
    <label for="${id}">
      <span class="slider-label">${label}</span>
      <span class="slider-value" id="${id}-value">${formatValue(value)}</span>
    </label>
    <input type="range" id="${id}" min="${min}" max="${max}" value="${value}" step="${step}">
  `;
  
  const input = container.querySelector('input');
  const valueDisplay = container.querySelector(`#${id}-value`);
  
  input.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    valueDisplay.textContent = formatValue(val);
    if (onChange) onChange(val);
  });
  
  return container;
}

/**
 * Create playback control buttons
 * @param {object} callbacks - Event callbacks
 * @returns {HTMLElement} Playback controls container
 */
export function createPlaybackControls(callbacks) {
  const container = document.createElement('div');
  container.className = 'playback-controls';
  
  container.innerHTML = `
    <button id="btn-reset" title="Reset">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
      </svg>
    </button>
    <button id="btn-step-back" title="Previous Step">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
      </svg>
    </button>
    <button id="btn-play" title="Play/Pause" class="play-btn">
      <svg class="icon-play" viewBox="0 0 24 24" width="24" height="24">
        <path fill="currentColor" d="M8 5v14l11-7z"/>
      </svg>
      <svg class="icon-pause" viewBox="0 0 24 24" width="24" height="24" style="display:none">
        <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    </button>
    <button id="btn-step" title="Next Step">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
      </svg>
    </button>
    <button id="btn-fast-forward" title="Run to Completion">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
      </svg>
    </button>
  `;
  
  // Attach event listeners
  container.querySelector('#btn-reset').addEventListener('click', callbacks.onReset);
  container.querySelector('#btn-step-back').addEventListener('click', callbacks.onStepBack);
  container.querySelector('#btn-play').addEventListener('click', callbacks.onPlay);
  container.querySelector('#btn-step').addEventListener('click', callbacks.onStep);
  container.querySelector('#btn-fast-forward').addEventListener('click', callbacks.onFastForward);
  
  return container;
}

/**
 * Toggle play/pause button state
 * @param {HTMLElement} container - Playback controls container
 * @param {boolean} isPlaying - Current play state
 */
export function setPlayingState(container, isPlaying) {
  const playIcon = container.querySelector('.icon-play');
  const pauseIcon = container.querySelector('.icon-pause');
  
  if (isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

/**
 * Create dimension mode selector
 * @param {function} onChange - Callback when mode changes
 * @returns {HTMLElement} Mode selector container
 */
export function createModeSelector(onChange) {
  const container = document.createElement('div');
  container.className = 'mode-selector';
  
  container.innerHTML = `
    <label class="mode-label">Dimension Reduction</label>
    <div class="mode-buttons">
      <button class="mode-btn active" data-mode="2d-1d">2D → 1D</button>
      <button class="mode-btn" data-mode="2d-2d">2D → 2D</button>
    </div>
  `;
  
  const buttons = container.querySelectorAll('.mode-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (onChange) onChange(btn.dataset.mode);
    });
  });
  
  return container;
}

/**
 * Create dataset preset selector
 * @param {string[]} presets - Available preset names
 * @param {function} onChange - Callback when preset changes
 * @returns {HTMLElement} Preset selector container
 */
export function createPresetSelector(presets, onChange) {
  const container = document.createElement('div');
  container.className = 'preset-selector';
  
  const optionsHTML = presets.map(p => 
    `<option value="${p}">${formatPresetName(p)}</option>`
  ).join('');
  
  container.innerHTML = `
    <label for="preset-select">Dataset</label>
    <select id="preset-select">
      ${optionsHTML}
    </select>
  `;
  
  container.querySelector('select').addEventListener('change', (e) => {
    if (onChange) onChange(e.target.value);
  });
  
  return container;
}

/**
 * Format preset name for display
 */
function formatPresetName(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Controls Panel - combines all controls
 */
export class ControlsPanel {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.options = options;
    this.callbacks = options.callbacks || {};
    this.values = {
      perplexity: options.perplexity ?? 30,
      learningRate: options.learningRate ?? 200,
      earlyExaggeration: options.earlyExaggeration ?? 4,
      numPoints: options.numPoints ?? 30,
      clusterSpread: options.clusterSpread ?? 0.3,
      mode: options.mode ?? '2d-1d',
      preset: options.preset ?? 'simple-blobs'
    };
    
    this.isPlaying = false;
    
    this._render();
  }
  
  _render() {
    this.container.innerHTML = '';
    this.container.className = 'controls-panel';
    
    // Dataset section
    const dataSection = document.createElement('div');
    dataSection.className = 'control-section';
    dataSection.innerHTML = '<h3>Dataset</h3>';
    
    // Mode selector
    this.modeSelector = createModeSelector((mode) => {
      this.values.mode = mode;
      if (this.callbacks.onModeChange) this.callbacks.onModeChange(mode);
    });
    dataSection.appendChild(this.modeSelector);
    
    // Preset selector
    const presets = ['simple-blobs', 'tight-clusters', 'overlapping', 'moons', 'circles', 'linear'];
    this.presetSelector = createPresetSelector(presets, (preset) => {
      this.values.preset = preset;
      if (this.callbacks.onPresetChange) this.callbacks.onPresetChange(preset);
    });
    dataSection.appendChild(this.presetSelector);
    
    // Number of points slider
    dataSection.appendChild(createSlider({
      id: 'num-points',
      label: 'Points',
      min: 10,
      max: 60,
      value: this.values.numPoints,
      step: 5,
      onChange: (val) => {
        this.values.numPoints = val;
        if (this.callbacks.onParamChange) this.callbacks.onParamChange('numPoints', val);
      }
    }));
    
    // Cluster spread slider
    dataSection.appendChild(createSlider({
      id: 'cluster-spread',
      label: 'Cluster Spread',
      min: 0.1,
      max: 1.0,
      value: this.values.clusterSpread,
      step: 0.1,
      formatValue: v => v.toFixed(1),
      onChange: (val) => {
        this.values.clusterSpread = val;
        if (this.callbacks.onParamChange) this.callbacks.onParamChange('clusterSpread', val);
      }
    }));
    
    this.container.appendChild(dataSection);
    
    // t-SNE parameters section
    const tsneSection = document.createElement('div');
    tsneSection.className = 'control-section';
    tsneSection.innerHTML = '<h3>t-SNE Parameters</h3>';
    
    // Perplexity slider
    tsneSection.appendChild(createSlider({
      id: 'perplexity',
      label: 'Perplexity',
      min: 2,
      max: 50,
      value: this.values.perplexity,
      step: 1,
      onChange: (val) => {
        this.values.perplexity = val;
        if (this.callbacks.onParamChange) this.callbacks.onParamChange('perplexity', val);
      }
    }));
    
    // Learning rate slider
    tsneSection.appendChild(createSlider({
      id: 'learning-rate',
      label: 'Learning Rate',
      min: 10,
      max: 500,
      value: this.values.learningRate,
      step: 10,
      onChange: (val) => {
        this.values.learningRate = val;
        if (this.callbacks.onParamChange) this.callbacks.onParamChange('learningRate', val);
      }
    }));
    
    // Early exaggeration slider
    tsneSection.appendChild(createSlider({
      id: 'early-exag',
      label: 'Early Exaggeration',
      min: 1,
      max: 12,
      value: this.values.earlyExaggeration,
      step: 1,
      onChange: (val) => {
        this.values.earlyExaggeration = val;
        if (this.callbacks.onParamChange) this.callbacks.onParamChange('earlyExaggeration', val);
      }
    }));
    
    this.container.appendChild(tsneSection);
    
    // Playback section
    const playbackSection = document.createElement('div');
    playbackSection.className = 'control-section playback-section';
    playbackSection.innerHTML = '<h3>Playback</h3>';
    
    this.playbackControls = createPlaybackControls({
      onReset: () => {
        this.isPlaying = false;
        setPlayingState(this.playbackControls, false);
        if (this.callbacks.onReset) this.callbacks.onReset();
      },
      onStepBack: () => {
        if (this.callbacks.onStepBack) this.callbacks.onStepBack();
      },
      onPlay: () => {
        this.isPlaying = !this.isPlaying;
        setPlayingState(this.playbackControls, this.isPlaying);
        if (this.callbacks.onPlay) this.callbacks.onPlay(this.isPlaying);
      },
      onStep: () => {
        if (this.callbacks.onStep) this.callbacks.onStep();
      },
      onFastForward: () => {
        if (this.callbacks.onFastForward) this.callbacks.onFastForward();
      }
    });
    
    playbackSection.appendChild(this.playbackControls);
    
    // Speed slider
    playbackSection.appendChild(createSlider({
      id: 'speed',
      label: 'Speed',
      min: 1,
      max: 10,
      value: 5,
      step: 1,
      formatValue: v => `${v}x`,
      onChange: (val) => {
        if (this.callbacks.onSpeedChange) this.callbacks.onSpeedChange(val);
      }
    }));
    
    this.container.appendChild(playbackSection);
  }
  
  /**
   * Get current parameter values
   */
  getValues() {
    return { ...this.values };
  }
  
  /**
   * Set playing state
   */
  setPlaying(isPlaying) {
    this.isPlaying = isPlaying;
    setPlayingState(this.playbackControls, isPlaying);
  }
  
  /**
   * Enable/disable all controls
   */
  setEnabled(enabled) {
    const inputs = this.container.querySelectorAll('input, select, button');
    inputs.forEach(input => {
      input.disabled = !enabled;
    });
  }
}
