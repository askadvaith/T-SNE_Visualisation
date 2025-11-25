/**
 * Gradient Field Visualization
 * Shows force vectors and gradient directions during optimization
 */

import * as d3 from 'd3';
import { getLabelColor } from '../core/data-generator.js';
import { gradientMagnitude } from '../core/math-utils.js';

/**
 * Gradient/Force field visualization overlaid on scatter plot
 */
export class GradientField {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.width = options.width || 400;
    this.height = options.height || 400;
    this.margin = options.margin || { top: 30, right: 20, bottom: 30, left: 40 };
    this.title = options.title || 'Gradient Forces';
    
    this.showAttractive = options.showAttractive !== false;
    this.showRepulsive = options.showRepulsive !== false;
    
    this._createSVG();
  }
  
  _createSVG() {
    d3.select(this.container).selectAll('*').remove();
    
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'gradient-field');
    
    // Title
    this.svg.append('text')
      .attr('x', this.width / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('class', 'chart-title')
      .text(this.title);
    
    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;
    
    // Layers
    this.forceArrowsG = this.g.append('g').attr('class', 'force-arrows');
    this.gradientArrowsG = this.g.append('g').attr('class', 'gradient-arrows');
    this.pointsG = this.g.append('g').attr('class', 'points');
    
    // Arrow markers
    const defs = this.svg.append('defs');
    
    // Gradient arrow (gray)
    defs.append('marker')
      .attr('id', 'gradient-arrow')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#2c3e50');
    
    // Attractive force (green)
    defs.append('marker')
      .attr('id', 'attractive-arrow')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#27ae60');
    
    // Repulsive force (red)
    defs.append('marker')
      .attr('id', 'repulsive-arrow')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#e74c3c');
  }
  
  /**
   * Update the gradient field visualization
   * @param {number[][]} Y - Current embedding positions
   * @param {number[][]} gradient - Gradient for each point
   * @param {number[]} labels - Cluster labels
   * @param {object} options - Additional options
   */
  update(Y, gradient, labels, options = {}) {
    if (!Y || Y.length === 0) return;
    
    const is1D = Y[0].length === 1;
    
    // Prepare data
    const data = Y.map((pos, i) => ({
      x: pos[0],
      y: is1D ? 0 : pos[1],
      gx: gradient ? gradient[i][0] : 0,
      gy: gradient && gradient[i].length > 1 ? gradient[i][1] : 0,
      label: labels ? labels[i] : 0,
      index: i
    }));
    
    // Compute scales
    const xExtent = d3.extent(data, d => d.x);
    const yExtent = is1D ? [-1, 1] : d3.extent(data, d => d.y);
    
    const xPadding = (xExtent[1] - xExtent[0]) * 0.15 || 1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.15 || 1;
    
    this.xScale = d3.scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, this.innerWidth]);
    
    this.yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([this.innerHeight, 0]);
    
    // Compute gradient scale for visualization
    if (gradient) {
      const maxMag = Math.max(...gradient.map(g => gradientMagnitude(g)));
      this.gradientScale = maxMag > 0 ? 30 / maxMag : 1;
    }
    
    // Draw points
    this._drawPoints(data);
    
    // Draw gradient arrows
    if (gradient) {
      this._drawGradientArrows(data);
    }
  }
  
  _drawPoints(data) {
    const circles = this.pointsG.selectAll('circle')
      .data(data, d => d.index);
    
    circles.enter()
      .append('circle')
      .attr('r', 6)
      .attr('fill', d => getLabelColor(d.label))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.8)
      .merge(circles)
      .transition()
      .duration(200)
      .attr('cx', d => this.xScale(d.x))
      .attr('cy', d => this.yScale(d.y));
    
    circles.exit().remove();
  }
  
  _drawGradientArrows(data) {
    const arrows = this.gradientArrowsG.selectAll('line')
      .data(data, d => d.index);
    
    arrows.enter()
      .append('line')
      .attr('class', 'gradient-arrow')
      .attr('stroke', '#2c3e50')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#gradient-arrow)')
      .merge(arrows)
      .transition()
      .duration(200)
      .attr('x1', d => this.xScale(d.x))
      .attr('y1', d => this.yScale(d.y))
      .attr('x2', d => {
        // Gradient points uphill, we want to move downhill (negative gradient direction)
        return this.xScale(d.x) - d.gx * this.gradientScale;
      })
      .attr('y2', d => {
        return this.yScale(d.y) + d.gy * this.gradientScale;
      })
      .attr('opacity', d => {
        const mag = Math.sqrt(d.gx * d.gx + d.gy * d.gy);
        return Math.min(1, mag * this.gradientScale / 10 + 0.3);
      });
    
    arrows.exit().remove();
  }
  
  /**
   * Show detailed force breakdown for a single point
   * @param {number} pointIndex - Index of the point to analyze
   * @param {number[][]} Y - All positions
   * @param {number[][]} P - P matrix
   * @param {number[][]} Q - Q matrix
   * @param {number[]} labels - Labels
   */
  showForceBreakdown(pointIndex, Y, P, Q, labels) {
    this.forceArrowsG.selectAll('*').remove();
    
    if (pointIndex === null || !P || !Q) return;
    
    const yi = Y[pointIndex];
    const is1D = yi.length === 1;
    
    // Show top attractive and repulsive forces
    const forces = [];
    for (let j = 0; j < Y.length; j++) {
      if (j !== pointIndex) {
        const yj = Y[j];
        const pij = P[pointIndex][j];
        const qij = Q[pointIndex][j];
        const diff = pij - qij;
        
        forces.push({
          j,
          pij,
          qij,
          diff,
          isAttractive: diff > 0,
          magnitude: Math.abs(diff),
          dx: yi[0] - yj[0],
          dy: is1D ? 0 : yi[1] - yj[1]
        });
      }
    }
    
    // Sort by magnitude and take top forces
    forces.sort((a, b) => b.magnitude - a.magnitude);
    const topForces = forces.slice(0, 8);
    
    const maxMag = Math.max(...topForces.map(f => f.magnitude));
    const forceScale = maxMag > 0 ? 40 / maxMag : 1;
    
    topForces.forEach(force => {
      const dist = Math.sqrt(force.dx * force.dx + force.dy * force.dy);
      if (dist < 0.001) return;
      
      // Normalize direction
      const nx = force.dx / dist;
      const ny = force.dy / dist;
      
      // Arrow length based on force magnitude
      const len = force.magnitude * forceScale;
      
      // For attractive forces, arrow points toward the other point (opposite direction)
      // For repulsive forces, arrow points away
      const dirMult = force.isAttractive ? -1 : 1;
      
      const x1 = this.xScale(yi[0]);
      const y1 = this.yScale(is1D ? 0 : yi[1]);
      const x2 = x1 + nx * len * dirMult;
      const y2 = y1 - ny * len * dirMult; // Subtract because y-axis is flipped
      
      this.forceArrowsG.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', force.isAttractive ? '#27ae60' : '#e74c3c')
        .attr('stroke-width', 1.5)
        .attr('marker-end', force.isAttractive ? 'url(#attractive-arrow)' : 'url(#repulsive-arrow)')
        .attr('opacity', 0.7);
    });
  }
  
  /**
   * Clear force breakdown arrows
   */
  clearForceBreakdown() {
    this.forceArrowsG.selectAll('*').remove();
  }
  
  setTitle(title) {
    this.title = title;
    this.svg.select('.chart-title').text(title);
  }
}

