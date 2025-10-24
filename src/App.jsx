// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';


/* Ingredients list */
const INGREDIENTS = [
  { id: "pepperoni", name: "Pepperoni", color: 0xb23d3d, kind: "cylinder" },
  { id: "mushroom", name: "Mushroom", color: 0xdcd2c1, kind: "mushroom" },
  { id: "olive", name: "Olive", color: 0x2a3a2a, kind: "torus" },
  { id: "basil", name: "Basil", color: 0x3c7a3c, kind: "leaf" },
  { id: "pineapple", name: "Pineapple", color: 0xffe7a3, kind: "cube" },
  { id: "onion", name: "Onion", color: 0xe6b0ff, kind: "sphere" },
];

export default function App() {
  // UI state
  const [baseType, setBaseType] = useState("medium");
  const [baseSize, setBaseSize] = useState(33);
  const [snapToRings, setSnapToRings] = useState(true);
  const [feed, setFeed] = useState([]);
  const [cheeseAmount, setCheeseAmount] = useState(250);

  // refs
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const baseRef = useRef(null);
  const sauceRef = useRef(null);
  const cheeseGroupRef = useRef(null);
  const toppingsGroupRef = useRef(null);

  // helper: dimensions from base
  const getBaseDims = (type, size) => {
    const height = type === "thin" ? 0.04 : type === "medium" ? 0.08 : 0.15;
    const radius = size === 28 ? 1.9 : size === 33 ? 2.2 : 2.7;
    return { height, radius };
  };

// robust: returns world-space Y coordinate of the base top surface
function getTopOfBaseY() {
  const base = baseRef.current;
  if (!base || !base.geometry) return 0;

  // ensure the geometry bbox is up to date
  base.geometry.computeBoundingBox();
  const bbox = base.geometry.boundingBox.clone();

  // bbox is in the base's local space; convert bbox.max to world space
  const max = new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z);
  base.localToWorld(max); // now max is world-space top position

  return max.y;
}

//base creation
function createBase(type, size) {

const { height, radius } = getBaseDims(type, size);
const segments = 128;

// --- Geometry: pizza base profile ---
const points = [];
const innerRadius = radius * 0.9;
const crustThickness = height * 2.2;
const crustDepth = radius * 0.15;

// --- Build profile (clockwise order for correct normals) ---
points.push(new THREE.Vector2(innerRadius, 0)); // start at center bottom

// Bottom round
for (let i = 0; i <= 16; i++) {
  const t = i / 16;
  const r = innerRadius + Math.sin(t * Math.PI * 0.5) * crustDepth;
  const y = -Math.sin(t * Math.PI) * crustThickness * 0.4;
  points.push(new THREE.Vector2(r, y));
}

// Top round
for (let i = 0; i <= 32; i++) {
  const t = i / 32;
  const r = innerRadius + Math.sin(t * Math.PI * 0.5) * crustDepth;
  const y = Math.sin(t * Math.PI) * crustThickness * 0.5;
  points.push(new THREE.Vector2(r, y));
}

// Close back to bottom
points.push(new THREE.Vector2(innerRadius, 0));

// --- Create geometry ---
let geom = new THREE.LatheGeometry(points, segments);

// ✅ Welds duplicate seam vertices to fix faint line
geom = mergeVertices(geom, 1e-4);

// ✅ Recalculate normals for smooth lighting
geom.computeVertexNormals();
geom.computeBoundingBox();

// --- Flip normals if necessary ---
geom.scale(1, 1, 1); // ensures consistent normal direction
geom.center();

// --- Material ---
const loader = new THREE.TextureLoader();
const doughTexture = loader.load("/textures/dough-texture.jpg");
doughTexture.wrapS = doughTexture.wrapT = THREE.RepeatWrapping;
doughTexture.repeat.set(3, 3);

const mat = new THREE.MeshStandardMaterial({
  map: doughTexture,
  color: 0xf5deb3,
  roughness: 0.8,
  metalness: 0,
  side: THREE.DoubleSide, // ✅ render both sides for safety
  transparent: false,     // ✅ ensure no transparency
  opacity: 1,
});

// --- Mesh ---
const mesh = new THREE.Mesh(geom, mat);
mesh.castShadow = true;
mesh.receiveShadow = true;

// --- Position correctly ---
const bbox = geom.boundingBox;
mesh.position.y = -bbox.min.y;

// --- Store top height ---
mesh.userData.topY = bbox.max.y - bbox.min.y + mesh.position.y;

return mesh;


}

