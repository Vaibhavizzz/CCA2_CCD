(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---------- 3D scene ---------- */
  const canvas = $("scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x10162b, 0.04);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(2, 1.5, 12);

  scene.add(new THREE.AmbientLight(0x8890d0, 0.7));
  const key = new THREE.PointLight(0xffffff, 1.2, 40);
  key.position.set(4, 6, 8);
  scene.add(key);

  const N = 7;
  const pts = [];
  for (let i = 0; i < N; i++) {
    pts.push(new THREE.Vector3(-7.5 + i * 2.5 + 3, Math.sin(i * 0.9) * 1.4, Math.cos(i * 0.9) * 1.8 - 1));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 240, 0.025, 8),
    new THREE.MeshBasicMaterial({ color: 0x3a4580, transparent: true, opacity: 0.8 })
  ));

  const nodeU = pts.map((p) => {
    let best = 0, bd = 1e9;
    for (let k = 0; k <= 400; k++) {
      const d = curve.getPointAt(k / 400).distanceTo(p);
      if (d < bd) { bd = d; best = k / 400; }
    }
    return best;
  });

  const accent = new THREE.Color("#ffb547");
  const nodes = pts.map((p) => {
    const g = new THREE.Group();
    g.position.copy(p);
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.4, flatShading: true })
    );
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62, 1)),
      new THREE.LineBasicMaterial({ color: 0x8e9bff, transparent: true, opacity: 0.55 })
    );
    g.add(core, shell);
    scene.add(g);
    return { g, core, shell, flash: 0, h: 0, s: 0, base: p.clone() };
  });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.018, 8, 80),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true })
  );
  scene.add(ring);
  let burst = 0;

  // packets with a fading trail of light behind them
  const TRAIL = 8;
  const packets = [0, 1, 2, 3].map(() => {
    const parts = [];
    for (let j = 0; j < TRAIL; j++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 * (1 - j / (TRAIL + 2)), 12, 12),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 1 - j / TRAIL })
      );
      scene.add(m);
      parts.push(m);
    }
    return parts;
  });

  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(900 * 3);
  for (let i = 0; i < sp.length; i += 3) {
    sp[i] = (Math.random() - 0.5) * 50;
    sp[i + 1] = (Math.random() - 0.5) * 30;
    sp[i + 2] = -Math.random() * 30 - 4;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9aa6ff, size: 0.05, transparent: true, opacity: 0.7 }));
  scene.add(stars);

  /* ---------- interaction state ---------- */
  let selected = 0, canvasHover = -1, listHover = -1;
  let mx = 0, my = 0;
  const look = new THREE.Vector3(2.5, 0, 0);
  const tip = $("tip");
  const ray = new THREE.Raycaster();
  const coreMeshes = nodes.map((n) => n.core);

  function pick(e) {
    ray.setFromCamera({ x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, camera);
    const hit = ray.intersectObjects(coreMeshes)[0];
    return hit ? coreMeshes.indexOf(hit.object) : -1;
  }
  addEventListener("pointermove", (e) => {
    mx = (e.clientX / innerWidth - 0.5) * 2;
    my = (e.clientY / innerHeight - 0.5) * 2;
    if (e.target === canvas) {
      canvasHover = pick(e);
      canvas.style.cursor = canvasHover >= 0 ? "pointer" : "default";
    } else canvasHover = -1;
  });
  canvas.addEventListener("click", (e) => { const i = pick(e); if (i >= 0) select(i); });

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.position.z = innerWidth < 760 ? 16 : 12;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();

  /* ---------- render loop ---------- */
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  function frame() {
    const t = clock.getElapsedTime();
    const sp_ = reduce ? 0 : 1;
    const hovered = canvasHover >= 0 ? canvasHover : listHover;

    // camera glides toward the selected stage and follows the mouse
    camera.position.x = lerp(camera.position.x, 1.2 + pts[selected].x * 0.25 + mx * 1.6, 0.04);
    camera.position.y = lerp(camera.position.y, 1.5 - my * 1.0, 0.04);
    look.lerp(tmp.set(pts[selected].x * 0.45 + 1.4, pts[selected].y * 0.4, 0), 0.04);
    camera.lookAt(look);

    nodes.forEach((n, i) => {
      n.h = lerp(n.h, i === hovered ? 1 : 0, 0.12);
      n.s = lerp(n.s, i === selected ? 1 : 0, 0.08);
      n.flash *= 0.94;

      n.g.position.y = n.base.y + Math.sin(t * 0.8 + i * 1.3) * 0.08 * sp_;
      n.core.rotation.x = t * (0.5 + n.h * 1.6) * sp_ + i;
      n.core.rotation.y = t * (0.7 + n.h * 1.2) * sp_;
      n.shell.rotation.y = -t * (0.3 + n.h * 0.9) * sp_;
      n.shell.scale.setScalar(1 + n.h * 0.45 + n.s * 0.1);
      n.shell.material.opacity = 0.5 + n.h * 0.45;
      n.core.material.emissiveIntensity = 0.4 + n.s * 0.5 + n.h * 0.9 + n.flash * 1.4;
      n.g.scale.setScalar(1 + n.flash * 0.3 + n.h * 0.4 + n.s * 0.15);
    });

    packets.forEach((parts, k) => {
      const u0 = (t * 0.05 * sp_ + k / packets.length) % 1;
      parts.forEach((m, j) => {
        m.position.copy(curve.getPointAt((u0 - j * 0.007 + 1) % 1));
      });
      nodeU.forEach((nu, i) => { if (Math.abs(u0 - nu) < 0.012) nodes[i].flash = 1; });
    });

    ring.position.lerp(nodes[selected].g.position, 0.08);
    burst *= 0.92;
    ring.scale.setScalar(1 + burst * 0.9 + Math.sin(t * 2) * 0.03 * sp_);
    ring.material.opacity = 0.55 + (1 - Math.min(burst, 1)) * 0.3;
    ring.rotation.x = t * 0.9 * sp_;
    ring.rotation.y = t * 0.6 * sp_;

    stars.rotation.y = t * 0.01 * sp_;
    stars.position.x = lerp(stars.position.x, -mx * 0.9, 0.03);
    stars.position.y = lerp(stars.position.y, my * 0.5, 0.03);

    // floating label that follows the hovered node
    if (hovered >= 0 && stagesData.length) {
      tmp.copy(nodes[hovered].g.position).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * innerWidth;
      const y = (-tmp.y * 0.5 + 0.5) * innerHeight;
      tip.style.transform = `translate(${x + 30}px, ${y - 26}px)`;
      if (tip.dataset.i !== String(hovered)) {
        tip.dataset.i = hovered;
        tip.innerHTML = "";
        const b = document.createElement("strong");
        b.textContent = stagesData[hovered].name;
        const s = document.createElement("span");
        s.textContent = stagesData[hovered].tool;
        tip.append(b, s);
      }
      tip.classList.add("show");
    } else tip.classList.remove("show");

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function setAccent(hex) {
    accent.set(hex);
    document.documentElement.style.setProperty("--accent", hex);
    nodes.forEach((n) => { n.core.material.color.set(hex); n.core.material.emissive.set(hex); });
    ring.material.color.set(hex);
    packets.forEach((parts) => parts.forEach((m) => m.material.color.set(hex)));
  }

  /* ---------- UI ---------- */
  let stagesData = [];
  function select(i) {
    selected = i;
    burst = 1;
    document.querySelectorAll("#stages button").forEach((b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
    $("d-name").textContent = stagesData[i].name;
    $("d-tool").textContent = stagesData[i].tool;
    $("d-text").textContent = stagesData[i].text;
    const d = $("detail");
    d.classList.remove("swap");
    void d.offsetWidth;
    d.classList.add("swap");
  }

  fetch("/api/pipeline").then((r) => r.json()).then((d) => {
    stagesData = d.stages;
    const list = $("stages");
    stagesData.forEach((s, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.textContent = s.name;
      b.addEventListener("click", () => select(i));
      b.addEventListener("pointerenter", () => { listHover = i; });
      b.addEventListener("pointerleave", () => { listHover = -1; });
      b.addEventListener("focus", () => { listHover = i; });
      b.addEventListener("blur", () => { listHover = -1; });
      li.appendChild(b);
      list.appendChild(li);
    });
    select(0);
  });

  let accentSet = "";
  const fmt = (sec) => { const m = Math.floor(sec / 60); return m ? `${m}m ${sec % 60}s` : `${sec}s`; };
  async function poll() {
    try {
      const s = await (await fetch("/api/status", { cache: "no-store" })).json();
      if (s.accent !== accentSet) { accentSet = s.accent; setAccent(s.accent); }
      $("s-version").textContent = s.version;
      $("s-build").textContent = "#" + s.build;
      $("s-pod").textContent = s.pod;
      $("s-uptime").textContent = fmt(s.uptime_seconds);
      $("dot").classList.add("live");
      $("s-msg").textContent = "";
    } catch (e) {
      $("dot").classList.remove("live");
      $("s-msg").textContent = "Can't reach the server. Retrying...";
    }
  }
  poll();
  setInterval(poll, 4000);
  frame();
})();
