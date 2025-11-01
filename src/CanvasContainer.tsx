import { useEffect } from "react";
import { useState } from "react";
import * as PIXI from "pixi.js";
import React from "react";

let app: PIXI.Application | null = null;
let playground: HTMLElement | null = null;

export type CanvasContainerHandle = {
  getElement: () => HTMLDivElement | null;
};

const canvasContainerName = "canvas-container";
const CanvasContainerComponent = () => {
  const [render, setRender] = useState(false);

  useEffect(() => {
    if (!render) {
      return;
    }

    (async function () {
      const option = {
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x000000,
        resolution: window.devicePixelRatio || 1,
        antialias: true,
      };
      // Initialize Pixi Application
      app = new PIXI.Application();

      await app.init(option);

      // Add the canvas to the HTML document
      if (app) {
        const container = document.getElementById(canvasContainerName);
        if (container) {
          playground = container.appendChild(app.canvas as HTMLCanvasElement);
        }
      }

      // Create a container for our nebula effect
      const nebulaContainer = new PIXI.Container();
      app.stage.addChild(nebulaContainer);

      // Create a container for stars
      const starsContainer = new PIXI.Container();
      app.stage.addChild(starsContainer);

      // Create the nebula texture
      const nebulaTexture = createNebulaTexture();
      const nebula = new PIXI.Sprite(nebulaTexture);
      nebula.width = window.innerWidth * 1.2;
      nebula.height = window.innerHeight * 1.2;
      nebula.x = -window.innerWidth * 0.1;
      nebula.y = -window.innerHeight * 0.1;
      nebula.alpha = 0.8;
      nebulaContainer.addChild(nebula);

      // Add a displacement filter for the wavy effect
      const displacementSprite = PIXI.Sprite.from(createDisplacementTexture());
      displacementSprite.texture.source.addressMode = "repeat";
      displacementSprite.scale.set(2);
      app.stage.addChild(displacementSprite);

      const displacementFilter = new PIXI.DisplacementFilter(
        displacementSprite
      );
      displacementFilter.scale.set(100);
      nebulaContainer.filters = [displacementFilter];

      // Add stars
      addStars(200);

      // Add mouse interaction
      let mouseX = window.innerWidth / 2;
      let mouseY = window.innerHeight / 2;
      let prevMouseX = mouseX;
      let prevMouseY = mouseY;
      let mouseSpeed = 0;

      // Create a container for mouse distortion effect
      const mouseDistortionContainer = new PIXI.Container();
      app.stage.addChild(mouseDistortionContainer);

      // Create mouse distortion sprite
      const mouseDistortionSprite = PIXI.Sprite.from(
        createMouseDistortionTexture()
      );
      mouseDistortionSprite.anchor.set(0.5);
      mouseDistortionSprite.scale.set(0.5);
      mouseDistortionSprite.alpha = 0.7;
      mouseDistortionSprite.blendMode = "screen";
      mouseDistortionContainer.addChild(mouseDistortionSprite);

      // Create mouse distortion filter
      const mouseDistortionFilter = new PIXI.DisplacementFilter(
        mouseDistortionSprite
      );
      mouseDistortionFilter.scale.set(30);
      nebulaContainer.filters = [displacementFilter, mouseDistortionFilter];

      window.addEventListener("mousemove", (e) => {
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Calculate mouse speed for dynamic effects
        const dx = mouseX - prevMouseX;
        const dy = mouseY - prevMouseY;
        mouseSpeed = Math.sqrt(dx * dx + dy * dy);
        mouseSpeed = Math.min(mouseSpeed, 30); // Cap the speed
      });

      // Animation loop
      app.ticker.add(() => {
        if (!app) {
          return;
        }
        // Animate displacement map
        displacementSprite.x += 1;
        displacementSprite.y += 0.5;

        // Subtle nebula movement based on mouse position
        const targetX = (window.innerWidth / 2 - mouseX) * 0.01;
        const targetY = (window.innerHeight / 2 - mouseY) * 0.01;

        nebula.x += (targetX - nebula.x) * 0.02;
        nebula.y += (targetY - nebula.y) * 0.02;

        // Update mouse distortion effect
        mouseDistortionSprite.x = mouseX;
        mouseDistortionSprite.y = mouseY;
        mouseDistortionSprite.rotation += 0.01;

        // Dynamic distortion based on mouse speed
        mouseDistortionFilter.scale.x = 30 + mouseSpeed * 2;
        mouseDistortionFilter.scale.y = 30 + mouseSpeed * 2;

        // Animate the distortion size based on mouse movement
        const pulseSize = 0.5 + Math.sin(app.ticker.lastTime / 200) * 0.1;
        mouseDistortionSprite.scale.set(pulseSize + mouseSpeed * 0.01);

        // Animate stars
        animateStars();
      });

      // Handle window resize
      window.addEventListener("resize", () => {
        if (!app) {
          return;
        }
        app.renderer.resize(window.innerWidth, window.innerHeight);
        nebula.width = window.innerWidth * 1.2;
        nebula.height = window.innerHeight * 1.2;
      });

      // Function to add stars
      function addStars(count = 10) {
        for (let i = 0; i < count; i++) {
          const star = new PIXI.Graphics();
          const size = Math.random() * 2 + 0.5;
          const alpha = Math.random() * 0.5 + 0.5;

          star.circle(0, 0, size).fill({ color: 0xffffff, alpha });

          star.x = Math.random() * window.innerWidth;
          star.y = Math.random() * window.innerHeight;
          star.alpha = Math.random(); // overall sprite alpha (optional)

          starsContainer.addChild(star);
        }
      }

      // Function to animate stars
      function animateStars() {
        const starSpeed = 0.5;
        for (let i = 0; i < starsContainer.children.length; i++) {
          const star = starsContainer.children[i];

          // Twinkle effect
          star.alpha += (Math.random() - 0.5) * 0.05;
          star.alpha = Math.max(0.2, Math.min(1, star.alpha));

          // Subtle movement
          star.x += (Math.random() - 0.5) * starSpeed;
          star.y += (Math.random() - 0.5) * starSpeed;

          // Wrap around screen
          if (star.x < 0) star.x = window.innerWidth;
          if (star.x > window.innerWidth) star.x = 0;
          if (star.y < 0) star.y = window.innerHeight;
          if (star.y > window.innerHeight) star.y = 0;
        }
      }
    })();

    return () => {
      if (app) {
        app.destroy(true);
      }
      // if (animationFrameId) {
      //   cancelAnimationFrame(animationFrameId);
      // }
      if (playground && playground.firstChild) {
        playground.removeChild(playground.firstChild);
      }
    };
  }, [render]);

  useEffect(() => {
    setRender(true);
  }, []);

  return <div id={canvasContainerName}></div>;
};

