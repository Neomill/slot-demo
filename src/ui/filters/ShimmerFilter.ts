import { Filter, GlProgram, GpuProgram } from "pixi.js";

interface ShimmerUniforms {
  uProgress: number;
  uWidth: number;
  uAngle: number;
  uStrength: number;
}

/**
 * A single shimmer pass
 * A custom GPU filter that sweeps a soft diagonal highlight band across whatever
 * it's applied to.
 */
const gl = {
  vertex: /* glsl */ `
    in vec2 aPosition;
    out vec2 vTextureCoord;

    uniform vec4 uInputSize;
    uniform vec4 uOutputFrame;
    uniform vec4 uOutputTexture;

    vec4 filterVertexPosition( void ) {
      vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
      position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
      position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
      return vec4(position, 0.0, 1.0);
    }

    vec2 filterTextureCoord( void ) {
      return aPosition * (uOutputFrame.zw * uInputSize.zw);
    }

    void main(void) {
      gl_Position = filterVertexPosition();
      vTextureCoord = filterTextureCoord();
    }
  `,
  fragment: /* glsl */ `
    in vec2 vTextureCoord;
    out vec4 finalColor;

    uniform sampler2D uTexture;
    uniform float uProgress;
    uniform float uWidth;
    uniform float uAngle;
    uniform float uStrength;

    void main(void) {
      vec4 color = texture(uTexture, vTextureCoord);

      // Project the pixel onto the sweep axis, then place a soft band whose
      // centre travels across the projected range as progress goes 0 -> 1.
      vec2 dir = vec2(cos(uAngle), sin(uAngle));
      float proj = dot(vTextureCoord, dir);
      float center = mix(-uWidth, 1.0 + uWidth, uProgress);
      float band = smoothstep(uWidth, 0.0, abs(proj - center));

      // Highlight only where the symbol is opaque so the glint rides the art.
      // Colours are premultiplied, so scale the add by alpha to stay consistent.
      vec3 highlight = vec3(band * uStrength) * color.a;
      finalColor = vec4(color.rgb + highlight, color.a);
    }
  `,
};

const gpu = {
  vertex: /* wgsl */ `
    struct GlobalFilterUniforms {
      uInputSize:vec4<f32>,
      uInputPixel:vec4<f32>,
      uInputClamp:vec4<f32>,
      uOutputFrame:vec4<f32>,
      uGlobalFrame:vec4<f32>,
      uOutputTexture:vec4<f32>,
    };

    @group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;

    struct VSOutput {
      @builtin(position) position: vec4<f32>,
      @location(0) uv : vec2<f32>,
    };

    fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
      var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
      position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
      position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
      return vec4(position, 0.0, 1.0);
    }

    fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32> {
      return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
    }

    @vertex
    fn mainVertex(@location(0) aPosition : vec2<f32>) -> VSOutput {
      return VSOutput(filterVertexPosition(aPosition), filterTextureCoord(aPosition));
    }
  `,
  fragment: /* wgsl */ `
    struct ShimmerUniforms {
      uProgress: f32,
      uWidth: f32,
      uAngle: f32,
      uStrength: f32,
    };

    @group(0) @binding(1) var uTexture: texture_2d<f32>;
    @group(0) @binding(2) var uSampler: sampler;
    @group(1) @binding(0) var<uniform> shimmer: ShimmerUniforms;

    @fragment
    fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
      let color = textureSample(uTexture, uSampler, uv);

      let dir = vec2<f32>(cos(shimmer.uAngle), sin(shimmer.uAngle));
      let proj = dot(uv, dir);
      let center = mix(-shimmer.uWidth, 1.0 + shimmer.uWidth, shimmer.uProgress);
      let band = smoothstep(shimmer.uWidth, 0.0, abs(proj - center));

      let highlight = vec3<f32>(band * shimmer.uStrength) * color.a;
      return vec4<f32>(color.rgb + highlight, color.a);
    }
  `,
};

export class ShimmerFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({
        vertex: gl.vertex,
        fragment: gl.fragment,
        name: "shimmer",
      }),
      gpuProgram: GpuProgram.from({
        vertex: { source: gpu.vertex, entryPoint: "mainVertex" },
        fragment: { source: gpu.fragment, entryPoint: "mainFragment" },
        name: "shimmer",
      }),
      resources: {
        shimmerUniforms: {
          uProgress: { value: 0, type: "f32" },
          uWidth: { value: 0.16, type: "f32" },
          uAngle: { value: -0.6, type: "f32" }, // radians; a top-left → bottom-right glint
          uStrength: { value: 0.85, type: "f32" },
        },
      },
      // The sweep band overruns the symbol's edges slightly; pad so it isn't clipped.
      padding: 4,
    });
  }

  private get uniforms(): ShimmerUniforms {
    return (
      this.resources.shimmerUniforms as unknown as { uniforms: ShimmerUniforms }
    ).uniforms;
  }

  /** Sweep position, 0 (off the leading edge) → 1 (off the trailing edge). */
  get progress(): number {
    return this.uniforms.uProgress;
  }
  set progress(value: number) {
    this.uniforms.uProgress = value;
  }

  /** Peak brightness of the band added onto the art. */
  set strength(value: number) {
    this.uniforms.uStrength = value;
  }
}