/**
 * KL Divergence / Cost over iterations chart
 */
export class CostChart {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.width = options.width || 350;
    this.height = options.height || 180;
    this.margin = options.margin || { top: 30, right: 20, bottom: 40, left: 60 };
    this.title = options.title || 'KL Divergence';
    
    this._createSVG();
  }
  
  _createSVG() {
    d3.select(this.container).selectAll('*').remove();
    
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'cost-chart');
    
    // Title
    this.svg.append('text')
      .attr('x', this.width / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('class', 'chart-title')
      .text(this.title);
    
    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;
    
    // Axes
    this.xAxisG = this.g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.innerHeight})`);
    
    this.yAxisG = this.g.append('g')
      .attr('class', 'y-axis');
    
    // Path
    this.linePath = this.g.append('path')
      .attr('class', 'cost-line')
      .attr('fill', 'none')
      .attr('stroke', '#9b59b6')
      .attr('stroke-width', 2);
    
    // Current position marker
    this.currentMarker = this.g.append('circle')
      .attr('class', 'current-marker')
      .attr('r', 5)
      .attr('fill', '#e74c3c')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('visibility', 'hidden');
    
    // Exaggeration phase indicator
    this.exaggerationRect = this.g.append('rect')
      .attr('class', 'exaggeration-phase')
      .attr('fill', 'rgba(241, 196, 15, 0.2)')
      .style('visibility', 'hidden');
  }
  
  /**
   * Update the cost chart
   * @param {object[]} costHistory - Array of {iteration, cost}
   * @param {number} exaggerationEnd - Iteration when exaggeration ends
   */
  update(costHistory, exaggerationEnd = 250) {
    if (!costHistory || costHistory.length === 0) return;
    
    // Scales
    const xExtent = d3.extent(costHistory, d => d.iteration);
    const yExtent = d3.extent(costHistory, d => d.cost);
    
    this.xScale = d3.scaleLinear()
      .domain([0, Math.max(xExtent[1], 10)])
      .range([0, this.innerWidth]);
    
    this.yScale = d3.scaleLinear()
      .domain([0, yExtent[1] * 1.1])
      .range([this.innerHeight, 0]);
    
    // Update axes
    this.xAxisG.call(d3.axisBottom(this.xScale).ticks(6));
    this.yAxisG.call(d3.axisLeft(this.yScale).ticks(5).tickFormat(d => d.toFixed(2)));
    
    // Labels
    this.g.selectAll('.x-label').remove();
    this.g.append('text')
      .attr('class', 'x-label')
      .attr('x', this.innerWidth / 2)
      .attr('y', this.innerHeight + 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .text('Iteration');
    
    // Line generator
    const line = d3.line()
      .x(d => this.xScale(d.iteration))
      .y(d => this.yScale(d.cost))
      .curve(d3.curveMonotoneX);
    
    // Update line
    this.linePath
      .datum(costHistory)
      .transition()
      .duration(100)
      .attr('d', line);
    
    // Update current marker
    const lastPoint = costHistory[costHistory.length - 1];
    this.currentMarker
      .style('visibility', 'visible')
      .transition()
      .duration(100)
      .attr('cx', this.xScale(lastPoint.iteration))
      .attr('cy', this.yScale(lastPoint.cost));
    
    // Show exaggeration phase
    if (exaggerationEnd && exaggerationEnd < xExtent[1]) {
      this.exaggerationRect
        .style('visibility', 'visible')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', this.xScale(exaggerationEnd))
        .attr('height', this.innerHeight);
    } else {
      this.exaggerationRect.style('visibility', 'hidden');
    }
  }
  
  /**
   * Add a label for the exaggeration phase
   */
  showExaggerationLabel() {
    this.g.selectAll('.exag-label').remove();
    this.g.append('text')
      .attr('class', 'exag-label')
      .attr('x', 5)
      .attr('y', 15)
      .attr('font-size', '10px')
      .attr('fill', '#f39c12')
      .text('Early Exaggeration');
  }
  
  setTitle(title) {
    this.title = title;
    this.svg.select('.chart-title').text(title);
  }
}
