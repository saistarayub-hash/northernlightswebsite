import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const canvas = document.querySelector('#stage-canvas');
let LOW_POWER = false;
if (canvas) start(canvas).catch(() => document.body.classList.add('stage-fallback'));

async function start(canvas) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  LOW_POWER = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW_POWER, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_POWER ? 1.3 : 1.7));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06120d, 0.05);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0.4, 2.6, 7.4);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.15, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.52;
  controls.minDistance = 4.4;
  controls.maxDistance = 9.5;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.45;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;

  scene.add(new THREE.HemisphereLight(0xdfffc4, 0x0a1810, 0.55));
  const key = new THREE.DirectionalLight(0xf2ffe0, 1.5);
  key.position.set(3.4, 6, 4.5);
  scene.add(key);
  const rim = new THREE.PointLight(0x9dff7a, 26, 16, 2);
  rim.position.set(-3.2, 2.4, -2.6);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffb972, 12, 14, 2);
  warm.position.set(2.6, 1.4, 3);
  scene.add(warm);
  const spot = new THREE.SpotLight(0xd6ffa8, 40, 18, 0.6, 0.6, 1.6);
  spot.position.set(0, 8, 1.5);
  scene.add(spot);

  // Photo backdrop: the room imagery pans around the scene as you orbit.
  const roomTex = await loadTexture('/images/hero-room.jpg');
  roomTex.wrapS = THREE.RepeatWrapping;
  roomTex.repeat.set(2.4, 1);
  const dome = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, 9, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: roomTex, side: THREE.BackSide, color: 0x6d8a72 })
  );
  dome.position.y = 3.4;
  scene.add(dome);

  // Stage floor
  const floorTex = radialTexture('#20402c', '#050b08');
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 72),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0x486b52, metalness: 0.5, roughness: 0.42 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.05, 0.015, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xb6ff86, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  const pedestal = (radius, y = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.04, 0.16, 48),
      new THREE.MeshStandardMaterial({ color: 0x101d16, metalness: 0.85, roughness: 0.32 })
    );
    mesh.position.y = y + 0.08;
    return mesh;
  };

  const stage = new THREE.Group();
  scene.add(stage);

  const mainPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.45, 0.9, 56),
    new THREE.MeshStandardMaterial({ color: 0x0d1a13, metalness: 0.8, roughness: 0.3 })
  );
  mainPedestal.position.y = 0.45;
  stage.add(mainPedestal);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.36, 0.02, 8, 120),
    new THREE.MeshBasicMaterial({ color: 0xc9ff92, transparent: true, opacity: 0.75 })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.92;
  stage.add(halo);

  // Hero can
  const canTex = await canTexture();
  const can = buildCan(canTex);
  can.position.y = 0.9;
  stage.add(can);

  const products = [];
  const addProduct = (group, angle, label, radius = 2.55) => {
    const holder = new THREE.Group();
    holder.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    holder.rotation.y = angle;
    const base = pedestal(0.42);
    holder.add(base);
    group.position.y = 0.16;
    group.traverse(o => (o.userData.productRoot = group));
    holder.add(group);
    const sprite = labelSprite(label);
    sprite.position.set(0, group.userData.height + 0.5, 0);
    holder.add(sprite);
    holder.userData.spin = group.userData.spin || 0.004;
    stage.add(holder);
    products.push({ root: group, holder, ...group.userData });
    return holder;
  };

  const count = 6;
  const builders = [
    () => buildPreroll(),
    () => buildPen(),
    () => buildDabJar(),
    () => buildBong(),
    () => buildFlowerJar(),
    () => buildGummies(),
  ];
  const labels = ['SODAZE', '10TH PLANET', 'NL HOUSE', 'GLASS', 'FLOWER', 'EDIBLES'];
  builders.forEach((build, index) => {
    const group = build();
    const angle = ((index + 1) / count) * Math.PI * 2;
    addProduct(group, angle, labels[index]);
  });

  // Aurora particles
  const particleCount = reduced ? 0 : LOW_POWER ? 140 : 260;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.2 + Math.random() * 6.5;
    positions[i * 3] = Math.sin(angle) * radius;
    positions[i * 3 + 1] = Math.random() * 5.5;
    positions[i * 3 + 2] = Math.cos(angle) * radius;
  }
  const particles = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)),
    new THREE.PointsMaterial({ color: 0xcaffa0, size: 0.05, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  scene.add(particles);

  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(4.1, 0.01, 6, 140),
    new THREE.MeshBasicMaterial({ color: 0xdcffb0, transparent: true, opacity: 0.35 })
  );
  glow.rotation.set(1.25, 0.4, 0);
  glow.position.y = 2.6;
  scene.add(glow);

  // Post processing
  const useBloom = window.innerWidth > 720 && !reduced;
  let composer = null;
  if (useBloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.6, 0.86));
    composer.addPass(new OutputPass());
  }

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const info = document.querySelector('#stage-info');
  let selected = null;
  let focusUntil = 0;

  const showInfo = product => {
    if (!info) return;
    info.innerHTML = `<b>${product.label}</b><span>${product.name}</span><small>${product.note}</small><em>Tap another piece or drag to explore</em>`;
    info.classList.add('active');
  };

  const findProduct = object => {
    let node = object;
    while (node) {
      if (node.userData.productRoot) return node.userData.productRoot;
      node = node.parent;
    }
    return null;
  };

  let downAt = null;
  canvas.addEventListener('pointerdown', event => { downAt = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointerup', event => {
    if (!downAt) return;
    const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
    downAt = null;
    if (moved > 8) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([can, ...products.map(p => p.root)], true)[0];
    if (!hit) return;
    const root = findProduct(hit.object) || can;
    const match = products.find(p => p.root === root);
    selected = match || { label: 'NORTHERN LIGHTS', name: 'Sodaze Craft Soda', note: 'Featured brand · confirm stock in store', root: can };
    showInfo(selected);
    focusUntil = performance.now() + 3200;
    controls.autoRotate = false;
  });

  window.addEventListener('nl:focus-product', event => {
    const match = products.find(p => p.label === event.detail);
    if (match) {
      selected = match;
      showInfo(match);
      focusUntil = performance.now() + 3200;
    }
  });

  const clock = new THREE.Clock();
  let visible = true;
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { threshold: 0.05 }).observe(canvas);

  const desiredTarget = new THREE.Vector3(0, 1.15, 0);
  const renderFrame = () => {
    const elapsed = clock.getElapsedTime();
    requestAnimationFrame(renderFrame);
    if (!visible || document.hidden) return;
    const now = performance.now();
    if (selected?.holder && now < focusUntil) {
      desiredTarget.set(selected.holder.position.x * 0.55, 1.0, selected.holder.position.z * 0.55);
    } else {
      desiredTarget.set(0, 1.15, 0);
    }
    controls.target.lerp(desiredTarget, 0.05);
    if (!controls.autoRotate && now > focusUntil && !reduced) controls.autoRotate = true;
    controls.update();
    can.rotation.y += reduced ? 0 : 0.0035;
    products.forEach((product, index) => {
      product.root.rotation.y += reduced ? 0 : product.spin;
      product.root.position.y = 0.16 + Math.sin(elapsed * 1.4 + index) * 0.035;
    });
    particles.rotation.y = elapsed * 0.04;
    glow.rotation.z = Math.sin(elapsed * 0.2) * 0.3;
    halo.material.opacity = 0.6 + Math.sin(elapsed * 2) * 0.2;
    if (composer) composer.render();
    else renderer.render(scene, camera);
  };
  renderFrame();
  document.body.classList.add('stage-live');
}

