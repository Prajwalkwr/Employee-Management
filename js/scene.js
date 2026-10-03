/* Live night backdrop for the employee system: temple, moon, lanterns, fog. */
(function () {
  const canvas = document.getElementById("gl");
  if (!canvas || !window.THREE) {
    document.documentElement.classList.add("no-webgl");
    return;
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  let scene;
  let camera;
  let running = true;
  const lanternLights = [];
  const hallLights = [];
  let moonHalo;
  let embers;
  const pointer = { x: 0, y: 0 };
  const look = { x: 0, y: 0 };
  let lastFrame = 0;

  function smooth(e0, e1, x) {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function moonTexture() {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size * 0.42, size * 0.4, size * 0.08, size / 2, size / 2, size * 0.48);
    g.addColorStop(0, "#f2f2f2");
    g.addColorStop(0.7, "#d7d7d7");
    g.addColorStop(1, "#bfbfbf");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(40, 40, 42, 0.28)";
    [[78, 118, 54, 36], [126, 96, 34, 28], [150, 132, 26, 18], [92, 150, 22, 16]].forEach(([x, y, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function glowTexture() {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function roofGeometry(halfX, halfZ, height, flare) {
    const geo = new THREE.PlaneGeometry(halfX * 2, halfZ * 2, 28, 18);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const tx = Math.min(1, Math.abs(x) / halfX);
      const tz = Math.min(1, Math.abs(z) / halfZ);
      const t = Math.max(tx, tz);
      const y = height * Math.pow(1 - t, 1.35) + flare * smooth(0.7, 1, t) * (0.45 + 0.55 * Math.min(tx, tz));
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function makeGrain() {
    const grain = document.getElementById("grain");
    if (!grain) return;
    const size = 160;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = 90 + Math.random() * 120;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    grain.style.backgroundImage = "url(" + c.toDataURL("image/png") + ")";
  }

  function build() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.setClearColor(0x05070a, 1);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1218);
    scene.fog = new THREE.FogExp2(0x0b141b, 0.011);
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 220);
    camera.position.set(0.4, 4.6, 16);

    scene.add(new THREE.HemisphereLight(0x8eb4c4, 0x1a120e, 0.85));
    const key = new THREE.DirectionalLight(0xd5e7ef, 2.4);
    key.position.set(-8, 20, 10);
    scene.add(key);
    const moonKey = new THREE.DirectionalLight(0xff5a32, 2.2);
    moonKey.position.set(18, 26, -30);
    scene.add(moonKey);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(90, 64),
      new THREE.MeshStandardMaterial({ color: 0x141b20, roughness: 0.94, metalness: 0.04 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const timber = new THREE.MeshStandardMaterial({ color: 0x4a403c, roughness: 0.82, metalness: 0.05 });
    const tile = new THREE.MeshStandardMaterial({ color: 0x3d4c54, roughness: 0.62, metalness: 0.18 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x5d696e, roughness: 0.9, metalness: 0.03 });
    const paper = new THREE.MeshBasicMaterial({ color: 0xffb060, toneMapped: false, fog: false });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x101614, roughness: 1 });
    const bark = new THREE.MeshStandardMaterial({ color: 0x161311, roughness: 1 });

    const temple = new THREE.Group();
    const podium = new THREE.Mesh(new THREE.BoxGeometry(16, 1.5, 10), stone);
    podium.position.set(0, 0.75, -18);
    temple.add(podium);

    for (let i = 0; i < 10; i++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(5.2 + (10 - i) * 0.12, 0.16, 0.62), stone);
      tread.position.set(0, 0.1 + i * 0.15, -10.2 - i * 0.62);
      temple.add(tread);
    }

    const hall = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3.3, 5.4), timber);
    hall.position.set(0, 3.15, -18);
    temple.add(hall);

    for (let i = 0; i < 4; i++) {
      const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.7), paper);
      windowPane.position.set(-2.4 + i * 1.6, 3.15, -15.28);
      temple.add(windowPane);
    }

    const lowerRoof = new THREE.Mesh(roofGeometry(6.4, 4.2, 1.7, 0.45), tile);
    lowerRoof.position.set(0, 4.7, -18);
    temple.add(lowerRoof);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.1, 3.8), timber);
    upper.position.set(0, 6.5, -18);
    temple.add(upper);
    const upperRoof = new THREE.Mesh(roofGeometry(4.8, 3.2, 1.8, 0.4), tile);
    upperRoof.position.set(0, 7.7, -18);
    temple.add(upperRoof);

    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 3.2), timber);
      wing.position.set(side * 6.5, 2.5, -17.2);
      temple.add(wing);
      const wingRoof = new THREE.Mesh(roofGeometry(2.3, 2.1, 0.9, 0.25), tile);
      wingRoof.position.set(side * 6.5, 3.7, -17.2);
      temple.add(wingRoof);
    });

    scene.add(temple);

    const hallLight = new THREE.PointLight(0xff8a3c, 80, 28, 2);
    hallLight.position.set(0, 3.3, -12);
    scene.add(hallLight);
    hallLights.push(hallLight);
    const spill = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(),
      color: new THREE.Color(1, 0.42, 0.16),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
      fog: false,
      toneMapped: false
    }));
    spill.position.set(4.2, 10.2, -18);
    spill.scale.set(16, 9, 1);
    scene.add(spill);

    const red = new THREE.MeshStandardMaterial({ color: 0xa11d16, roughness: 0.48, metalness: 0.08 });
    const gold = new THREE.MeshStandardMaterial({ color: 0x8a6a32, roughness: 0.45, metalness: 0.45 });
    const torii = new THREE.Group();
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.4, 12), red);
      post.position.set(side * 1.7, 2.2, 0);
      torii.add(post);
    });
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.28, 0.28), red);
    nuki.position.set(0, 3.5, 0);
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.22, 0.46), red);
    kasagi.position.set(0, 4.15, 0);
    kasagi.rotation.z = 0;
    torii.add(nuki, kasagi);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), gold);
    cap.position.set(0, 3.85, 0);
    torii.add(cap);
    torii.position.set(-12.4, -0.4, 4.5);
    torii.scale.setScalar(0.62);
    scene.add(torii);

    function lantern(x, z, scale) {
      const group = new THREE.Group();
      const rock = new THREE.MeshStandardMaterial({ color: 0x8e9998, roughness: 0.84 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.18, 10), rock);
      base.position.y = 0.09;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.78, 10), rock);
      post.position.y = 0.56;
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.34, 0.34),
        new THREE.MeshStandardMaterial({ color: 0x2c2624, roughness: 0.6, emissive: 0x5a2414, emissiveIntensity: 0.55 })
      );
      housing.position.y = 1.08;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0xffb06a, toneMapped: false }));
      pane.position.set(0, 1.08, 0.175);
      const lid = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.28, 4), rock);
      lid.position.y = 1.38;
      lid.rotation.y = Math.PI / 4;
      const light = new THREE.PointLight(0xff6a2a, 16, 9, 2);
      light.position.y = 1.08;
      group.add(base, post, housing, pane, lid, light);
      group.position.set(x, 0, z);
      group.scale.setScalar(scale);
      scene.add(group);
      lanternLights.push(light);
    }

    lantern(8.6, 1.5, 1.35);
    lantern(-4.2, -8.5, 1.05);
    lantern(6.4, -9.2, 1);
    lantern(2.2, -6.5, 0.85);

    function tree(x, z, scale) {
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 1.5 * scale, 6), bark);
      trunk.position.y = 0.75 * scale;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.15 * scale, 2.6 * scale, 7), leaf);
      crown.position.y = 2.3 * scale;
      group.add(trunk, crown);
      group.position.set(x, 0, z);
      scene.add(group);
    }

    tree(-13, -6, 1.4);
    tree(14, -8, 1.6);
    tree(-16, -16, 1.8);
    tree(15.5, -18, 1.5);

    const moonTex = moonTexture();
    const glowTex = glowTexture();
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex,
      color: new THREE.Color(1.45, 0.42, 0.38),
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false
    }));
    moon.position.set(11, 13.5, -36);
    moon.scale.set(11, 11, 1);
    scene.add(moon);

    moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: new THREE.Color(1, 0.28, 0.18),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.55,
      toneMapped: false
    }));
    moonHalo.position.copy(moon.position);
    moonHalo.scale.set(34, 34, 1);
    scene.add(moonHalo);

    const count = 160;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 28;
      positions[i * 3 + 1] = Math.random() * 12;
      positions[i * 3 + 2] = -2 - Math.random() * 24;
      seeds[i] = Math.random();
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
      color: 0xff8a4a,
      size: 0.08,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    }));
    embers.userData.seeds = seeds;
    scene.add(embers);
  }

  function resize() {
    if (!renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    if (!running) return;
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    const t = now / 1000;
    if (!reduce) {
      look.x += (pointer.x - look.x) * 0.04;
      look.y += (pointer.y - look.y) * 0.04;
      camera.position.x = 0.4 + Math.sin(t * 0.08) * 0.55 + look.x * 1.1;
      camera.position.y = 4.6 + Math.sin(t * 0.05) * 0.12 + look.y * 0.35;
      lanternLights.forEach((light, i) => {
        light.intensity = 14 + Math.sin(t * (2.2 + i * 0.35) + i) * 3.5;
      });
      hallLights.forEach((light) => {
        light.intensity = 26 + Math.sin(t * 0.7) * 3;
      });
      if (moonHalo) moonHalo.material.opacity = 0.48 + Math.sin(t * 0.35) * 0.08;
      const pos = embers.geometry.attributes.position.array;
      const seeds = embers.userData.seeds;
      for (let i = 0; i < seeds.length; i++) {
        pos[i * 3 + 1] += dt * (0.22 + seeds[i] * 0.45);
        if (pos[i * 3 + 1] > 13) pos[i * 3 + 1] = 0;
      }
      embers.geometry.attributes.position.needsUpdate = true;
    }
    camera.lookAt(0, 5.2, -18);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  try {
    makeGrain();
    build();
    resize();
    canvas.classList.add("ready");
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      running = false;
      document.documentElement.classList.add("no-webgl");
    });
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    document.documentElement.classList.add("no-webgl");
  }
})();
