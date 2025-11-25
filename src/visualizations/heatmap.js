/**
 * Heatmap Visualization
 * Renders P and Q similarity matrices
 */

import * as d3 from 'd3';
import { getLabelColor } from '../core/data-generator.js';

/**
 * Create a heatmap for similarity matrices
 */
export class Heatmap {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.width = options.width || 300;
    this.height = options.height || 300;
    this.margin = options.margin || { top: 40, right: 20, bottom: 20, left: 40 };
    this.title = options.title || '';
    this.colorScheme = options.colorScheme || 'blues';
    this.showLabels = options.showLabels !== false;
    this.onCellHover = options.onCellHover || null;
    this.onCellClick = options.onCellClick || null;
    
    this.highlightedRow = null;
    this.highlightedCol = null;
    
    this._createSVG();
  }
  
  _createSVG() {
    d3.select(this.container).selectAll('*').remove();
    
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'heatmap');
    
    // Title
    if (this.title) {
      this.svg.append('text')
        .attr('x', this.width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('class', 'chart-title')
        .text(this.title);
    }
    
    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    this.cellsG = this.g.append('g')
      .attr('class', 'cells');
    
    this.rowLabelsG = this.g.append('g')
      .attr('class', 'row-labels');
    
    this.colLabelsG = this.g.append('g')
      .attr('class', 'col-labels');
    
    // Highlight groups
    this.highlightRowG = this.g.append('g')
      .attr('class', 'highlight-row');
    
    this.highlightColG = this.g.append('g')
      .attr('class', 'highlight-col');
    
    // Tooltip
    this.tooltip = d3.select(this.container)
      .append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0,0,0,0.8)')
      .style('color', 'white')
      .style('padding', '5px 10px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none');
  }
  
  /**
   * Update the heatmap with new matrix data
   * @param {number[][]} matrix - Square matrix
   * @param {number[]} labels - Optional labels for coloring
   */
  update(matrix, labels = null) {
    if (!matrix || matrix.length === 0) return;
    
    const n = matrix.length;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    const innerHeight = this.height - this.margin.top - this.margin.bottom;
    
    const cellWidth = innerWidth / n;
    const cellHeight = innerHeight / n;
    
    // Flatten matrix for D3
    const data = [];
    let maxVal = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const value = matrix[i][j];
        if (i !== j && value > maxVal) maxVal = value;
        data.push({
          row: i,
          col: j,
          value: value,
          labelRow: labels ? labels[i] : 0,
          labelCol: labels ? labels[j] : 0
        });
      }
    }
    
    // Color scale
    const colorScale = this._getColorScale(maxVal);
    
    // Draw cells
    const cells = this.cellsG.selectAll('rect')
      .data(data, d => `${d.row}-${d.col}`);
    
    cells.enter()
      .append('rect')
      .attr('x', d => d.col * cellWidth)
      .attr('y', d => d.row * cellHeight)
      .attr('width', cellWidth - 1)
      .attr('height', cellHeight - 1)
      .attr('fill', d => d.row === d.col ? '#eee' : colorScale(d.value))
      .attr('class', 'heatmap-cell')
      .on('mouseenter', (event, d) => this._onCellEnter(event, d, matrix))
      .on('mouseleave', (event, d) => this._onCellLeave(event, d))
      .on('click', (event, d) => this._onCellClick(event, d));
    
    cells.transition()
      .duration(300)
      .attr('x', d => d.col * cellWidth)
      .attr('y', d => d.row * cellHeight)
      .attr('width', cellWidth - 1)
      .attr('height', cellHeight - 1)
      .attr('fill', d => d.row === d.col ? '#eee' : colorScale(d.value));
    
    cells.exit().remove();
    
    // Row/column labels (show indices for small matrices)
    if (this.showLabels && n <= 15) {
      this._drawLabels(n, cellWidth, cellHeight, labels);
    }
    
    // Store for later use
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.n = n;
  }
  
  _getColorScale(maxVal) {
    const schemes = {
      'blues': d3.interpolateBlues,
      'reds': d3.interpolateReds,
      'greens': d3.interpolateGreens,
      'purples': d3.interpolatePurples,
      'viridis': d3.interpolateViridis,
      'plasma': d3.interpolatePlasma
    };
    
    const interpolator = schemes[this.colorScheme] || d3.interpolateBlues;
    
    return d3.scaleSequential()
      .domain([0, maxVal])
      .interpolator(interpolator);
  }
  
  _drawLabels(n, cellWidth, cellHeight, labels) {
    // Row labels (left side)
    const rowLabels = this.rowLabelsG.selectAll('text')
      .data(d3.range(n));
    
    rowLabels.enter()
      .append('text')
      .merge(rowLabels)
      .attr('x', -5)
      .attr('y', (d, i) => i * cellHeight + cellHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', Math.min(10, cellHeight - 2))
      .attr('fill', d => labels ? getLabelColor(labels[d]) : '#666')
      .text(d => d);
    
    rowLabels.exit().remove();
    
    // Column labels (top)
    const colLabels = this.colLabelsG.selectAll('text')
      .data(d3.range(n));
    
    colLabels.enter()
      .append('text')
      .merge(colLabels)
      .attr('x', (d, i) => i * cellWidth + cellWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-size', Math.min(10, cellWidth - 2))
      .attr('fill', d => labels ? getLabelColor(labels[d]) : '#666')
      .text(d => d);
    
    colLabels.exit().remove();
  }
  
  /**
   * Highlight a specific row and column
   * @param {number} row - Row index
   * @param {number} col - Column index
   */
  highlightCell(row, col) {
    this.highlightedRow = row;
    this.highlightedCol = col;
    
    if (row === null || col === null) {
      this.highlightRowG.selectAll('*').remove();
      this.highlightColG.selectAll('*').remove();
      return;
    }
    
    // Highlight row
    this.highlightRowG.selectAll('rect').remove();
    this.highlightRowG.append('rect')
      .attr('x', 0)
      .attr('y', row * this.cellHeight)
      .attr('width', this.n * this.cellWidth)
      .attr('height', this.cellHeight)
      .attr('fill', 'none')
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2);
    
    // Highlight column
    this.highlightColG.selectAll('rect').remove();
    this.highlightColG.append('rect')
      .attr('x', col * this.cellWidth)
      .attr('y', 0)
      .attr('width', this.cellWidth)
      .attr('height', this.n * this.cellHeight)
      .attr('fill', 'none')
      .attr('stroke', '#3498db')
      .attr('stroke-width', 2);
  }
  
  /**
   * Highlight an entire row (for showing point's similarities)
   * @param {number} rowIndex - Row to highlight
   */
  highlightRow(rowIndex) {
    this.cellsG.selectAll('rect')
      .attr('opacity', d => {
        if (rowIndex === null) return 1;
        return d.row === rowIndex ? 1 : 0.3;
      });
  }
  
  _onCellEnter(event, d, matrix) {
    const rect = event.target.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    
    this.tooltip
      .style('visibility', 'visible')
      .style('left', `${rect.left - containerRect.left + 10}px`)
      .style('top', `${rect.top - containerRect.top - 30}px`)
      .html(`p<sub>${d.row},${d.col}</sub> = ${d.value.toExponential(3)}`);
    
    this.highlightCell(d.row, d.col);
    
    if (this.onCellHover) {
      this.onCellHover(d.row, d.col, d.value);
    }
  }
  
  _onCellLeave(event, d) {
    this.tooltip.style('visibility', 'hidden');
    this.highlightCell(null, null);
  }
  
  _onCellClick(event, d) {
    if (this.onCellClick) {
      this.onCellClick(d.row, d.col, d.value);
    }
  }
  
  /**
   * Set the title
   */
  setTitle(title) {
    this.title = title;
    this.svg.select('.chart-title').text(title);
  }
  
  /**
   * Set the color scheme
   */
  setColorScheme(scheme) {
    this.colorScheme = scheme;
  }
}

