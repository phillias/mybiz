// WebGL globe for the Phileas Fogg hero (overdrive upgrade).
// Progressive enhancement: if WebGL is unavailable or reduced-motion+no-JS,
// the inline SVG globe (in index.astro) stays. The render loop only runs while
// the hero is near the viewport (paused off-screen).
import * as THREE from "three";

interface GlobeOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
}

export function mountGlobe({ canvas, container }: GlobeOptions): boolean {
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return false; // keep the SVG fallback

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 3.4);

  const globe = new THREE.Group();
  globe.rotation.x = 0.35;
  scene.add(globe);

  // Faint wireframe sphere
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 40, 26)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 }),
  );
  globe.add(wire);

  // Latitude rings
  const ringMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
  for (const lat of [-45, -22.5, 0, 22.5, 45]) {
    const r = Math.cos((lat * Math.PI) / 180);
    const y = Math.sin((lat * Math.PI) / 180);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
  }

  // Great-circle arcs (lerp + normalize ≈ great circle on a unit sphere)
  const toVec = (lon: number, lat: number) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
  };
  const arc = (lonA: number, latA: number, lonB: number, latB: number, opacity = 0.7) => {
    const a = toVec(lonA, latA);
    const b = toVec(lonB, latB);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 56; i++) {
      pts.push(a.clone().lerp(b, i / 56).normalize());
    }
    globe.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xf59a5c, transparent: true, opacity }),
      ),
    );
  };
  arc(-0.1, 51.5, -74.0, 40.7); // London -> New York
  arc(-74.0, 40.7, 36.8, -1.3); // New York -> Nairobi
  arc(36.8, -1.3, 103.8, 1.35); // Nairobi -> Singapore
  arc(103.8, 1.35, 151.2, -33.9, 0.45); // Singapore -> Sydney

  // Waypoint dots at arc endpoints
  const dots = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints([
      toVec(-0.1, 51.5),
      toVec(-74.0, 40.7),
      toVec(36.8, -1.3),
      toVec(103.8, 1.35),
      toVec(151.2, -33.9),
    ]),
    new THREE.PointsMaterial({ color: 0xf59a5c, size: 0.035, transparent: true, opacity: 0.95 }),
  );
  globe.add(dots);

  const resize = () => {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  container.classList.add("globe-upgraded");

  // Pause the loop while the hero is off-screen.
  let visible = false;
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
    },
    { threshold: 0.05 },
  );
  io.observe(container);

  const SPEED = reduceMotion ? 0 : 0.0016;
  const loop = () => {
    if (visible) {
      globe.rotation.y += SPEED;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return true;
}
