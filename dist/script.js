const fragmentShaderSrc = `
precision mediump float;

uniform sampler2D uSampler;
varying vec2 vTexCoord;

uniform int uWidth;
uniform int uHeight;
uniform bool uHover;

uniform float uTime;

float wrap (float val, float limit) {
  return val - limit * floor(val/limit);
}

void main () {

  vec3 pix = vec3(0.0);
  if (uHover) {
    vec2 pixelSize = vec2(1.0, 1.0) / vec2(uWidth, uHeight);
    float xOff = sin(vTexCoord.y * 100.0) * (24.0 + (uTime * 0.001)); 
    vec2 offset = sin(uTime) * (pixelSize * vec2(xOff, (uTime / 10.0)));
    pix = texture2D(uSampler, vTexCoord + offset).rgb;
    if (pix.r > 0.1) {
      pix.b = 1.0;
      pix.r = 1.0 * sin(uTime);
    }
   
  } else {
    pix = texture2D(uSampler, vTexCoord).rgb;
  }

  float alf = 1.0;
  if (pix.r < 0.1) {
    alf = 0.0;
  }
  gl_FragColor = vec4(pix, alf);
}`;
const vertexShaderSrc = `
attribute vec4 aVertexPos;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main () {
  gl_Position = aVertexPos;
  vTexCoord = aTexCoord;
}
`;
const quad = [-1, -1, 0.0, -1, 1, 0.0, 1, -1, 0.0, 1, 1, 0.0];

function GLContext(canv) {
  const cTexts = ['webgl', 'experimental-webgl', 'webkit-3d', 'moz-webgl'];
  let context = null;

  for (let i = 0; i < cTexts.length; i += 1) {
    try {
      context = canv.getContext(cTexts[i]);
    } catch (e) {
      continue;
    }

    if (context) {
      break;
    }
  }

  return context;
}

var GLShader = function () {};

