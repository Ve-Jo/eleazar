// src/render-server/components/ThreeDObject.three.js

// --- Browser-Side Helper Functions ---

// Helper function to create text planes (Mesh with CanvasTexture)
// This function's code will be stringified and run in the BROWSER.
// It CANNOT directly access variables from the Node.js scope.
// It CAN use browser APIs (document, THREE - if loaded).
function createTextPlane(message, parameters) {
  const fontface = parameters.fontface || "Arial";
  const fontsize = parameters.fontsize || 24; // Slightly larger default
  const borderThickness = parameters.borderThickness || 4;
  const borderColor = parameters.borderColor || { r: 0, g: 0, b: 0, a: 1.0 };
  const backgroundColor = parameters.backgroundColor || {
    r: 60,
    g: 60,
    b: 60,
    a: 0.8,
  }; // Darker background
  const textColor = parameters.textColor || { r: 255, g: 255, b: 255, a: 1.0 };

  const canvas = document.createElement("canvas");
  // Power-of-2 dimensions are good for textures
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.font = "Bold " + fontsize + "px " + fontface;
  const metrics = context.measureText(message);
  const textWidth = metrics.width;

  // Background Color
  context.fillStyle = `rgba(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b}, ${backgroundColor.a})`;
  // Border Color
  context.strokeStyle = `rgba(${borderColor.r}, ${borderColor.g}, ${borderColor.b}, ${borderColor.a})`;
  context.lineWidth = borderThickness;

  // Function to draw rounded rectangles (same as before)
  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // Calculate rectangle position and size (centered on canvas)
  const rectWidth = textWidth + borderThickness * 2 + 20; // Extra padding
  const rectHeight = fontsize * 1.4 + borderThickness * 2 + 10;
  const rectX = (canvas.width - rectWidth) / 2;
  const rectY = (canvas.height - rectHeight) / 2;
  const borderRadius = 8;

  roundRect(context, rectX, rectY, rectWidth, rectHeight, borderRadius);

  // Text Color and Positioning
  context.fillStyle = `rgba(${textColor.r}, ${textColor.g}, ${textColor.b}, 1.0)`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(message, canvas.width / 2, canvas.height / 2);

  // Canvas contents to texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Create a PlaneGeometry and MeshBasicMaterial
  // Plane size should correspond roughly to the texture aspect ratio or desired appearance
  const planeGeometry = new THREE.PlaneGeometry(2, 1); // Adjust plane size as needed
  const planeMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide, // Render both sides
    transparent: true, // Allow transparency from canvas alpha
  });

  const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

  // Scale can be adjusted here if needed, but often better to size the PlaneGeometry
  // planeMesh.scale.set(1, 1, 1);

  return planeMesh;
}

// --- Browser-Side Main Logic Functions ---

