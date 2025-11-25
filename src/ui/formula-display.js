/**
 * Formula Display Component
 * Renders mathematical formulas using KaTeX with dynamic value substitution
 */

import katex from 'katex';

/**
 * Predefined formulas for each step
 */
const FORMULAS = {
  overview: {
    latex: 'C = KL(P \\| Q) = \\sum_{i \\neq j} p_{ij} \\log\\frac{p_{ij}}{q_{ij}}',
    description: 't-SNE minimizes the KL divergence between high-D and low-D distributions'
  },
  
  euclidean_distance: {
    latex: 'd_{ij} = \\| \\mathbf{x}_i - \\mathbf{x}_j \\| = \\sqrt{\\sum_{k=1}^{D}(x_{ik} - x_{jk})^2}',
    description: 'Euclidean distance between points in high-dimensional space'
  },
  
  perplexity: {
    latex: '\\text{Perp}(P_i) = 2^{H(P_i)} = 2^{-\\sum_j p_{j|i} \\log_2 p_{j|i}}',
    description: 'Perplexity measures the effective number of neighbors'
  },
  
  conditional_probability: {
    latex: 'p_{j|i} = \\frac{\\exp(-d_{ij}^2 / 2\\sigma_i^2)}{\\sum_{k \\neq i} \\exp(-d_{ik}^2 / 2\\sigma_i^2)}',
    description: 'Probability that point i picks j as a neighbor'
  },
  
  symmetrize: {
    latex: 'p_{ij} = \\frac{p_{j|i} + p_{i|j}}{2N}',
    description: 'Symmetrized joint probability'
  },
  
  early_exaggeration: {
    latex: 'p_{ij}^{\\text{early}} = 4 \\cdot p_{ij}',
    description: 'Multiply P by 4 during early iterations'
  },
  
  q_distribution: {
    latex: 'q_{ij} = \\frac{(1 + \\|y_i - y_j\\|^2)^{-1}}{\\sum_{k \\neq l}(1 + \\|y_k - y_l\\|^2)^{-1}}',
    description: 'Student t-distribution with 1 degree of freedom (Cauchy)'
  },
  
  gradient: {
    latex: '\\frac{\\partial C}{\\partial y_i} = 4\\sum_j (p_{ij} - q_{ij})(y_i - y_j)(1 + \\|y_i - y_j\\|^2)^{-1}',
    description: 'Gradient of KL divergence w.r.t. embedding position'
  },
  
  update_rule: {
    latex: 'y_i^{(t+1)} = y_i^{(t)} + \\eta \\cdot v_i^{(t)} \\quad \\text{where} \\quad v_i^{(t)} = \\alpha v_i^{(t-1)} - \\eta \\nabla_i C',
    description: 'Gradient descent with momentum'
  },
  
  kl_divergence: {
    latex: 'C = \\sum_{i} \\sum_{j \\neq i} p_{ij} \\log \\frac{p_{ij}}{q_{ij}}',
    description: 'Kullback-Leibler divergence as cost function'
  }
};

/**
 * Formula display with KaTeX rendering
 */
export class FormulaDisplay {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    if (!this.container) {
      console.warn('FormulaDisplay: container not found');
      return;
    }
    
    this.options = options;
    this._render();
  }
  
  _render() {
    this.container.innerHTML = '';
    this.container.className = 'formula-display';
    
    // Formula container
    this.formulaEl = document.createElement('div');
    this.formulaEl.className = 'formula-content';
    this.container.appendChild(this.formulaEl);
    
    // Description container
    this.descEl = document.createElement('div');
    this.descEl.className = 'formula-description';
    this.container.appendChild(this.descEl);
    
    // Values container (for showing actual computed values)
    this.valuesEl = document.createElement('div');
    this.valuesEl.className = 'formula-values';
    this.container.appendChild(this.valuesEl);
  }
  
  /**
   * Show a predefined formula by key
   * @param {string} key - Formula key from FORMULAS
   * @param {object} values - Optional values to display
   */
  showFormula(key, values = null) {
    if (!this.container) return;
    
    const formula = FORMULAS[key];
    
    if (!formula) {
      this.clear();
      return;
    }
    
    try {
      katex.render(formula.latex, this.formulaEl, {
        throwOnError: false,
        displayMode: true,
        trust: true
      });
    } catch (e) {
      this.formulaEl.innerHTML = `<span class="formula-error">${formula.latex}</span>`;
    }
    
    this.descEl.textContent = formula.description || '';
    
    // Show computed values if provided
    if (values && Object.keys(values).length > 0) {
      this._renderValues(values);
    } else {
      this.valuesEl.innerHTML = '';
    }
    
    this.container.style.display = 'block';
  }
  
  /**
   * Update the displayed formula with raw LaTeX
   * @param {string} latex - LaTeX formula string
   * @param {object} values - Values to substitute and display
   */
  update(latex, values = null) {
    if (!this.container) return;
    
    if (!latex) {
      this.clear();
      return;
    }
    
    try {
      katex.render(latex, this.formulaEl, {
        throwOnError: false,
        displayMode: true,
        trust: true
      });
    } catch (e) {
      this.formulaEl.innerHTML = `<span class="formula-error">${latex}</span>`;
    }
    
    this.descEl.textContent = '';
    
    // Show computed values if provided
    if (values) {
      this._renderValues(values);
    } else {
      this.valuesEl.innerHTML = '';
    }
    
    this.container.style.display = 'block';
  }
  
  _renderValues(values) {
    const items = Object.entries(values).map(([key, val]) => {
      const formattedVal = typeof val === 'number' 
        ? (Math.abs(val) < 0.001 || Math.abs(val) > 1000 ? val.toExponential(3) : val.toFixed(4))
        : val;
      return `<span class="value-item"><strong>${key}:</strong> ${formattedVal}</span>`;
    }).join('');
    
    this.valuesEl.innerHTML = items;
  }
  
  /**
   * Clear the display
   */
  clear() {
    if (!this.container) return;
    
    this.formulaEl.innerHTML = '';
    this.descEl.textContent = '';
    this.valuesEl.innerHTML = '';
    this.container.style.display = 'none';
  }
}

/**
 * Create an inline formula span
 * @param {string} latex - LaTeX formula
 * @returns {HTMLElement} Span with rendered formula
 */
export function inlineFormula(latex) {
  const span = document.createElement('span');
  span.className = 'inline-formula';
  
  try {
    katex.render(latex, span, {
      throwOnError: false,
      displayMode: false
    });
  } catch (e) {
    span.textContent = latex;
  }
  
  return span;
}
