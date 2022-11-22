const SimpleVertexSource = `#version 300 es
layout (location = 0)
in vec2 vPosition;
layout (location = 1)
in vec2 vUv;

out vec2 uv;

void main() {
    uv = vUv;
    gl_Position = vec4(vPosition, 0.0, 1.0);
}
`;
const SimpleFragmentSource = `#version 300 es

precision highp float;

in vec2 uv;

uniform sampler2D sampler;

out vec4 fragColor;

void main() {
    fragColor = texture(sampler, uv);
}
`;
const PixelatedRetroFragmentSource = `#version 300 es

precision highp float;

in vec2 uv;

uniform sampler2D sampler;
uniform float aspect;

out vec4 fragColor;

void main() {
    vec4 texColor = texture(sampler, uv);
    vec3 rgb = texColor.rgb;
    if((rgb.r + rgb.g + rgb.b) / 3. > .59) {
        rgb = vec3(0.164, 0.612, 0.502);
    }
    else {
        rgb = vec3(0.047, 0.165, 0.098);
    }
    fragColor = vec4(rgb, 1.);
}
`;

class ShaderUtils {

    static CompileShader(gl, shaderType, shaderSource) {
        const shaderObj = gl.createShader(shaderType);
        gl.shaderSource(shaderObj, shaderSource);
        gl.compileShader(shaderObj);
        const shaderError = gl.getShaderInfoLog(shaderObj);
        if (shaderError && shaderError.length != 0) {
            console.log(shaderError);
            throw new Error(`Error compiling ${shaderType == gl.VERTEX_SHADER ? "vertex" : "fragment"} shader`);
        }
        return shaderObj;
    }

    static CreateProgram(gl, vertexSource, fragmentSource, ...uniforms) {
        const program = gl.createProgram();
        const vertexShaderObj = this.CompileShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShaderObj = this.CompileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        gl.attachShader(program, vertexShaderObj);
        gl.attachShader(program, fragmentShaderObj);
        gl.linkProgram(program);
        const uniformLocations = new Map();
        uniforms.forEach(u => uniformLocations.set(u, gl.getUniformLocation(program, u)));
        return { program, uniformLocations };
    }

}

class Geometry {
    vertices = [];
    uvs = null;
    vertexCount = 0;

    Init() { }
}

class ComputerGeometry extends Geometry {
    Init() {
        this.vertices = new Float32Array([
            -1, 1,
            1, 1,
            1, -1,
            -1, -1
        ]);
        this.uvs = new Float32Array([
            0, 0,
            1, 0,
            1, 1,
            0, 1
        ]);
        this.vertexCount = 4;
    }
}

class ScreenGeometry extends Geometry {
    aspect;
    Init() {
        const w = 1920,
        h = 1079;
        
        this.vertices = new Float32Array([
            613/w*2-1, -221/h*2+1,
            1271/w*2-1, -121/h*2+1,
            1309/w*2-1, -622/h*2+1,
            681/w*2-1, -746/h*2+1
        ]);
        this.uvs = new Float32Array([
            0.125, 0,
            0.875, 0,
            0.875, 1,
            0.125, 1
        ]);
        this.vertexCount = 4;
    }
}

class Texture {
    gl;
    width;
    height;
    texId;

    static FromImage(gl, image) {
        return new Texture(gl, image.width, image.height, image);
    }

    constructor(gl, width, height, data = null) {
        this.gl = gl;
        this.width = width;
        this.height = height;
        this.texId = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, this.texId);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    Update(data) {
        const { gl } = this;
        gl.bindTexture(gl.TEXTURE_2D, this.texId);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

}

class Renderable {
    gl;
    geometry;
    texture;
    shader;
    vao;
    vertexBuffer;

    constructor(gl, geometry, tex, shader) {
        this.gl = gl;
        this.geometry = geometry;
        this.texture = tex;
        this.shader = shader;

        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        if (tex != null && geometry.uvs != null) {
            const uvBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, geometry.uvs, gl.STATIC_DRAW);

            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        }

        gl.bindVertexArray(null);
    }

    SupplyUniforms() {

    }