function getToppingSurfaceY() {
  const sauce = sauceRef.current;
  const base = baseRef.current;

  if (sauce) {
    // sauce is always placed right on top of the base
    return sauce.position.y + 0.015; // toppings go slightly above sauce
  }

  // fallback if sauce isn't built yet
  if (base && base.geometry) {
    base.geometry.computeBoundingBox();
    const bbox = base.geometry.boundingBox;
    const top = new THREE.Vector3(0, bbox.max.y, 0);
    base.localToWorld(top);
    return top.y + 0.015;
  }

  return 0.015;
}




  // helper: create sauce mesh
  const createSauce = (type, size) => {
    const { height, radius } = getBaseDims(type, size);
    const geom = new THREE.CircleGeometry(radius * 0.95, 64);
  const mat = new THREE.MeshStandardMaterial({
  color: 0xc23b22,
  roughness: 0.6,
  metalness: 0.1,
  side: THREE.DoubleSide,
});
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = height - 0.01; // sits above base
    return mesh;
  };

  // helper: cheese blob
  const createCheeseBlob = (radius, y) => {
    const geom = new THREE.SphereGeometry(0.12 + Math.random() * 0.05, 8, 8);
const baseColor = new THREE.Color(0xfff2a1);
baseColor.offsetHSL((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.1, 0);
   const mat = new THREE.MeshStandardMaterial({
  color: baseColor,
  roughness: 0.8,
  metalness: 0.05,
});
    const mesh = new THREE.Mesh(geom, mat);
    mesh.scale.set(
      1.0 + Math.random() * 0.5,
      0.15 + Math.random() * 0.08,
      1.0 + Math.random() * 0.5
    );
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 0.9;
    mesh.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // scene setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3.8, 5.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(3, 5, 3);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
scene.add(dir);

const warmLight = new THREE.PointLight(0xfff2cc, 1.2, 15);
warmLight.position.set(2, 6, 3);
warmLight.castShadow = true;
scene.add(warmLight);

// fill light for softer shadows
const fillLight = new THREE.DirectionalLight(0xffeedd, 0.4);
fillLight.position.set(-3, 4, -2);
scene.add(fillLight);


    // table
  const table = new THREE.Mesh(
  new THREE.CircleGeometry(2.8, 64),
  new THREE.MeshStandardMaterial({ color: 0xe3dfd7, roughness: 0.9, opacity: 0.5, transparent: true })
);
table.receiveShadow = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
dir.shadow.bias = -0.0005;
dir.shadow.radius = 3;
    table.rotation.x = -Math.PI / 2;
    table.position.y = 0;
    table.receiveShadow = true;
    scene.add(table);

    // base
    const base = createBase(baseType, baseSize);
    scene.add(base);
    baseRef.current = base;

    // sauce
    const sauce = createSauce(baseType, baseSize);
    scene.add(sauce);
    sauceRef.current = sauce;

    // cheese group
    const cheeseGroup = new THREE.Group();
    scene.add(cheeseGroup);
    cheeseGroupRef.current = cheeseGroup;

// toppings layer just above sauce
const toppingsGroup = new THREE.Group();
scene.add(toppingsGroup);
toppingsGroupRef.current = toppingsGroup;

// --- Drag & Drop + Toppings Helpers ---
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dropPoint = new THREE.Vector3();

// --- Pointer & drag state ---
const pointer = new THREE.Vector2();
const pointerState = { dragging: false, offset: new THREE.Vector3() };
let selected = null;
// ---------- helper: get top Y of the cheese layer ----------
function getToppingSurfaceY()
 {
  if (sauceRef.current) {
    // sauce is placed on top of base; cheese should sit slightly above sauce
    return sauceRef.current.position.y + 0.02;
  }
  // fallback to base top
  return getTopOfBaseY() + 0.02;
}

// helper: create topping mesh
function createMeshForIngredient(ing) {
  const mat = new THREE.MeshStandardMaterial({
    color: ing.color,
    roughness: 0.75,
  });

  let mesh;
  switch (ing.kind) {
    case "cylinder":
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16), mat);
      break;
    case "mushroom":
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        mat
      );
      break;
    case "torus":
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 6, 12), mat);
      mesh.rotation.x = Math.PI / 2;
      break;
    case "leaf":
      mesh = new THREE.Mesh(new THREE.CircleGeometry(0.14, 8), mat);
      mesh.rotation.x = -Math.PI / 2;
      break;
    case "cube":
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.22), mat);
      break;
    default:
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat);
  }

  // store the "original" scale for later resizing (copy so we don't mutate)
  mesh.userData.baseScale = mesh.scale.clone(); 

  mesh.userData.ing = ing;
  mesh.castShadow = true;

  return mesh;
}

