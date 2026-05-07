"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Course } from "@/lib/types";

const CLUSTERS: Record<string, { labels: string[]; color: string }> = {
  "Policy & Governance": { color: "#3b82f6", labels: ["policy analysis","regulatory policy","public policy","governance","democracy","comparative politics","political science","international relations","global governance","immigration","human rights","data governance","energy policy","environmental policy","housing policy"] },
  "Law & Justice":       { color: "#6366f1", labels: ["constitutional law","civil rights law","international law","administrative law","corporate law","criminal justice","environmental law","property law","legal technology","social justice","racial equity","gender equity"] },
  "Science & Tech":      { color: "#8b5cf6", labels: ["mathematics","physics","chemistry","biology & genetics","computer science","artificial intelligence","neuroscience","quantitative methods","biostatistics","cybersecurity","digital media"] },
  "Health":              { color: "#10b981", labels: ["public health","global health","health policy","infectious disease","epidemiology","mental health","nutrition & health","environmental health"] },
  "Arts & Culture":      { color: "#f59e0b", labels: ["arts & humanities","cultural heritage","linguistics","theology","religion","religious history","Hebrew Bible","history","philosophy","anthropology","sociology"] },
  "Design & Environment":{ color: "#84cc16", labels: ["ecology","climate change","architecture","urban design","landscape architecture","urban planning","design research","sustainability","water resources","infrastructure","historic preservation"] },
  "Society & Economics": { color: "#f97316", labels: ["economics","inequality","leadership","psychology","learning sciences","education policy","entrepreneurship","finance","marketing","behavioral economics","organizational behavior","operations management","strategy","economic development","urban economics","community development","global development","public finance","curriculum design","qualitative research","negotiation","accounting"] },
  "Cross-cutting":       { color: "#ec4899", labels: ["interdisciplinary studies","ethics"] },
};

function getCluster(l: string) { for (const [n, { labels }] of Object.entries(CLUSTERS)) if (labels.includes(l)) return n; return "Cross-cutting"; }
function getColor(l: string) { return CLUSTERS[getCluster(l)]?.color ?? "#94a3b8"; }
function hex2rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

interface Node { id: string; cluster: string; count: number; x: number; y: number; vx: number; vy: number; fx?: number|null; fy?: number|null; }
interface Link { source: Node; target: Node; weight: number; }

function nodeR(n: Node) { return Math.max(8, Math.sqrt(n.count) * 5 + 6); }

function buildSim(nodes: Node[], links: Link[], w: number, h: number) {
  let alpha = 1, stopped = false, raf = 0;
  const k = Math.sqrt((w * h) / Math.max(nodes.length, 1)) * 0.9;

  function centroids() {
    const m = new Map<string, { sx: number; sy: number; n: number }>();
    for (const nd of nodes) { const e = m.get(nd.cluster) ?? { sx: 0, sy: 0, n: 0 }; e.sx += nd.x; e.sy += nd.y; e.n++; m.set(nd.cluster, e); }
    const out = new Map<string, { x: number; y: number }>();
    for (const [cl, { sx, sy, n }] of m) out.set(cl, { x: sx / n, y: sy / n });
    return out;
  }

  function tick() {
    if (stopped) return;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = (b.x - a.x) || 0.01, dy = (b.y - a.y) || 0.01, d = Math.sqrt(dx*dx + dy*dy) || 0.01;
      const kf = a.cluster === b.cluster ? k * 0.55 : k * 1.4, f = (kf * kf) / d * alpha;
      a.vx -= (dx/d)*f; a.vy -= (dy/d)*f; b.vx += (dx/d)*f; b.vy += (dy/d)*f;
    }
    for (const l of links) {
      const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y, d = Math.sqrt(dx*dx + dy*dy) || 0.01;
      const ideal = k * 0.6, f = (d - ideal) * 0.06 * alpha;
      l.source.vx += (dx/d)*f; l.source.vy += (dy/d)*f; l.target.vx -= (dx/d)*f; l.target.vy -= (dy/d)*f;
    }
    const cents = centroids();
    for (const nd of nodes) { const c = cents.get(nd.cluster); if (c) { nd.vx += (c.x - nd.x) * 0.12 * alpha; nd.vy += (c.y - nd.y) * 0.12 * alpha; } }
    for (const nd of nodes) { nd.vx += (w/2 - nd.x) * 0.006 * alpha; nd.vy += (h/2 - nd.y) * 0.006 * alpha; }
    for (const nd of nodes) {
      if (nd.fx != null) { nd.x = nd.fx; nd.vx = 0; } else { nd.vx *= 0.45; nd.x += nd.vx; }
      if (nd.fy != null) { nd.y = nd.fy; nd.vy = 0; } else { nd.vy *= 0.45; nd.y += nd.vy; }
    }
    alpha *= 0.975;
    if (alpha > 0.004) raf = requestAnimationFrame(tick); else stopped = true;
  }
  raf = requestAnimationFrame(tick);
  return { stop: () => { stopped = true; cancelAnimationFrame(raf); }, reheat: () => { if (stopped) { stopped = false; alpha = 0.35; raf = requestAnimationFrame(tick); } } };
}