// Function to initialize the Three.js scene
// This function's code will be stringified and run in the BROWSER.
// It CANNOT directly access variables from the Node.js scope.
// It CAN use `options` passed during page.evaluate.
// It CAN use globally available browser APIs (document, window, THREE).
// It CAN use other functions injected into the window scope (like createTextPlane).
function initializeScene(options) {
  console.log(
    "Browser: Initializing ThreeDObject scene with options:",
    JSON.stringify(options)
  );
  const {
    width,
    height,
    modelType,
    rotationX,
    rotationY,
    modelColor,
    ambientLightIntensity,
    directionalLightIntensity,
  } = options;

  // Double-check THREE is loaded and available
  if (typeof THREE === "undefined") {
    console.error("Browser: THREE is not loaded in global scope!");
    document.getElementById("debug-info").textContent =
      "ERROR: THREE not found in global scope";
    return; // Cannot proceed
  }

  try {
    document.getElementById("debug-info").textContent =
      "Initializing " + modelType + "...";

    // Check if WebGL is supported
    try {
      const testCanvas = document.createElement("canvas");
      const gl =
        testCanvas.getContext("webgl") ||
        testCanvas.getContext("experimental-webgl");
      if (!gl) {
        console.error("WebGL is not supported in this environment");
        document.getElementById("debug-info").textContent =
          "ERROR: WebGL not supported";
        return;
      }
    } catch (e) {
      console.error("WebGL check error:", e);
      // Proceed anyway, might be software rendering
    }

    // Clear previous scene content if any
    const existingCanvas = document.querySelector("canvas");
    if (existingCanvas) existingCanvas.remove();

    // Create a fresh render div to hold our canvas
    const renderDiv =
      document.getElementById("render-container") ||
      document.createElement("div");
    renderDiv.id = "render-container";
    renderDiv.style.width = width + "px";
    renderDiv.style.height = height + "px";
    if (!document.body.contains(renderDiv)) {
      document.body.appendChild(renderDiv);
    }

    // Initialize scene with TRANSPARENT background
    window.scene = new THREE.Scene();
    window.scene.background = null; // Make scene background transparent
    console.log("Browser: Scene background set to transparent.");

    window.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    window.camera.position.z = 5;
    console.log(
      "Browser: Camera position:",
      JSON.stringify(window.camera.position)
    );

    // Use preserveDrawingBuffer: true to ensure canvas content remains after render
    try {
      window.renderer = new THREE.WebGLRenderer({
        antialias: false, // Reduce GPU demands
        preserveDrawingBuffer: true,
        alpha: true, // Crucial for transparency
        precision: "lowp", // Lower precision for better performance
      });
      window.renderer.setSize(width, height);
      renderDiv.appendChild(window.renderer.domElement);

      // Add stats and debug info
      window.rendererInfo = window.renderer.info;
      console.log("Renderer info:", window.rendererInfo);
    } catch (e) {
      console.error("WebGLRenderer creation error:", e);
      document.getElementById("debug-info").textContent =
        "ERROR: WebGLRenderer failed: " + e.message;
      return;
    }

    // Add lights
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      ambientLightIntensity
    );
    window.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(
      0xffffff,
      directionalLightIntensity
    );
    directionalLight.position.set(1, 1, 1);
    window.scene.add(directionalLight);
    const backLight = new THREE.DirectionalLight(
      0xffffff,
      directionalLightIntensity * 0.5
    );
    backLight.position.set(-1, -1, -1);
    window.scene.add(backLight);

    // Determine model color
    let actualColor = 0x00aaff; // Default blue
    try {
      if (modelColor !== null && !isNaN(parseInt(modelColor))) {
        actualColor = parseInt(modelColor); // Ensure it's a number
      }
      console.log("Browser: Using model color:", actualColor);
    } catch (e) {
      console.error("Error setting model color:", e, "Input:", modelColor);
    }

    // Create geometry and material based on modelType
    let geometry, material;
    try {
      switch (modelType) {
        case "cube":
          geometry = new THREE.BoxGeometry(2, 2, 2);
          material = new THREE.MeshStandardMaterial({
            color: actualColor,
            metalness: 0.3,
            roughness: 0.4,
          });
          break;
        case "sphere":
          geometry = new THREE.SphereGeometry(1.5, 32, 32);
          material = new THREE.MeshStandardMaterial({
            color: actualColor,
            metalness: 0.2,
            roughness: 0.3,
          });
          break;
        case "torus":
          geometry = new THREE.TorusGeometry(1, 0.4, 16, 100);
          material = new THREE.MeshStandardMaterial({
            color: actualColor,
            metalness: 0.4,
            roughness: 0.2,
          });
          break;
        default:
          console.warn("Unknown modelType:", modelType, "Defaulting to cube.");
          geometry = new THREE.BoxGeometry(2, 2, 2);
          material = new THREE.MeshStandardMaterial({ color: actualColor });
      }
    } catch (e) {
      console.error("Error creating geometry/material:", e);
      geometry = new THREE.BoxGeometry(2, 2, 2);
      material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
      });
    }

    // Create and add the main object
    try {
      // Remove previous object if it exists
      if (window.object && window.scene) {
        window.scene.remove(window.object);
        // Dispose geometry and material of the old object to free GPU memory
        if (window.object.geometry) window.object.geometry.dispose();
        if (window.object.material) window.object.material.dispose();
        console.log("Browser: Removed and disposed previous object.");
      }

      window.object = new THREE.Mesh(geometry, material);
      window.object.rotation.x = rotationX;
      window.object.rotation.y = rotationY;
      window.scene.add(window.object);
    } catch (e) {
      console.error("Error creating/adding mesh:", e);
      return;
    }

    console.log(
      "Browser: Object added to scene with rotation:",
      rotationX,
      rotationY
    );

    // Add Text Labels as Children of the Object
    const labelOffset = 1.5;
    const textParams = {
      fontsize: 24,
      fontface: "monospace",
      borderColor: { r: 0, g: 0, b: 0, a: 0.9 },
      backgroundColor: { r: 70, g: 70, b: 70, a: 0.8 },
      textColor: { r: 255, g: 255, b: 255, a: 1.0 },
    };
    const topLabel = createTextPlane("Top", textParams);
    const bottomLabel = createTextPlane("Bottom", textParams);
    const leftLabel = createTextPlane("Left", textParams);
    const rightLabel = createTextPlane("Right", textParams);
    const frontLabel = createTextPlane("Front", textParams);
    const backLabel = createTextPlane("Back", textParams);

    topLabel.position.set(0, labelOffset, 0);
    topLabel.rotation.x = -Math.PI / 2;
    bottomLabel.position.set(0, -labelOffset, 0);
    bottomLabel.rotation.x = Math.PI / 2;
    leftLabel.position.set(-labelOffset, 0, 0);
    leftLabel.rotation.y = -Math.PI / 2;
    rightLabel.position.set(labelOffset, 0, 0);
    rightLabel.rotation.y = Math.PI / 2;
    frontLabel.position.set(0, 0, labelOffset);
    backLabel.position.set(0, 0, -labelOffset);
    backLabel.rotation.y = Math.PI;

    window.object.add(
      topLabel,
      bottomLabel,
      leftLabel,
      rightLabel,
      frontLabel,
      backLabel
    );

    // Final render
    const debugEl = document.getElementById("debug-info");
    try {
      window.renderer.render(window.scene, window.camera);
      console.log("Browser: Initial render complete.");
      if (debugEl) debugEl.textContent = "Rendering: " + modelType;
    } catch (e) {
      console.error("Error during final rendering:", e);
      if (debugEl) debugEl.textContent = "Render error: " + e.message;
    }
  } catch (e) {
    console.error("Uncaught error in initializeScene:", e);
    document.getElementById("debug-info").textContent =
      "Fatal error: " + e.message;
  }
}

