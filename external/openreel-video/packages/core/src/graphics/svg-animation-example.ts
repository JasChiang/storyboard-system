import { GraphicsEngine } from "./graphics-engine";
import type { SVGClip, GraphicAnimation, SVGColorStyle } from "./types";

const engine = new GraphicsEngine();

const svgContent = `
 <svg viewBox="0 0 100 100">
 <circle cx="50" cy="50" r="40" fill="#3b82f6" />
 </svg>
`;

const svgClip = engine.importSVG(svgContent, "track-1", 0, 5);

const fadeInAnimation: GraphicAnimation = engine.createGraphicAnimation(
  "fade",
  0.5,
  "ease-out",
);

const slideOutAnimation: GraphicAnimation = engine.createGraphicAnimation(
  "slide-left",
  0.5,
  "ease-in",
);

let animatedSVG = engine.setSVGAnimation(svgClip, "entry", fadeInAnimation);
animatedSVG = engine.setSVGAnimation(animatedSVG, "exit", slideOutAnimation);

const tintStyle: SVGColorStyle = {
  colorMode: "tint",
  tintColor: "#ef4444",
  tintOpacity: 0.8,
};

animatedSVG = engine.setSVGColorStyle(animatedSVG, tintStyle);

const replaceColorStyle: SVGColorStyle = {
  colorMode: "replace",
  tintColor: "#10b981",
  tintOpacity: 1,
};

animatedSVG = engine.setSVGColorStyle(animatedSVG, replaceColorStyle);

const popAnimation: GraphicAnimation = {
  type: "pop",
  duration: 0.8,
  easing: "ease-out",
};

const bounceAnimation: GraphicAnimation = {
  type: "bounce",
  duration: 1,
  easing: "ease-out",
};

engine.updateSVGClip(animatedSVG.id, {
  entryAnimation: popAnimation,
  exitAnimation: bounceAnimation,
  colorStyle: {
    colorMode: "tint",
    tintColor: "#8b5cf6",
    tintOpacity: 0.9,
  },
});

export async function renderAnimatedSVG(
  svg: SVGClip,
  time: number,
  width: number,
  height: number,
) {
  return await engine.renderGraphic(svg, time, width, height);
}
