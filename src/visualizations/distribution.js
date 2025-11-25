/**
 * Distribution Visualization
 * Shows Gaussian and Student's t-distributions for probability calculations
 */

import * as d3 from 'd3';
import { gaussianPDF, studentTPDF } from '../core/math-utils.js';

/**
 * Gaussian distribution curve with sigma visualization
 */
export class GaussianDistribution {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.width = options.width || 400;
    this.height = options.height || 200;
    this.margin = options.margin || { top: 30, right: 20, bottom: 40, left: 50 };
    this.title = options.title || 'Gaussian Kernel';
    
    this._createSVG();
  }
  
  _createSVG() {
    d3.select(this.container).selectAll('*').remove();
    
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'gaussian-distribution');
    
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
    
    // Axes groups
    this.xAxisG = this.g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.innerHeight})`);
    
    this.yAxisG = this.g.append('g')
      .attr('class', 'y-axis');
    
    // Path for the distribution curve
    this.curvePath = this.g.append('path')
      .attr('class', 'distribution-curve')
      .attr('fill', 'none')
      .attr('stroke', '#3498db')
      .attr('stroke-width', 2);
    
    // Area fill
    this.areaPath = this.g.append('path')
      .attr('class', 'distribution-area')
      .attr('fill', 'rgba(52, 152, 219, 0.2)');
    
    // Sigma markers
    this.sigmaG = this.g.append('g')
      .attr('class', 'sigma-markers');
    
    // Points group
    this.pointsG = this.g.append('g')
      .attr('class', 'points');
    
    // Label for sigma
    this.sigmaLabel = this.g.append('text')
      .attr('class', 'sigma-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#666');
  }
  
  /**
   * Update the Gaussian distribution visualization
   * @param {number} sigma - Standard deviation
   * @param {number} mu - Mean (center)
   * @param {object[]} points - Array of {distance, probability} for marked points
   * @param {object} options - Additional options
   */
  update(sigma, mu = 0, points = [], options = {}) {
    const xRange = sigma * 4;
    const xMin = mu - xRange;
    const xMax = mu + xRange;
    
    // X scale
    this.xScale = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, this.innerWidth]);
    
    // Generate curve data
    const numPoints = 100;
    const curveData = [];
    for (let i = 0; i <= numPoints; i++) {
      const x = xMin + (xMax - xMin) * (i / numPoints);
      const y = gaussianPDF(x, mu, sigma);
      curveData.push({ x, y });
    }
    
    // Y scale based on curve
    const yMax = gaussianPDF(mu, mu, sigma) * 1.1;
    this.yScale = d3.scaleLinear()
      .domain([0, yMax])
      .range([this.innerHeight, 0]);
    
    // Update axes
    this.xAxisG.call(d3.axisBottom(this.xScale).ticks(7).tickFormat(d => d.toFixed(1)));
    this.yAxisG.call(d3.axisLeft(this.yScale).ticks(5).tickFormat(d => d.toFixed(2)));
    
    // X axis label
    this.g.selectAll('.x-label').remove();
    this.g.append('text')
      .attr('class', 'x-label')
      .attr('x', this.innerWidth / 2)
      .attr('y', this.innerHeight + 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#666')
      .text('Distance from point i');
    
    // Create line generator
    const line = d3.line()
      .x(d => this.xScale(d.x))
      .y(d => this.yScale(d.y))
      .curve(d3.curveMonotoneX);
    
    // Create area generator
    const area = d3.area()
      .x(d => this.xScale(d.x))
      .y0(this.innerHeight)
      .y1(d => this.yScale(d.y))
      .curve(d3.curveMonotoneX);
    
    // Update curve
    this.curvePath
      .datum(curveData)
      .transition()
      .duration(300)
      .attr('d', line);
    
    // Update area
    this.areaPath
      .datum(curveData)
      .transition()
      .duration(300)
      .attr('d', area);
    
    // Draw sigma markers
    this._drawSigmaMarkers(mu, sigma);
    
    // Draw data points on the curve
    this._drawPoints(points, mu, sigma);
    
    // Update sigma label
    this.sigmaLabel
      .attr('x', this.innerWidth / 2)
      .attr('y', -5)
      .text(`σ = ${sigma.toFixed(3)}`);
  }
  
  _drawSigmaMarkers(mu, sigma) {
    this.sigmaG.selectAll('*').remove();
    
    // Center line
    this.sigmaG.append('line')
      .attr('x1', this.xScale(mu))
      .attr('x2', this.xScale(mu))
      .attr('y1', 0)
      .attr('y2', this.innerHeight)
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');
    
    // ±1σ markers
    [-1, 1].forEach(mult => {
      const xPos = mu + mult * sigma;
      
      this.sigmaG.append('line')
        .attr('x1', this.xScale(xPos))
        .attr('x2', this.xScale(xPos))
        .attr('y1', 0)
        .attr('y2', this.innerHeight)
        .attr('stroke', '#95a5a6')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');
      
      this.sigmaG.append('text')
        .attr('x', this.xScale(xPos))
        .attr('y', this.innerHeight - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#666')
        .text(`${mult > 0 ? '+' : ''}${mult}σ`);
    });
  }
  
  _drawPoints(points, mu, sigma) {
    if (!points || points.length === 0) {
      this.pointsG.selectAll('*').remove();
      return;
    }
    
    const circles = this.pointsG.selectAll('circle')
      .data(points, (d, i) => i);
    
    circles.enter()
      .append('circle')
      .attr('r', 4)
      .attr('fill', d => d.color || '#e74c3c')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .merge(circles)
      .transition()
      .duration(200)
      .attr('cx', d => this.xScale(d.distance))
      .attr('cy', d => this.yScale(gaussianPDF(d.distance, mu, sigma)));
    
    circles.exit().remove();
    
    // Add labels for top points
    const labels = this.pointsG.selectAll('text')
      .data(points.slice(0, 5), (d, i) => i);
    
    labels.enter()
      .append('text')
      .attr('font-size', '9px')
      .attr('fill', '#666')
      .merge(labels)
      .transition()
      .duration(200)
      .attr('x', d => this.xScale(d.distance) + 5)
      .attr('y', d => this.yScale(gaussianPDF(d.distance, mu, sigma)) - 5)
      .text(d => d.label || '');
    
    labels.exit().remove();
  }
  
  setTitle(title) {
    this.title = title;
    this.svg.select('.chart-title').text(title);
  }
}

/**
 * Comparison of Gaussian vs Student's t-distribution
 */
export class DistributionComparison {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.width = options.width || 450;
    this.height = options.height || 220;
    this.margin = options.margin || { top: 30, right: 20, bottom: 40, left: 50 };
    this.title = options.title || 'Gaussian vs t-Distribution';
    
    this._createSVG();
  }
  
  _createSVG() {
    d3.select(this.container).selectAll('*').remove();
    
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'distribution-comparison');
    
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
    
    // Axes groups
    this.xAxisG = this.g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.innerHeight})`);
    
    this.yAxisG = this.g.append('g')
      .attr('class', 'y-axis');
    
    // Paths
    this.gaussianPath = this.g.append('path')
      .attr('class', 'gaussian-curve')
      .attr('fill', 'none')
      .attr('stroke', '#3498db')
      .attr('stroke-width', 2);
    
    this.tPath = this.g.append('path')
      .attr('class', 't-curve')
      .attr('fill', 'none')
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2);
    
    // Legend
    this._createLegend();
    
    // Initial render
    this.update();
  }
  
  _createLegend() {
    const legend = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${this.width - 120}, 35)`);
    
    // Gaussian
    legend.append('line')
      .attr('x1', 0).attr('x2', 20)
      .attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#3498db')
      .attr('stroke-width', 2);
    legend.append('text')
      .attr('x', 25).attr('y', 4)
      .attr('font-size', '11px')
      .text('Gaussian');
    
    // t-distribution
    legend.append('line')
      .attr('x1', 0).attr('x2', 20)
      .attr('y1', 15).attr('y2', 15)
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2);
    legend.append('text')
      .attr('x', 25).attr('y', 19)
      .attr('font-size', '11px')
      .text('t-dist (df=1)');
  }
  
  /**
   * Update the distribution comparison
   * @param {number} sigma - Standard deviation for Gaussian (default 1)
   */
  update(sigma = 1) {
    const xRange = 5;
    
    // Scales
    this.xScale = d3.scaleLinear()
      .domain([-xRange, xRange])
      .range([0, this.innerWidth]);
    
    // Generate curve data
    const numPoints = 200;
    const gaussianData = [];
    const tData = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const x = -xRange + (2 * xRange) * (i / numPoints);
      gaussianData.push({ x, y: gaussianPDF(x, 0, sigma) });
      tData.push({ x, y: studentTPDF(x) });
    }
    
    // Y scale
    const yMax = Math.max(
      gaussianPDF(0, 0, sigma),
      studentTPDF(0)
    ) * 1.1;
    
    this.yScale = d3.scaleLinear()
      .domain([0, yMax])
      .range([this.innerHeight, 0]);
    
    // Update axes
    this.xAxisG.call(d3.axisBottom(this.xScale).ticks(9));
    this.yAxisG.call(d3.axisLeft(this.yScale).ticks(5));
    
    // X axis label
    this.g.selectAll('.x-label').remove();
    this.g.append('text')
      .attr('class', 'x-label')
      .attr('x', this.innerWidth / 2)
      .attr('y', this.innerHeight + 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#666')
      .text('Distance');
    
    // Line generator
    const line = d3.line()
      .x(d => this.xScale(d.x))
      .y(d => this.yScale(d.y))
      .curve(d3.curveMonotoneX);
    
    // Update curves
    this.gaussianPath
      .datum(gaussianData)
      .transition()
      .duration(300)
      .attr('d', line);
    
    this.tPath
      .datum(tData)
      .transition()
      .duration(300)
      .attr('d', line);
  }
  
  /**
   * Highlight the heavy tails of t-distribution
   */
  highlightTails() {
    // Add shaded regions showing the tail difference
    const tailThreshold = 2;
    
    this.g.selectAll('.tail-highlight').remove();
    
    // Left tail
    this.g.append('rect')
      .attr('class', 'tail-highlight')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.xScale(-tailThreshold))
      .attr('height', this.innerHeight)
      .attr('fill', 'rgba(231, 76, 60, 0.1)');
    
    // Right tail
    this.g.append('rect')
      .attr('class', 'tail-highlight')
      .attr('x', this.xScale(tailThreshold))
      .attr('y', 0)
      .attr('width', this.innerWidth - this.xScale(tailThreshold))
      .attr('height', this.innerHeight)
      .attr('fill', 'rgba(231, 76, 60, 0.1)');
  }
}

/**
 * Binary search visualization for finding sigma
 */
export class SigmaSearchViz {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.width = options.width || 400;
    this.height = options.height || 180;
    this.margin = options.margin || { top: 30, right: 20, bottom: 40, left: 60 };
    this.title = options.title || 'Binary Search for σ';
    
    this._createSVG();
  }
  
  _createSVG() {
    d3.select(this.container).selectAll('*').remove();
    
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'sigma-search');
    
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
    
    // Path for perplexity vs sigma
    this.curvePath = this.g.append('path')
      .attr('class', 'perp-curve')
      .attr('fill', 'none')
      .attr('stroke', '#3498db')
      .attr('stroke-width', 2);
    
    // Target line
    this.targetLine = this.g.append('line')
      .attr('class', 'target-line')
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');
    
    // Search points
    this.searchPointsG = this.g.append('g')
      .attr('class', 'search-points');
  }
  
  /**
   * Update with binary search steps
   * @param {object[]} searchSteps - Array of {sigma, perplexity} from binary search
   * @param {number} targetPerplexity - Target perplexity value
   */
  update(searchSteps, targetPerplexity) {
    if (!searchSteps || searchSteps.length === 0) return;
    
    // Get sigma range from search steps
    const sigmaExtent = d3.extent(searchSteps, d => d.sigma);
    const perpExtent = d3.extent(searchSteps, d => d.perplexity);
    
    // Extend ranges a bit
    const sigmaMin = Math.max(0.001, sigmaExtent[0] * 0.5);
    const sigmaMax = sigmaExtent[1] * 2;
    
    // Scales
    this.xScale = d3.scaleLog()
      .domain([sigmaMin, sigmaMax])
      .range([0, this.innerWidth]);
    
    this.yScale = d3.scaleLinear()
      .domain([0, Math.max(perpExtent[1] * 1.2, targetPerplexity * 1.5)])
      .range([this.innerHeight, 0]);
    
    // Update axes
    this.xAxisG.call(d3.axisBottom(this.xScale).ticks(5).tickFormat(d => d.toFixed(2)));
    this.yAxisG.call(d3.axisLeft(this.yScale).ticks(5));
    
    // Labels
    this.g.selectAll('.x-label').remove();
    this.g.append('text')
      .attr('class', 'x-label')
      .attr('x', this.innerWidth / 2)
      .attr('y', this.innerHeight + 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .text('σ (log scale)');
    
    this.g.selectAll('.y-label').remove();
    this.g.append('text')
      .attr('class', 'y-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.innerHeight / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .text('Perplexity');
    
    // Target line
    this.targetLine
      .attr('x1', 0)
      .attr('x2', this.innerWidth)
      .attr('y1', this.yScale(targetPerplexity))
      .attr('y2', this.yScale(targetPerplexity));
    
    // Target label
    this.g.selectAll('.target-label').remove();
    this.g.append('text')
      .attr('class', 'target-label')
      .attr('x', this.innerWidth - 5)
      .attr('y', this.yScale(targetPerplexity) - 5)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('fill', '#e74c3c')
      .text(`Target: ${targetPerplexity}`);
    
    // Draw search points with connecting line
    const line = d3.line()
      .x(d => this.xScale(d.sigma))
      .y(d => this.yScale(d.perplexity))
      .curve(d3.curveMonotoneX);
    
    this.curvePath
      .datum(searchSteps)
      .transition()
      .duration(300)
      .attr('d', line);
    
    // Draw points
    const points = this.searchPointsG.selectAll('circle')
      .data(searchSteps, (d, i) => i);
    
    points.enter()
      .append('circle')
      .attr('r', 4)
      .attr('fill', (d, i) => i === searchSteps.length - 1 ? '#2ecc71' : '#3498db')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .merge(points)
      .transition()
      .duration(300)
      .attr('cx', d => this.xScale(d.sigma))
      .attr('cy', d => this.yScale(d.perplexity))
      .attr('fill', (d, i) => i === searchSteps.length - 1 ? '#2ecc71' : '#3498db');
    
    points.exit().remove();
  }
}
