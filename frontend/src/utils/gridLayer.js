/**
 * WebGL custom MapLibre layer — lat/lng grid overlay.
 * Draws soft navy grid lines every 30° using WebGL directly for GPU-speed.
 * Implements the MapLibre CustomLayerInterface.
 */
export class GridLayer {
  constructor({ id = 'grid-overlay', opacity = 0.12, color = [0, 200, 255] } = {}) {
    this.id = id
    this.type = 'custom'
    this.renderingMode = '2d'
    this._opacity = opacity
    this._color = color  // RGB 0-255
    this._program = null
    this._vertexBuffer = null
    this._visible = true
  }

  setVisible(v) { this._visible = v }
  setOpacity(o) { this._opacity = o }

  onAdd(map, gl) {
    this._map = map

    // ── Shaders ──────────────────────────────────────────────────────────────
    const vs = `
      attribute vec2 a_pos;
      uniform mat4 u_matrix;
      void main() {
        gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
      }
    `
    const fs = `
      precision mediump float;
      uniform vec4 u_color;
      void main() {
        gl_FragColor = u_color;
      }
    `
    const vShader = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vShader, vs)
    gl.compileShader(vShader)

    const fShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fShader, fs)
    gl.compileShader(fShader)

    this._program = gl.createProgram()
    gl.attachShader(this._program, vShader)
    gl.attachShader(this._program, fShader)
    gl.linkProgram(this._program)

    // Pre-generate grid vertices (lat lines every 30°, lng lines every 30°)
    const verts = []
    const STEP = 30

    // Longitude lines
    for (let lng = -180; lng <= 180; lng += STEP) {
      verts.push(lng, -85, lng, 85)
    }
    // Latitude lines
    for (let lat = -60; lat <= 80; lat += STEP) {
      verts.push(-180, lat, 180, lat)
    }

    // Convert to Mercator pixel units using raw math
    // MapLibre will apply u_matrix to project to screen
    const RAD = Math.PI / 180
    const TILE_SIZE = 512

    const projected = []
    for (let i = 0; i < verts.length; i += 2) {
      const lng = verts[i], lat = verts[i + 1]
      // Web Mercator formula (world units)
      const x = (lng + 180) / 360 * TILE_SIZE
      const sinLat = Math.sin(lat * RAD)
      const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * TILE_SIZE
      projected.push(x, y)
    }

    const buf = new Float32Array(projected)
    this._vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW)
    this._vertexCount = Math.floor(projected.length / 2)
  }

  render(gl, matrix) {
    if (!this._visible || !this._program) return

    gl.useProgram(this._program)

    // Set uniforms
    const uMatrix = gl.getUniformLocation(this._program, 'u_matrix')
    gl.uniformMatrix4fv(uMatrix, false, matrix)

    const [r, g, b] = this._color
    const uColor = gl.getUniformLocation(this._program, 'u_color')
    gl.uniform4f(uColor, r / 255, g / 255, b / 255, this._opacity)

    // Bind vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer)
    const aPos = gl.getAttribLocation(this._program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    // Enable blending for opacity
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    // Draw lines (each pair of vertices = one line segment)
    for (let i = 0; i < this._vertexCount; i += 2) {
      gl.drawArrays(gl.LINES, i, 2)
    }
  }

  onRemove(_map, gl) {
    if (this._program) gl.deleteProgram(this._program)
    if (this._vertexBuffer) gl.deleteBuffer(this._vertexBuffer)
  }
}