// Function to update the object's rotation
// This function's code will be stringified and run in the BROWSER.
// It CANNOT directly access variables from the Node.js scope.
// It CAN use `options` passed during page.evaluate.
// It CAN use globally available browser APIs (document, window, THREE).
function updateRotation(options) {
  try {
    console.log(
      "Browser: Updating rotation with options:",
      JSON.stringify(options)
    );
    const { rotationX, rotationY } = options;

    if (!window.object || !window.renderer || !window.scene || !window.camera) {
      // Rely on PuppeteerSessionManager to handle re-initialization if needed
      console.error("Browser: Scene not initialized for rotation update.");
      document.getElementById("debug-info").textContent =
        "Error: Scene not ready for update.";
      return;
    }

    window.object.rotation.x = rotationX;
    window.object.rotation.y = rotationY;
    window.renderer.render(window.scene, window.camera); // Render after update
    document.getElementById("debug-info").textContent = "Rotation updated";
    console.log("Browser: Rotation updated.");
  } catch (e) {
    console.error("Error in updateRotation:", e);
    document.getElementById("debug-info").textContent =
      "Rotation error: " + e.message;
  }
}

// --- Node.js Module Export ---

// This function generates the script content string to be injected into Puppeteer.
// It stringifies the browser-side functions defined above.
const getScriptContent = (options) => {
  // Note: 'options' passed here is NOT directly used by the stringified functions.
  // It's kept for potential future use or clarity, but the actual options
  // are passed via page.evaluate in PuppeteerSessionManager.
  return `
    // Injected script content for ThreeDObject component

    // Inject helper function
    const createTextPlane = ${createTextPlane.toString()};

    // Inject main functions into window scope
    window.initializeScene = ${initializeScene.toString()};
    window.updateRotation = ${updateRotation.toString()};

    console.log('Browser: Scene initialization and update functions injected.');
  `;
};

export default getScriptContent;