function radialTexture(inner, outer) {
  const size = 512;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.canvas.width = size;
  ctx.canvas.height = size;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.55, '#12241a');
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      resolve(texture);
    }, undefined, reject);
  });
}

async function canTexture() {
  const label = await loadTexture('/images/front-can.webp');
  const size = 1400;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.canvas.width = size;
  ctx.canvas.height = size;
  ctx.fillStyle = '#edf0eb';
  ctx.fillRect(0, 0, size, size);
  // Preserve the label's own proportions and repeat it twice around the can, like a printed wrap.
  const ratio = label.image.height / label.image.width;
  const labelHeight = size;
  const labelWidth = labelHeight / ratio;
  const slot = size / 2;
  for (let i = 0; i < 2; i += 1) {
    ctx.drawImage(label.image, i * slot + (slot - labelWidth) / 2, 0, labelWidth, labelHeight);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, size);
  shade.addColorStop(0, 'rgba(255,255,255,0.35)');
  shade.addColorStop(0.08, 'rgba(0,0,0,0)');
  shade.addColorStop(0.92, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function labelSprite(text) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.canvas.width = 640;
  ctx.canvas.height = 160;
  ctx.font = '600 52px "DM Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d8ffab';
  ctx.fillText(text, 320, 74);
  ctx.strokeStyle = '#8ce06355';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 34, 520, 92);
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.5, 0.375, 1);
  return sprite;
}