interface Props { courses: Course[]; onSelectLabel: (label: string) => void; }

export default function ExploreGraph({ courses, onSelectLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);
  const simRef = useRef<{ stop: () => void; reheat: () => void } | null>(null);
  const hovRef = useRef<Node | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const [dims, setDims] = useState({ w: 800, h: 560 });
  const [hovNode, setHovNode] = useState<Node | null>(null);

  // Observe container size
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      setDims({ w: width, h: Math.max(420, Math.min(640, width * 0.65)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync canvas pixel size to logical dims
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr; canvas.height = dims.h * dpr;
    canvas.style.width = `${dims.w}px`; canvas.style.height = `${dims.h}px`;
    const ctx = canvas.getContext("2d"); if (ctx) ctx.scale(dpr, dpr);
  }, [dims]);

  // Build graph data whenever courses change
  useEffect(() => {
    // Label frequency
    const freq = new Map<string, number>();
    for (const c of courses) for (const kw of c.keywordList ?? []) freq.set(kw, (freq.get(kw) ?? 0) + 1);

    // Co-occurrence
    const coOcc: Record<string, Record<string, number>> = {};
    for (const c of courses) {
      const kws = c.keywordList ?? [];
      for (let i = 0; i < kws.length; i++) for (let j = i + 1; j < kws.length; j++) {
        const [a, b] = kws[i] < kws[j] ? [kws[i], kws[j]] : [kws[j], kws[i]];
        if (!coOcc[a]) coOcc[a] = {};
        coOcc[a][b] = (coOcc[a][b] ?? 0) + 1;
      }
    }

    // Top 70 labels by frequency
    const topLabels = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 70).map(([l]) => l);
    const labelSet = new Set(topLabels);

    const { w, h } = dims;
    const clNames = Object.keys(CLUSTERS);
    const clPos: Record<string, { x: number; y: number }> = {};
    clNames.forEach((name, i) => {
      const angle = (i / clNames.length) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(w, h) * 0.28;
      clPos[name] = { x: w/2 + Math.cos(angle) * radius, y: h/2 + Math.sin(angle) * radius };
    });
    clPos["Cross-cutting"] = { x: w/2, y: h/2 };

    const prevMap = new Map(nodesRef.current.map(n => [n.id, n]));

    const newNodes: Node[] = topLabels.map(label => {
      const cluster = getCluster(label);
      const cp = clPos[cluster] ?? { x: w/2, y: h/2 };
      const prev = prevMap.get(label);
      if (prev) return { ...prev, count: freq.get(label)! };
      return { id: label, cluster, count: freq.get(label)!, x: cp.x + (Math.random()-0.5)*80, y: cp.y + (Math.random()-0.5)*80, vx: 0, vy: 0 };
    });

    const nodeById = new Map(newNodes.map(n => [n.id, n]));
    const newLinks: Link[] = [];
    const used = new Set<string>();
    for (const a of topLabels) for (const b of topLabels) {
      if (a >= b) continue;
      const key = `${a}|||${b}`; if (used.has(key)) continue; used.add(key);
      if (!labelSet.has(a) || !labelSet.has(b)) continue;
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const w2 = coOcc[lo]?.[hi] ?? 0;
      if (w2 > 1) { const src = nodeById.get(a), tgt = nodeById.get(b); if (src && tgt) newLinks.push({ source: src, target: tgt, weight: w2 }); }
    }

    simRef.current?.stop();
    nodesRef.current = newNodes;
    linksRef.current = newLinks;
    simRef.current = buildSim(newNodes, newLinks, w, h);
    return () => simRef.current?.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, dims.w, dims.h]);

  // Draw loop
  function actualDraw() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { x: tx, y: ty, scale } = transformRef.current;
    const nodes = nodesRef.current, links = linksRef.current;
    const hov = hovRef.current;
    const { w, h } = dims;

    ctx.clearRect(0, 0, w * (window.devicePixelRatio||1), h * (window.devicePixelRatio||1));
    ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, w * (window.devicePixelRatio||1), h * (window.devicePixelRatio||1));
    if (!nodes.length) return;

    ctx.save(); ctx.translate(tx, ty); ctx.scale(scale, scale);

    // Cluster blobs
    const clMap = new Map<string, Node[]>();
    for (const nd of nodes) { const a = clMap.get(nd.cluster) ?? []; a.push(nd); clMap.set(nd.cluster, a); }
    for (const [cl, members] of clMap) {
      if (!members.length) continue;
      const color = CLUSTERS[cl]?.color ?? "#94a3b8";
      const cx = members.reduce((s, n) => s + n.x, 0) / members.length;
      const cy = members.reduce((s, n) => s + n.y, 0) / members.length;
      let maxR = 40;
      for (const n of members) { const d = Math.sqrt((n.x-cx)**2 + (n.y-cy)**2) + nodeR(n) + 28; if (d > maxR) maxR = d; }
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      grad.addColorStop(0, hex2rgba(color, 0.10));
      grad.addColorStop(0.65, hex2rgba(color, 0.05));
      grad.addColorStop(1, hex2rgba(color, 0));
      ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI*2); ctx.fillStyle = grad; ctx.fill();
      const minY = members.reduce((m, n) => Math.min(m, n.y - nodeR(n)), Infinity);
      ctx.font = `600 ${11/scale}px -apple-system,sans-serif`;
      ctx.fillStyle = hex2rgba(color, 0.55); ctx.textAlign = "center";
      ctx.fillText(cl, cx, minY - 12/scale);
    }

    // Edges
    for (const l of links) {
      const a = l.source, b = l.target;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      const opacity = Math.min(0.25, 0.04 * Math.log(l.weight + 1));
      ctx.strokeStyle = `rgba(100,116,139,${opacity})`;
      ctx.lineWidth = Math.max(0.5, Math.log(l.weight + 1) * 0.22) / scale;
      ctx.setLineDash([]); ctx.stroke();
    }

    // Nodes + labels
    for (const node of nodes) {
      const r = nodeR(node);
      const color = getColor(node.id);
      const isHov = hov?.id === node.id;

      ctx.save();
      if (isHov) { ctx.shadowColor = color; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI*2);
      ctx.fillStyle = hex2rgba(color, isHov ? 0.3 : 0.18);
      ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = (isHov ? 2.5 : 1.5) / scale;
      ctx.setLineDash([]); ctx.stroke();
      ctx.shadowBlur = 0; ctx.restore();

      const sz = Math.max(9, Math.min(13, r * 0.85)) / scale;
      ctx.font = `${isHov ? "600" : "500"} ${sz}px -apple-system,sans-serif`;
      ctx.fillStyle = isHov ? "#1e293b" : "#374151";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(node.id, node.x, node.y + r + 3/scale);
    }

    ctx.restore();
  }

  useEffect(() => { drawRef.current = actualDraw; });
  useEffect(() => {
    let raf = 0;
    const loop = () => { drawRef.current(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Mouse interactions
  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement; if (!canvas) return;
    function toW(cx: number, cy: number) { const t = transformRef.current; return { x: (cx - t.x) / t.scale, y: (cy - t.y) / t.scale }; }
    function hit(wx: number, wy: number): Node | null { for (const n of nodesRef.current) { const r = nodeR(n); if ((n.x-wx)**2 + (n.y-wy)**2 <= r*r) return n; } return null; }

    let drag: Node | null = null, pan = false, downX = 0, downY = 0, moved = false;

    function onMove(e: MouseEvent) {
      const rect = (canvas as HTMLCanvasElement).getBoundingClientRect();
      const { x: wx, y: wy } = toW(e.clientX - rect.left, e.clientY - rect.top);
      if (drag) { drag.fx = wx; drag.fy = wy; simRef.current?.reheat(); moved = true; return; }
      if (pan) { transformRef.current.x += e.movementX; transformRef.current.y += e.movementY; moved = true; return; }
      const h = hit(wx, wy); hovRef.current = h; setHovNode(h);
      (canvas as HTMLCanvasElement).style.cursor = h ? "pointer" : "grab";
    }

    function onDown(e: MouseEvent) {
      const rect = (canvas as HTMLCanvasElement).getBoundingClientRect();
      const { x: wx, y: wy } = toW(e.clientX - rect.left, e.clientY - rect.top);
      downX = e.clientX; downY = e.clientY; moved = false;
      drag = hit(wx, wy);
      if (!drag) pan = true;
      (canvas as HTMLCanvasElement).style.cursor = drag ? "grabbing" : "grabbing";
    }

    function onUp(e: MouseEvent) {
      const wasDrag = drag, didMove = moved;
      if (wasDrag) { wasDrag.fx = null; wasDrag.fy = null; }
      drag = null; pan = false;
      (canvas as HTMLCanvasElement).style.cursor = "grab";
      if (!didMove) {
        const rect = (canvas as HTMLCanvasElement).getBoundingClientRect();
        const { x: wx, y: wy } = toW(e.clientX - rect.left, e.clientY - rect.top);
        const node = hit(wx, wy);
        if (node) onSelectLabel(node.id);
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = (canvas as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const t = transformRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 0.9;
      const newScale = Math.max(0.3, Math.min(4, t.scale * factor));
      t.x = mx - (mx - t.x) * (newScale / t.scale);
      t.y = my - (my - t.y) * (newScale / t.scale);
      t.scale = newScale;
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [onSelectLabel]);

  return (
    <div ref={wrapRef} className="w-full bg-white rounded-2xl border border-gray-200 overflow-hidden relative">
      <canvas ref={canvasRef} style={{ display: "block", cursor: "grab" }} />
      {hovNode && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-md pointer-events-none">
          <p className="text-sm font-semibold text-gray-900">{hovNode.id}</p>
          <p className="text-xs text-gray-400">{hovNode.count} course{hovNode.count !== 1 ? "s" : ""} · {hovNode.cluster}</p>
          <p className="text-xs mt-0.5" style={{ color: getColor(hovNode.id) }}>Click to filter</p>
        </div>
      )}
      <p className="absolute top-3 right-3 text-xs text-gray-400 pointer-events-none">scroll to zoom · drag to pan</p>
    </div>
  );
}