/**
 * Side-by-side comparison of two matrices
 */
export class MatrixComparison {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.width = options.width || 600;
    this.height = options.height || 280;
    this.gap = options.gap || 40;
    
    this._createLayout();
  }
  
  _createLayout() {
    d3.select(this.container).selectAll('*').remove();
    
    const wrapper = d3.select(this.container)
      .append('div')
      .attr('class', 'matrix-comparison')
      .style('display', 'flex')
      .style('gap', `${this.gap}px`)
      .style('justify-content', 'center');
    
    this.leftContainer = wrapper.append('div')
      .attr('class', 'matrix-left')
      .style('position', 'relative')
      .node();
    
    this.rightContainer = wrapper.append('div')
      .attr('class', 'matrix-right')
      .style('position', 'relative')
      .node();
    
    const matrixWidth = (this.width - this.gap) / 2;
    
    this.leftHeatmap = new Heatmap(this.leftContainer, {
      width: matrixWidth,
      height: this.height,
      title: 'P (High-D)',
      colorScheme: 'blues'
    });
    
    this.rightHeatmap = new Heatmap(this.rightContainer, {
      width: matrixWidth,
      height: this.height,
      title: 'Q (Low-D)',
      colorScheme: 'greens'
    });
  }
  
  /**
   * Update both matrices
   * @param {number[][]} P - P matrix
   * @param {number[][]} Q - Q matrix
   * @param {number[]} labels - Labels for coloring
   */
  update(P, Q, labels = null) {
    if (P) this.leftHeatmap.update(P, labels);
    if (Q) this.rightHeatmap.update(Q, labels);
  }
  
  /**
   * Highlight corresponding cells in both matrices
   */
  highlightCell(row, col) {
    this.leftHeatmap.highlightCell(row, col);
    this.rightHeatmap.highlightCell(row, col);
  }
  
  /**
   * Highlight a row in both matrices
   */
  highlightRow(rowIndex) {
    this.leftHeatmap.highlightRow(rowIndex);
    this.rightHeatmap.highlightRow(rowIndex);
  }
}