function metal(color = 0x2b3a31, roughness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness });
}

function glass(color = 0xdff5e6, thickness = 0.6) {
  if (LOW_POWER) return new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.55 });
  return new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.05, transmission: 0.92, thickness, ior: 1.45, transparent: true, opacity: 0.85 });
}

function buildCan(texture) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 2.35, 72, 1, true),
    new THREE.MeshStandardMaterial({ map: texture, metalness: 0.32, roughness: 0.28, side: THREE.DoubleSide })
  );
  group.add(body);
  const cap = new THREE.CylinderGeometry(0.62, 0.62, 0.06, 64);
  const top = new THREE.Mesh(cap, metal(0xc9d3cc, 0.22));
  top.position.y = 1.17;
  group.add(top);
  const bottom = top.clone();
  bottom.position.y = -1.17;
  group.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.022, 8, 64), metal(0xdfe8e0, 0.2));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.2;
  group.add(rim);
  group.userData = { label: 'SODAZE', name: 'Sodaze Craft Soda', note: 'Featured brand · confirm stock in store', height: 2.35, spin: 0 };
  return group;
}

function buildPreroll() {
  const group = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: 0xf3ecd8, roughness: 0.92 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 1.5, 24), paper);
  body.position.y = 0.75;
  group.add(body);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 20), new THREE.MeshStandardMaterial({ color: 0x1f1a12, roughness: 1 }));
  tip.position.y = 1.57;
  group.add(tip);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff5a1e, emissiveIntensity: 2.4 }));
  ember.position.y = 1.66;
  group.add(ember);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.28, 24), new THREE.MeshStandardMaterial({ color: 0x24502c, roughness: 0.6 }));
  band.position.y = 0.72;
  group.add(band);
  group.rotation.z = 0.16;
  group.userData = { label: 'SODAZE', name: 'Sodaze Prerolls', note: 'Rolled preroll display · confirm strains', height: 1.5, spin: 0.008 };
  return group;
}

function buildPen() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.45, 40), metal(0x14181a, 0.34));
  body.position.y = 0.72;
  group.add(body);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.42, 40), metal(0x9aa79f, 0.22));
  sleeve.position.y = 0.45;
  group.add(sleeve);
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.24, 32), new THREE.MeshStandardMaterial({ color: 0x22302a, roughness: 0.5 }));
  mouth.position.y = 1.55;
  group.add(mouth);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshStandardMaterial({ color: 0xd4ff9d, emissive: 0x9dff5e, emissiveIntensity: 5 }));
  led.position.set(0.075, 0.28, 0.06);
  group.add(led);
  group.userData = { label: '10TH PLANET', name: '10th Planet Dab Pen', note: 'Featured brand · confirm flavours', height: 1.6, spin: 0.006 };
  return group;
}