// snap helper
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1];
function snapToRingsIfNeeded(posVec) {
  if (!snapToRings) return posVec;
  const radius = (base.geometry.parameters?.radiusTop ?? 2.2) * base.scale.x;
  const dx = posVec.x;
  const dz = posVec.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 0.001) return posVec;

  const ringRadii = RING_FRACTIONS.map((f) => f * radius);
  let nearest = ringRadii[0];
  let minDiff = Math.abs(d - ringRadii[0]);
  for (let i = 1; i < ringRadii.length; i++) {
    const diff = Math.abs(d - ringRadii[i]);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = ringRadii[i];
    }
  }
  const threshold = 0.3;
  let finalR = d;
  if (Math.abs(d - nearest) <= threshold) {
    finalR = nearest;
  } else {
    finalR = Math.min(d, radius - 0.12);
  }
  const factor = finalR / d;
  return new THREE.Vector3(dx * factor, posVec.y, dz * factor);
}

function addIngredientAtWorldPos(ing, worldPos) {
  const mesh = createMeshForIngredient(ing);
  const pos = snapToRingsIfNeeded(worldPos);

  // dynamically compute correct Y position for topping
  const toppingY = getToppingSurfaceY();

  mesh.position.set(pos.x, toppingY, pos.z);

  // store baseScale for resizing logic
  mesh.userData.baseScale = mesh.scale.clone();

  toppingsGroupRef.current.add(mesh);
  return mesh;
}




// ---------- DOM drag handlers: replace handleDrop with this ----------
const handleDragOver = (e) => e.preventDefault();
const handleDrop = (e) => {
  e.preventDefault();
  try {
    const raw =
      e.dataTransfer.getData("application/json") ||
      e.dataTransfer.getData("text/plain");
    const ing = JSON.parse(raw);

    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x, y }, cameraRef.current);

    // prefer geometry hit (so drop on crust/cheese works), fallback to plane
    const targets = [];
    if (sauceRef.current) targets.push(sauceRef.current);
    if (baseRef.current) targets.push(baseRef.current);
    const hits = raycaster.intersectObjects(targets, true);

    if (hits.length > 0) {
      const hitPoint = hits[0].point;
      // use hit X,Z but use cheese top Y for final placement
      const cheeseTopY = getToppingSurfaceY()
;
      addIngredientAtWorldPos(
        ing,
        new THREE.Vector3(hitPoint.x, cheeseTopY, hitPoint.z)
      );
    } else {
      // fallback to plane intersection
      const planePoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0), 0), planePoint)) {
        const cheeseTopY = getToppingSurfaceY()
;
        addIngredientAtWorldPos(
          ing,
          new THREE.Vector3(planePoint.x, cheeseTopY, planePoint.z)
        );
      }
    }
  } catch (err) {
    console.warn("drop parse error", err);
  }
};