GLShader.prototype.makeShader = function (gl, shader, srcCode) {
  gl.shaderSource(shader, srcCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

GLShader.prototype.fragment = function fragment(gl, srcCode) {
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  return this.makeShader(gl, shader, srcCode);
};

GLShader.prototype.vertex = function vertex(gl, srcCode) {
  const shader = gl.createShader(gl.VERTEX_SHADER);
  return this.makeShader(gl, shader, srcCode);
};

function GLProgram(gl, vShaderSrc, fShaderSrc) {
  const shader = new GLShader();
  const vertexShader = shader.vertex(gl, vShaderSrc);
  const fragmentShader = shader.fragment(gl, fShaderSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  return program;
}

function GLTexture(mage) {
  this.image = mage;
}

GLTexture.prototype.texture = null;
GLTexture.prototype.image = null;
GLTexture.prototype.uniform = null;

GLTexture.prototype.create = function (gl) {
  this.texture = gl.createTexture();

  if (!this.texture) {
    return console.error('failed to create texture');
  }

  return this;
};

GLTexture.prototype.bind = function (gl, program, uniformName, textureNum, flip) {
  this.uniform = gl.getUniformLocation(program, uniformName);

  if (flip) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // flip y axis
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  if (this.image) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.image);
  }

  gl.uniform1i(this.uniform, textureNum);
  return this;
};

function VertexBuffer(gl, program, verts, dimensions, attrName) {
  const vertices = new Float32Array(verts);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
  const attribute = gl.getAttribLocation(program, attrName);
  gl.vertexAttribPointer(attribute, dimensions, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(attribute);
}

(function () {
  'use strict';

  const monkes = document.createElement('canvas');
  const ctx = monkes.getContext('2d');
  monkes.width = 256;
  monkes.height = 256;
  const tileSize = 12;
  const stride = 24;
  const monkeMap = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 5, 3, 4, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 5, 3, 4, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 5, 5, 5, 5, 3, 3, 4, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 6, 4, 4, 7, 7, 7, 1, 7, 7, 1, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 6, 1, 4, 7, 7, 7, 1, 7, 7, 1, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 6, 1, 4, 7, 1, 7, 7, 7, 7, 7, 7, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 6, 4, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 7, 7, 7, 7, 7, 7, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 8, 9, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 10, 1, 9, 9, 9, 1, 4, 9, 9, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 10, 11, 11, 1, 1, 9, 9, 1, 9, 1, 11, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 10, 11, 11, 11, 11, 11, 1, 1, 1, 1, 11, 11, 11, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 1, 11, 11, 11, 1, 0, 0, 0, 0];
  const offset = (monkes.width - tileSize * stride) * 0;

  function styleForTile(tile) {
    switch (tile) {
      case 1:
        return 'rgb(26,26,56)';

      case 2:
        return 'rgb(197,207,203)';

      case 3:
        return 'rgb(235,237,232)';

      case 4:
        return 'rgb(51,73,80)';

      case 5:
        return 'rgb(124,151,150)';

      case 6:
        return 'rgb(26,44,55)';

      case 7:
        return 'rgb(215,173,132)';

      case 8:
        return 'rgb(96,32,32)';

      case 9:
        return 'rgb(136,60,21)';

      case 10:
        return 'rgb(26,86,36)';

      case 11:
        return 'rgb(52,117,81)';

      default:
        return 'rgba(15,26,56,0)';
    }
  }

  let renderTimer = null;

  const renderMonke = tile => {
    let pos = {
      x: tile % 24 * tileSize,
      y: Math.floor(tile / 24) * tileSize
    };
    ctx.fillStyle = styleForTile(monkeMap[tile]);
    ctx.fillRect(offset + pos.x, offset + pos.y, tileSize, tileSize);

    if (tile + 1 < monkeMap.length) {
      renderTimer = setTimeout(() => {
        renderMonke(tile + 1);
      }, 0);
    }
  };

  let canvas = null;
  let gl = null;
  let texture = null;
  let program = null;
  let start = null;
  let hover = false;
  let uHover = null;
  let uWidth = null;
  let uHeight = null;
  let uSampler = null;
  let uTime = null;

  function init() {
    canvas = document.createElement('canvas');
    canvas.width = monkes.width;
    canvas.height = monkes.height;
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    gl = GLContext(canvas);

    if (!gl) {
      return document.getElementById('monke-wrap').appendChild(canvas);
    }

    texture = new GLTexture(monkes);
    texture.create(gl);
    program = GLProgram(gl, vertexShaderSrc, fragmentShaderSrc);
    VertexBuffer(gl, program, quad, 3, 'aVertexPos');
    VertexBuffer(gl, program, [0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0], 2, 'aTexCoord');
    uSampler = gl.getUniformLocation(program, 'uSampler');
    uHover = gl.getUniformLocation(program, 'uHover');
    uWidth = gl.getUniformLocation(program, 'uWidth');
    uHeight = gl.getUniformLocation(program, 'uHeight');
    uTime = gl.getUniformLocation(program, 'uTime');
    gl.useProgram(program);
    gl.uniform1i(uSampler, 0);
    gl.uniform1i(uWidth, canvas.width);
    gl.uniform1i(uHeight, canvas.height);
    gl.uniform1i(uHover, 0);
    start = new Date();
    document.body.appendChild(canvas);

    function onMonkes() {
      hover = true;
      start = Date.now();
    }

    function offMonkes() {
      ctx.clearRect(0, 0, monkes.width, monkes.height);

      if (renderTimer !== null) {
        clearTimeout(renderTimer);
        renderTimer = null;
      }

      renderMonke(0);
      hover = false;
    }

    canvas.addEventListener('mouseover', onMonkes);
    canvas.addEventListener('mouseleave', offMonkes);
    canvas.addEventListener('touchstart', onMonkes);
    canvas.addEventListener('touchend', offMonkes);
    canvas.style.cursor = 'pointer';
  }

  function glitch() {
    texture.bind(gl, program, 'Sampler', 0);
    gl.uniform1f(uTime, (Date.now() - start) / 2);
    gl.uniform1i(uHover, hover);
    gl.clearColor(0.0, 0.0, 0.0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    window.requestAnimationFrame(glitch);
  }

  renderMonke(0);
  init();
  window.requestAnimationFrame(glitch);
})();