// Function to create a nebula texture
function createNebulaTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  // Create gradient background
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2
  );

  // Colors based on the screenshot (cosmic blues and purples)
  gradient.addColorStop(0, "#1a237e");
  gradient.addColorStop(0.4, "#283593");
  gradient.addColorStop(0.6, "#303f9f");
  gradient.addColorStop(0.8, "#3949ab");
  gradient.addColorStop(1, "#000000");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add some nebula-like noise
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 2;
    const opacity = Math.random() * 0.5;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();

    const r = Math.floor(Math.random() * 100) + 155;
    const g = Math.floor(Math.random() * 50);
    const b = Math.floor(Math.random() * 100) + 155;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.fill();
  }

  return PIXI.Texture.from(canvas);
}

// Function to create displacement map texture
const createDisplacementTexture = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    // Instead of returning undefined, return the canvas anyway
    // PIXI can still work with an empty canvas
    return canvas;
  }

  // Create perlin-like noise
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const value = Math.sin(x / 10) * Math.cos(y / 10) * 128 + 128;
      ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return canvas;
};

// Function to create mouse distortion texture
const createMouseDistortionTexture = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return canvas;
  }

  // Create radial gradient for distortion effect
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2
  );

  // Add color stops for the distortion gradient
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.3, "rgba(160, 160, 255, 0.8)");
  gradient.addColorStop(0.7, "rgba(100, 100, 255, 0.4)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  // Fill with gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add some noise to make the distortion more interesting
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      // Calculate distance from center
      const dx = x - canvas.width / 2;
      const dy = y - canvas.height / 2;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only add noise within the gradient area
      if (distance < canvas.width / 2) {
        // Add some perlin-like noise
        const noise = Math.sin(x / 5) * Math.cos(y / 5) * 20;

        // Get current pixel data
        const imageData = ctx.getImageData(x, y, 1, 1);
        const data = imageData.data;

        // Add noise to the pixel
        data[0] = Math.min(255, Math.max(0, data[0] + noise));
        data[1] = Math.min(255, Math.max(0, data[1] + noise));
        data[2] = Math.min(255, Math.max(0, data[2] + noise));

        // Put the pixel back
        ctx.putImageData(imageData, x, y);
      }
    }
  }

  return canvas;
};

export const CanvasContainer = React.memo(CanvasContainerComponent, () => true);
