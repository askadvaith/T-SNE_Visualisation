/**
 * 2D Scatter Plot Visualization
 * Renders points in 2D space and 1D number line for embeddings
 */

import * as d3 from 'd3';
import { getLabelColor } from '../core/data-generator.js';

/**
 * Create a 2D scatter plot
 */
export class Scatter2D {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    this.width = options.width || 400;
    this.height = options.height || 400;
    this.margin = options.margin || { top: 20, right: 20, bottom: 30, left: 40 };
    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;
    
    this.highlightedPoint = null;
    this.onPointHover = options.onPointHover || null;
    this.onPointClick = options.onPointClick || null;
    this.showGradients = options.showGradients || false;
    this.title = options.title || '';
    
    this._createSVG();
  }
  
  _createSVG() {
    // Clear existing
    d3.select(this.container).selectAll('*').remove();
    
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'scatter-2d');
    
    // Title
    if (this.title) {
      this.svg.append('text')
        .attr('x', this.width / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .attr('class', 'chart-title')
        .text(this.title);
    }
    
    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    // Axes groups
    this.xAxisG = this.g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.innerHeight})`);
    
    this.yAxisG = this.g.append('g')
      .attr('class', 'y-axis');
    
    // Gradient arrows group (below points)
    this.gradientG = this.g.append('g')
      .attr('class', 'gradients');
    
    // Points group
    this.pointsG = this.g.append('g')
      .attr('class', 'points');
    
    // Connection lines group (for highlighting neighbors)
    this.connectionsG = this.g.append('g')
      .attr('class', 'connections');
    
    // Arrow marker for gradients
    this.svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#666');
  }
  
  /**
   * Update the scatter plot with new data
   * @param {number[][]} points - Array of [x, y] coordinates
   * @param {number[]} labels - Array of cluster labels
   * @param {object} options - Additional options
   */
  update(points, labels, options = {}) {
    if (!points || points.length === 0) return;
    
    const gradients = options.gradients || null;
    const is1D = points[0].length === 1;
    
    // Handle 1D data by adding y=0
    const data = points.map((p, i) => ({
      x: is1D ? p[0] : p[0],
      y: is1D ? 0 : p[1],
      label: labels ? labels[i] : 0,
      index: i,
      gradient: gradients ? gradients[i] : null
    }));
    
    // Compute scales with padding
    const xExtent = d3.extent(data, d => d.x);
    const yExtent = is1D ? [-1, 1] : d3.extent(data, d => d.y);
    
    const xPadding = (xExtent[1] - xExtent[0]) * 0.1 || 1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1 || 1;
    
    this.xScale = d3.scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, this.innerWidth]);
    
    this.yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([this.innerHeight, 0]);
    
    // Update axes
    this.xAxisG.transition().duration(300)
      .call(d3.axisBottom(this.xScale).ticks(5));
    
    if (!is1D) {
      this.yAxisG.transition().duration(300)
        .call(d3.axisLeft(this.yScale).ticks(5));
    }
    
    // Draw gradients if provided
    if (gradients && this.showGradients) {
      this._drawGradients(data);
    } else {
      this.gradientG.selectAll('*').remove();
    }
    
    // Draw points
    const circles = this.pointsG.selectAll('circle')
      .data(data, d => d.index);
    
    // Enter
    circles.enter()
      .append('circle')
      .attr('cx', d => this.xScale(d.x))
      .attr('cy', d => this.yScale(d.y))
      .attr('r', 0)
      .attr('fill', d => getLabelColor(d.label))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.8)
      .attr('class', 'data-point')
      .on('mouseenter', (event, d) => this._onPointEnter(event, d))
      .on('mouseleave', (event, d) => this._onPointLeave(event, d))
      .on('click', (event, d) => this._onPointClick(event, d))
      .transition()
      .duration(300)
      .attr('r', 6);
    
    // Update
    circles.transition()
      .duration(300)
      .attr('cx', d => this.xScale(d.x))
      .attr('cy', d => this.yScale(d.y))
      .attr('fill', d => getLabelColor(d.label));
    
    // Exit
    circles.exit()
      .transition()
      .duration(200)
      .attr('r', 0)
      .remove();
  }
  
  _drawGradients(data) {
    const gradientScale = 0.5; // Scale factor for visibility
    
    const arrows = this.gradientG.selectAll('line')
      .data(data.filter(d => d.gradient), d => d.index);
    
    arrows.enter()
      .append('line')
      .attr('class', 'gradient-arrow')
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)')
      .merge(arrows)
      .transition()
      .duration(300)
      .attr('x1', d => this.xScale(d.x))
      .attr('y1', d => this.yScale(d.y))
      .attr('x2', d => {
        const gx = d.gradient[0] * gradientScale;
        return this.xScale(d.x - gx); // Negative because gradient points uphill
      })
      .attr('y2', d => {
        const gy = d.gradient.length > 1 ? d.gradient[1] * gradientScale : 0;
        return this.yScale(d.y - gy);
      });
    
    arrows.exit().remove();
  }
  
  /**
   * Highlight a specific point
   * @param {number} index - Point index to highlight
   */
  highlightPoint(index) {
    this.highlightedPoint = index;
    
    this.pointsG.selectAll('circle')
      .attr('r', d => d.index === index ? 10 : 6)
      .attr('stroke-width', d => d.index === index ? 3 : 1.5)
      .attr('stroke', d => d.index === index ? '#000' : '#fff');
  }
  
  /**
   * Show connections from a point to its neighbors
   * @param {number} fromIndex - Source point index
   * @param {number[][]} points - All points
   * @param {number[]} similarities - Similarity values to each point
   */
  showConnections(fromIndex, points, similarities) {
    this.connectionsG.selectAll('*').remove();
    
    if (fromIndex === null || !similarities) return;
    
    const fromPoint = points[fromIndex];
    const is1D = fromPoint.length === 1;
    
    // Get top connections
    const connections = similarities
      .map((sim, i) => ({ to: i, similarity: sim }))
      .filter(c => c.to !== fromIndex && c.similarity > 0.01)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
    
    const maxSim = Math.max(...connections.map(c => c.similarity));
    
    connections.forEach(conn => {
      const toPoint = points[conn.to];
      
      this.connectionsG.append('line')
        .attr('x1', this.xScale(is1D ? fromPoint[0] : fromPoint[0]))
        .attr('y1', this.yScale(is1D ? 0 : fromPoint[1]))
        .attr('x2', this.xScale(is1D ? toPoint[0] : toPoint[0]))
        .attr('y2', this.yScale(is1D ? 0 : toPoint[1]))
        .attr('stroke', '#3498db')
        .attr('stroke-width', (conn.similarity / maxSim) * 3 + 0.5)
        .attr('opacity', 0.6);
    });
  }
  
  /**
   * Clear all connections
   */
  clearConnections() {
    this.connectionsG.selectAll('*').remove();
  }
  
  _onPointEnter(event, d) {
    this.highlightPoint(d.index);
    if (this.onPointHover) {
      this.onPointHover(d.index, d);
    }
  }
  
  _onPointLeave(event, d) {
    this.highlightPoint(null);
    this.pointsG.selectAll('circle')
      .attr('r', 6)
      .attr('stroke-width', 1.5)
      .attr('stroke', '#fff');
  }
  
  _onPointClick(event, d) {
    if (this.onPointClick) {
      this.onPointClick(d.index, d);
    }
  }
  
  /**
   * Set title
   */
  setTitle(title) {
    this.title = title;
    this.svg.select('.chart-title').text(title);
  }
  
  /**
   * Resize the chart
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.innerWidth = width - this.margin.left - this.margin.right;
    this.innerHeight = height - this.margin.top - this.margin.bottom;
    
    this.svg
      .attr('width', width)
      .attr('height', height);
    
    this.xAxisG.attr('transform', `translate(0,${this.innerHeight})`);
  }
}

/**
 * Create a 1D number line visualization
 */
export class NumberLine1D {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    this.width = options.width || 400;
    this.height = options.height || 80;
    this.margin = options.margin || { top: 20, right: 20, bottom: 30, left: 20 };
    this.title = options.title || '';
    
    this._createSVG();
  }
  
  _createSVG() {
    d3.select(this.container).selectAll('*').remove();
    
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'number-line-1d');
    
    if (this.title) {
      this.svg.append('text')
        .attr('x', this.width / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .attr('class', 'chart-title')
        .text(this.title);
    }
    
    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    this.axisG = this.g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.height - this.margin.top - this.margin.bottom})`);
    
    this.pointsG = this.g.append('g')
      .attr('class', 'points');
  }
  
  /**
   * Update the number line with new 1D data
   * @param {number[]} values - Array of 1D values
   * @param {number[]} labels - Array of cluster labels
   */
  update(values, labels) {
    if (!values || values.length === 0) return;
    
    const data = values.map((v, i) => ({
      value: Array.isArray(v) ? v[0] : v,
      label: labels ? labels[i] : 0,
      index: i
    }));
    
    const extent = d3.extent(data, d => d.value);
    const padding = (extent[1] - extent[0]) * 0.1 || 1;
    
    this.xScale = d3.scaleLinear()
      .domain([extent[0] - padding, extent[1] + padding])
      .range([0, this.width - this.margin.left - this.margin.right]);
    
    const yPos = (this.height - this.margin.top - this.margin.bottom) / 2;
    
    this.axisG
      .attr('transform', `translate(0,${yPos + 15})`)
      .call(d3.axisBottom(this.xScale).ticks(7));
    
    // Draw line
    this.g.selectAll('.baseline').remove();
    this.g.append('line')
      .attr('class', 'baseline')
      .attr('x1', 0)
      .attr('x2', this.width - this.margin.left - this.margin.right)
      .attr('y1', yPos)
      .attr('y2', yPos)
      .attr('stroke', '#ccc')
      .attr('stroke-width', 2);
    
    // Draw points
    const circles = this.pointsG.selectAll('circle')
      .data(data, d => d.index);
    
    circles.enter()
      .append('circle')
      .attr('cx', d => this.xScale(d.value))
      .attr('cy', yPos)
      .attr('r', 0)
      .attr('fill', d => getLabelColor(d.label))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .transition()
      .duration(300)
      .attr('r', 6);
    
    circles.transition()
      .duration(300)
      .attr('cx', d => this.xScale(d.value))
      .attr('cy', yPos);
    
    circles.exit()
      .transition()
      .duration(200)
      .attr('r', 0)
      .remove();
  }
}