// attach listeners (make sure you don't double-add — if you add elsewhere, remove duplicates)
rendererRef.current.domElement.addEventListener("dragover", handleDragOver);
rendererRef.current.domElement.addEventListener("drop", handleDrop);

// ---------- Pointer move (drag existing topping) ----------
const onPointerMove = (e) => {
  if (!pointerState.dragging || !selected) return;
  const rect = rendererRef.current.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, cameraRef.current);

  const planePoint = new THREE.Vector3();
if (raycaster.ray.intersectPlane(plane, dropPoint)) {
  const target = dropPoint.clone().add(pointerState.offset);
  const snapped = snapToRingsIfNeeded(target);
 const toppingY = getToppingSurfaceY();
 selected.position.set(snapped.x, toppingY, snapped.z);
}
};
const onPointerDown = (e) => {
  if (e.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(toppingsGroup.children, true);
  if (intersects.length > 0) {
    selected = intersects[0].object;
    selected.userData.originalScale = selected.scale.clone();
    selected.scale.multiplyScalar(1.15);
    pointerState.dragging = true;
    const hitPoint = intersects[0].point.clone();
    pointerState.offset.copy(selected.position).sub(hitPoint);
  } else {
    if (selected) {
      if (selected.userData.originalScale)
        selected.scale.copy(selected.userData.originalScale);
      selected = null;
    }
  }
};

const onPointerUp = () => {
  pointerState.dragging = false;
  if (selected && selected.userData.originalScale)
    selected.scale.copy(selected.userData.originalScale);
};

renderer.domElement.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);

// --- Delete Key ---
const onKeyDown = (e) => {
  if ((e.key === "Delete" || e.key === "Backspace") && selected) {
    if (selected.parent) selected.parent.remove(selected);
    selected = null;
  }
};
window.addEventListener("keydown", onKeyDown);





    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 2.2;
    controls.maxDistance = 10;
    controlsRef.current = controls;






    // resize
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    // animation
    const animate = () => {
      requestAnimationFrame(animate);
      if (baseRef.current) baseRef.current.rotation.y += 0.0001;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // update base & sauce when type/size changes
useEffect(() => {
  const scene = sceneRef.current;
  if (!scene) return;

  // --- remove old base & sauce ---
  if (baseRef.current) {
    scene.remove(baseRef.current);
    baseRef.current.geometry.dispose();
    baseRef.current.material.dispose();
  }
  if (sauceRef.current) {
    scene.remove(sauceRef.current);
    sauceRef.current.geometry.dispose();
    sauceRef.current.material.dispose();
  }

  // --- create new base & sauce ---
  const base = createBase(baseType, baseSize);
  scene.add(base);
  baseRef.current = base;

  const sauce = createSauce(baseType, baseSize);
  scene.add(sauce);
  sauceRef.current = sauce;

  // --- realign toppings after rebuild ---
  const toppingsGroup = toppingsGroupRef.current;
  if (toppingsGroup && toppingsGroup.children.length > 0) {
    const toppingY = getToppingSurfaceY();
    toppingsGroup.children.forEach((child) => {
      child.position.y = toppingY;
    });
  }
}, [baseType, baseSize]);

  // update cheese
  useEffect(() => {
    const group = cheeseGroupRef.current;
    if (!group) return;
    group.clear();

    const { height, radius } = getBaseDims(baseType, baseSize);
    const cheeseY = height + -0.02;
    for (let i = 0; i < cheeseAmount; i++) {
      group.add(createCheeseBlob(radius, cheeseY));
    }
  }, [cheeseAmount, baseType, baseSize]);

  // UI actions
  const handleDragStart = (e, ing) => {
    e.dataTransfer.setData("application/json", JSON.stringify(ing));
    e.dataTransfer.setData("text/plain", JSON.stringify(ing));
  };

  const postToFeed = () => {
    const item = { id: Date.now(), baseType, baseSize, author: "anon" };
    setFeed((s) => [item, ...s]);
  };

  const downloadSnapshot = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const data = renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = data;
    a.download = `pizza-${Date.now()}.png`;
    a.click();
  };

