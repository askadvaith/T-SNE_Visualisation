/**
 * 3D Scatter Plot Visualization using Three.js
 * Renders points in 3D space with interactive camera controls
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getLabelColor } from '../core/data-generator.js';

/**
 * Create an interactive 3D scatter plot
 */
export class Scatter3D {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    
    if (!this.container) {
      console.error('Scatter3D: Container not found');
      return;
    }
    
    this.width = options.width || 500;
    this.height = options.height || 400;
    this.backgroundColor = options.backgroundColor || 0x1a1a2e;
    this.pointSize = options.pointSize || 0.15;
    this.highlightedPoint = null;
    this.onPointClick = options.onPointClick || null;
    this.onPointHover = options.onPointHover || null;
    
    this.points = [];
    this.labels = [];
    this.pointMeshes = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this._init();
    this._animate();
  }
  
  _init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.backgroundColor);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.width / this.height,
      0.1,
      1000
    );
    this.camera.position.set(8, 6, 8);
    this.camera.lookAt(0, 0, 0);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
    
    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 1.2;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-10, -5, -10);
    this.scene.add(directionalLight2);
    
    // Grid helper
    this._addGrid();
    
    // Axis helper
    this._addAxes();
    
    // Event listeners
    this.renderer.domElement.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.renderer.domElement.addEventListener('click', (e) => this._onClick(e));
    this.renderer.domElement.addEventListener('mouseenter', () => {
      this.controls.autoRotate = false;
    });
    this.renderer.domElement.addEventListener('mouseleave', () => {
      this.controls.autoRotate = true;
    });
  }
  
  _addGrid() {
    // Create subtle grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x333333);
    gridHelper.position.y = -3;
    this.scene.add(gridHelper);
  }
  
  _addAxes() {
    const axisLength = 4;
    const axisGroup = new THREE.Group();
    
    // X axis (red)
    const xGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(axisLength, 0, 0)
    ]);
    const xMat = new THREE.LineBasicMaterial({ color: 0xff4444 });
    axisGroup.add(new THREE.Line(xGeom, xMat));
    
    // Y axis (green)
    const yGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, axisLength, 0)
    ]);
    const yMat = new THREE.LineBasicMaterial({ color: 0x44ff44 });
    axisGroup.add(new THREE.Line(yGeom, yMat));
    
    // Z axis (blue)
    const zGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, axisLength)
    ]);
    const zMat = new THREE.LineBasicMaterial({ color: 0x4444ff });
    axisGroup.add(new THREE.Line(zGeom, zMat));
    
    // Labels
    this._addAxisLabel('X', axisLength + 0.3, 0, 0, 0xff4444);
    this._addAxisLabel('Y', 0, axisLength + 0.3, 0, 0x44ff44);
    this._addAxisLabel('Z', 0, 0, axisLength + 0.3, 0x4444ff);
    
    this.scene.add(axisGroup);
  }
  
  _addAxisLabel(text, x, y, z, color) {
    // Using sprite for text label
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(0.5, 0.5, 0.5);
    
    this.scene.add(sprite);
  }
  
  _animate() {
    this.animationId = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Update the scatter plot with new data
   * @param {number[][]} points - Array of [x, y, z] coordinates
   * @param {number[]} labels - Array of cluster labels
   * @param {object} options - Additional options
   */
  update(points, labels, options = {}) {
    if (!points || points.length === 0) return;
    
    this.points = points;
    this.labels = labels || points.map(() => 0);
    
    // Clear existing point meshes
    this.pointMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.pointMeshes = [];
    
    // Calculate center and scale
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    points.forEach(p => {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
      minZ = Math.min(minZ, p[2]);
      maxZ = Math.max(maxZ, p[2]);
    });
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const rangeZ = maxZ - minZ || 1;
    const maxRange = Math.max(rangeX, rangeY, rangeZ);
    const scale = 6 / maxRange; // Fit within a 6-unit cube
    
    // Create point spheres
    const geometry = new THREE.SphereGeometry(this.pointSize, 16, 16);
    
    points.forEach((p, i) => {
      const color = new THREE.Color(getLabelColor(this.labels[i]));
      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.2,
        shininess: 50
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        (p[0] - centerX) * scale,
        (p[1] - centerY) * scale,
        (p[2] - centerZ) * scale
      );
      mesh.userData = { index: i, label: this.labels[i] };
      
      this.scene.add(mesh);
      this.pointMeshes.push(mesh);
    });
    
    // Update camera to look at center
    this.controls.target.set(0, 0, 0);
  }
  
  /**
   * Highlight a specific point
   * @param {number} index - Point index to highlight
   */
  highlightPoint(index) {
    // Reset all points
    this.pointMeshes.forEach((mesh, i) => {
      const scale = i === index ? 1.8 : 1;
      mesh.scale.set(scale, scale, scale);
      
      if (i === index) {
        mesh.material.emissiveIntensity = 0.6;
      } else {
        mesh.material.emissiveIntensity = 0.2;
      }
    });
    
    this.highlightedPoint = index;
  }
  
  /**
   * Show connections from a point to its neighbors
   * @param {number} fromIndex - Source point index
   * @param {number[]} similarities - Similarity values to each point
   */
  showConnections(fromIndex, similarities) {
    // Clear existing connections
    this.clearConnections();
    
    if (fromIndex === null || !similarities) return;
    
    const fromMesh = this.pointMeshes[fromIndex];
    if (!fromMesh) return;
    
    // Get top connections
    const connections = similarities
      .map((sim, i) => ({ to: i, similarity: sim }))
      .filter(c => c.to !== fromIndex && c.similarity > 0.01)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8);
    
    const maxSim = Math.max(...connections.map(c => c.similarity));
    
    this.connectionLines = [];
    
    connections.forEach(conn => {
      const toMesh = this.pointMeshes[conn.to];
      if (!toMesh) return;
      
      const geometry = new THREE.BufferGeometry().setFromPoints([
        fromMesh.position,
        toMesh.position
      ]);
      
      const material = new THREE.LineBasicMaterial({
        color: 0x3498db,
        opacity: 0.6 * (conn.similarity / maxSim),
        transparent: true,
        linewidth: 2
      });
      
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.connectionLines.push(line);
    });
  }
  
  /**
   * Clear all connection lines
   */
  clearConnections() {
    if (this.connectionLines) {
      this.connectionLines.forEach(line => {
        this.scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
      });
      this.connectionLines = [];
    }
  }
  
  _onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.pointMeshes);
    
    if (intersects.length > 0) {
      const idx = intersects[0].object.userData.index;
      this.highlightPoint(idx);
      
      if (this.onPointHover) {
        this.onPointHover(idx, intersects[0].object.userData);
      }
      
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.highlightPoint(null);
      this.renderer.domElement.style.cursor = 'grab';
    }
  }
  
  _onClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.pointMeshes);
    
    if (intersects.length > 0 && this.onPointClick) {
      const idx = intersects[0].object.userData.index;
      this.onPointClick(idx, intersects[0].object.userData);
    }
  }
  
  /**
   * Resize the visualization
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    cancelAnimationFrame(this.animationId);
    
    this.pointMeshes.forEach(mesh => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    
    this.clearConnections();
    
    this.renderer.dispose();
    this.controls.dispose();
    
    if (this.container && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