function buildDabJar() {
  const group = new THREE.Group();
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.72, 48, 1, true), glass(0xe8f7ec, 0.5));
  jar.material.side = THREE.DoubleSide;
  jar.position.y = 0.36;
  group.add(jar);
  const extract = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.44, 40),
    new THREE.MeshStandardMaterial({ color: 0xd79a3c, emissive: 0x6b3f0d, emissiveIntensity: 0.4, metalness: 0.2, roughness: 0.15 })
  );
  extract.position.y = 0.24;
  group.add(extract);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.18, 48), new THREE.MeshStandardMaterial({ color: 0x111815, roughness: 0.55 }));
  lid.position.y = 0.8;
  group.add(lid);
  group.userData = { label: 'NL HOUSE', name: 'House Dab Jar', note: 'Concentrate display · confirm strains', height: 0.9, spin: 0.007 };
  return group;
}

function buildBong() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.44, 40, 32), glass(0xe2f6ea, 0.9));
  base.scale.y = 1.05;
  base.position.y = 0.42;
  group.add(base);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.15, 40, 1, true), glass(0xe2f6ea, 0.6));
  neck.position.y = 1.3;
  group.add(neck);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 12, 48), glass(0xf2fff7, 0.4));
  mouth.rotation.x = Math.PI / 2;
  mouth.position.y = 1.88;
  group.add(mouth);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.7, 24), glass(0xe2f6ea, 0.4));
  stem.rotation.z = 0.7;
  stem.position.set(0.28, 0.62, 0);
  group.add(stem);
  group.userData = { label: 'GLASS', name: 'Aurora Recycler', note: 'Glass display · confirm stock', height: 1.9, spin: 0.004 };
  return group;
}

function buildFlowerJar() {
  const group = new THREE.Group();
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.85, 48, 1, true), glass(0xe6f8ec, 0.6));
  jar.material.side = THREE.DoubleSide;
  jar.position.y = 0.42;
  group.add(jar);
  const budMat = new THREE.MeshStandardMaterial({ color: 0x5f8f43, roughness: 0.85, emissive: 0x1d3a17, emissiveIntensity: 0.3 });
  for (let i = 0; i < 7; i += 1) {
    const bud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + Math.random() * 0.06, 1), budMat);
    const a = (i / 7) * Math.PI * 2;
    bud.position.set(Math.cos(a) * 0.2, 0.22 + (i % 3) * 0.16, Math.sin(a) * 0.2);
    bud.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(bud);
  }
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.16, 48), new THREE.MeshStandardMaterial({ color: 0x121a16, roughness: 0.5 }));
  lid.position.y = 0.92;
  group.add(lid);
  group.userData = { label: 'FLOWER', name: 'Northern Flower Jar', note: 'Flower display · confirm strains', height: 1.0, spin: 0.006 };
  return group;
}

function buildGummies() {
  const group = new THREE.Group();
  const pouch = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 1.0, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1d5c39, roughness: 0.42, metalness: 0.12 })
  );
  pouch.position.y = 0.5;
  group.add(pouch);
  const seal = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.1, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xd5b46a, metalness: 0.75, roughness: 0.28 })
  );
  seal.position.y = 1.02;
  group.add(seal);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xd8ffab, emissive: 0x7ec24e, emissiveIntensity: 0.55 })
  );
  label.position.set(0, 0.62, 0.101);
  group.add(label);
  const labelBack = label.clone();
  labelBack.position.z = -0.101;
  labelBack.rotation.y = Math.PI;
  group.add(labelBack);
  for (let i = 0; i < 4; i += 1) {
    const sweet = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.045, 10, 24),
      new THREE.MeshPhysicalMaterial({ color: [0xff7ab0, 0xffd166, 0x8be08a, 0xb98cff][i], roughness: 0.2, clearcoat: 0.9 })
    );
    sweet.position.set(-0.34 + i * 0.22, 0.1, 0.3);
    sweet.rotation.x = Math.PI / 2.6;
    sweet.rotation.z = i;
    group.add(sweet);
  }
  group.userData = { label: 'EDIBLES', name: 'Infused Gummies', note: 'Edible display · confirm stock', height: 1.1, spin: 0.006 };
  return group;
}