const removeAllToppings = () => {
  const group = toppingsGroupRef.current;
  if (group) {
    while (group.children.length > 0) {
      const child = group.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  }
};

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden" }}>
      {/* LEFT Panel */}
      <aside style={{ width: 200, padding: 16, borderRight: "1px solid #2b2b2b", background: "#111" }}>
        <h2 style={{ color: "#fff", marginBottom: 12 }}>Ingredients</h2>
        <div style={{ display: "grid", gap: 8, height: 200, overflowY: "scroll", marginBottom: 20 }}>
          {INGREDIENTS.map((ing) => (
            <div
              key={ing.id}
              draggable
              onDragStart={(e) => handleDragStart(e, ing)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 6,
                background: "#222",
                color: "#fff",
                cursor: "grab",
              }}
            >
              <div style={{ width: 36, height: 36, background: `#${ing.color.toString(16).padStart(6, "0")}`, borderRadius: 6 }} />
              <div>{ing.name}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, color: "#ddd" }}>
          <div style={{ marginBottom: 8 }}>Base Type</div>
          <select value={baseType} onChange={(e) => setBaseType(e.target.value)} style={{ width: "100%", padding: 8 }}>
            <option value="thin">Thin</option>
            <option value="medium">Medium</option>
            <option value="thick">Thick</option>
          </select>

          <div style={{ marginTop: 12, marginBottom: 8 }}>Size</div>
          <select value={baseSize} onChange={(e) => setBaseSize(parseInt(e.target.value))} style={{ width: "100%", padding: 8 }}>
            <option value={28}>28 cm</option>
            <option value={33}>33 cm</option>
            <option value={40}>40 cm</option>
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: "#ddd" }}>
            <input type="checkbox" checked={snapToRings} onChange={(e) => setSnapToRings(e.target.checked)} />
            Snap to rings
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexDirection: "column" }}>
            <button onClick={downloadSnapshot} style={{ padding: "8px 12px" }}>Snapshot</button>
            <button onClick={postToFeed} style={{ padding: "8px 12px" }}>Post</button>
              <button onClick={removeAllToppings} style={{ padding: "8px 12px", background: "#5a1c1c", color: "#fff" }}> Remove Toppings  </button>
          </div>
        </div>

        <div style={{ marginTop: 20, color: "#ddd" }}>
          <div style={{ marginBottom: 8 }}>Cheese Amount</div>
          <input
            type="range"
            min={200}
            max={750}
            value={cheeseAmount}
            onChange={(e) => setCheeseAmount(parseInt(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: 12, color: "#aaa" }}>{cheeseAmount} blobs</div>
        </div>
      </aside>

      {/* Canvas */}
      <main style={{ flex: 1, position: "relative", background: "#222" }}>
        <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      </main>

      {/* Feed */}
      <aside style={{ width: 100, padding: 16, borderLeft: "1px solid #2b2b2b", background: "#111", color: "#eee" }}>
        <h3>Feed (local)</h3>
        {feed.length === 0 ? <div style={{ marginTop: 8, color: "#999" }}>No posts yet — create & post your pizza.</div> : null}
        <ul style={{ marginTop: 12 }}>
          {feed.map(item => (
            <li key={item.id} style={{ padding: 8, border: "1px solid #222", marginBottom: 8, borderRadius: 6 }}>
              <div style={{ fontWeight: 600 }}>{item.author}</div>
              <div style={{ fontSize: 12, color: "#bbb" }}>Base: {item.baseType} — {item.baseSize} cm</div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