    Render() {
        const { gl } = this;
        gl.useProgram(this.shader.program);
        gl.bindTexture(gl.TEXTURE_2D, this.texture ? this.texture.texId : null);
        gl.bindVertexArray(this.vao);
        this.SupplyUniforms();
        gl.drawArrays(gl.TRIANGLE_FAN, 0, this.geometry.vertexCount);
    }

}

class ScreenRenderable extends Renderable {

    SupplyUniforms() {
        
    }

}

class AssetPool {

    static imagesMap = new Map();
    static audioMap = new Map();
    static videoMap = new Map();

    static GetImage(name) {
        return this.imagesMap.get(name);
    }

    static GetAudio(name) {
        return this.audioMap.get(name);
    }

    static GetVideo(name) {
        return this.videoMap.get(name);
    }

    static LoadImage(name, path) {
        return new Promise(resolve => {
            const image = new Image();
            image.crossOrigin = "Anonymous";
            image.src = path;
            image.onload = () => {
                this.imagesMap.set(name, image);
                resolve(image);
            }
        });
    }

    static LoadAudio(name, path) {
        return new Promise(resolve => {
            const audio = new Audio(path);
            audio.load();
            audio.oncanplaythrough = () => {
                this.audioMap.set(name, audio);
                resolve(audio);
            }
        });
    }

    static LoadVideo(name, path) {
        return new Promise(resolve => {
            const video = document.createElement('video');
            video.crossOrigin = "Anonymous";
            video.src = path;
            video.load();
            video.oncanplaythrough = () => {
                this.videoMap.set(name, video);
                resolve(video);
            }
        });
    }

}

const Main = async () => {
    const W = 360,
    H = 240;
    let canvas;
    let gl;

    let started = false;

    let computerGeometry = new ComputerGeometry(),
        screenGeometry = new ScreenGeometry();
    let computerTex, screenTex;
    let simpleShader, screenShader;
    let computer, screen;

    canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    document.body.appendChild(canvas);

    Resize();
    addEventListener("resize", Resize);

    gl = canvas.getContext("webgl2");

    await Promise.all([
        AssetPool.LoadImage("IBN5100", "assets/IBN5100.png"),
        AssetPool.LoadImage("intro", "assets/intro.png"),
        AssetPool.LoadVideo("SteinsGateOP", "assets/SteinsGateOP-480p.mp4")
    ]);

    computerTex = Texture.FromImage(gl, AssetPool.GetImage("IBN5100"));
    screenTex = Texture.FromImage(gl, AssetPool.GetImage("intro"));

    simpleShader = ShaderUtils.CreateProgram(gl, SimpleVertexSource, SimpleFragmentSource);
    screenShader = ShaderUtils.CreateProgram(gl, SimpleVertexSource, PixelatedRetroFragmentSource);

    computerGeometry.Init();
    screenGeometry.Init();

    computer = new Renderable(gl, computerGeometry, computerTex, simpleShader);
    screen = new ScreenRenderable(gl, screenGeometry, screenTex, screenShader);

    canvas.onclick = () => {
        canvas.onclick = () => {}

        started = true;

        const video = AssetPool.GetVideo("SteinsGateOP");
        video.loop = true;
        video.play();
    }

    Loop();

    function Resize() {
        let w, h;
        if(W / H > innerWidth / innerHeight) {
            [ w, h ] = [ 1, (innerWidth / innerHeight) / (W / H) ];
        }
        else {
            [ w, h ] = [ (W / H) / (innerWidth / innerHeight), 1 ];
        }
        canvas.style.marginLeft = `${(1 - w) * innerWidth * 0.5}px`;
        canvas.style.marginTop = `${(1 - h) * innerHeight * 0.5}px`;
        canvas.style.width = `${w * innerWidth}px`;
        canvas.style.height = `${h * innerHeight}px`;
    }

    function Loop() {
        requestAnimationFrame(() => {
            Loop();

            if(started) {
                screenTex.Update(AssetPool.GetVideo("SteinsGateOP"));
            }

            gl.viewport(0, 0, canvas.width, canvas.height);

            gl.clearColor(1, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            computer.Render();
            screen.Render();
        })
    }
}

addEventListener("DOMContentLoaded", Main);