"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
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
interface GraphData { freq: Map<string,number>; coOcc: Record<string,Record<string,number>>; }

function nodeR(n: Node, focused: boolean) {
  if (focused) return Math.max(22, Math.sqrt(n.count) * 7 + 16);
  return Math.max(6, Math.sqrt(n.count) * 4 + 5);
}

function buildSim(nodes: Node[], links: Link[], w: number, h: number, focusedId?: string) {
  let alpha = 1, stopped = false, raf = 0;
  const k = Math.sqrt((w * h) / Math.max(nodes.length, 1)) * (focusedId ? 1.4 : 0.9);

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
      const ideal = k * (focusedId ? 0.5 : 0.6), f = (d - ideal) * 0.06 * alpha;
      l.source.vx += (dx/d)*f; l.source.vy += (dy/d)*f; l.target.vx -= (dx/d)*f; l.target.vy -= (dy/d)*f;
    }
    if (!focusedId) {
      const cents = centroids();
      for (const nd of nodes) { const c = cents.get(nd.cluster); if (c) { nd.vx += (c.x - nd.x) * 0.12 * alpha; nd.vy += (c.y - nd.y) * 0.12 * alpha; } }
    }
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

function buildFullGraph(data: GraphData, dims: { w: number; h: number }, prevNodes: Node[]): { nodes: Node[]; links: Link[] } {
  const { freq, coOcc } = data;
  const { w, h } = dims;
  const topLabels = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 70).map(([l]) => l);
  const labelSet = new Set(topLabels);
  const clNames = Object.keys(CLUSTERS);
  const clPos: Record<string, { x: number; y: number }> = {};
  clNames.forEach((name, i) => {
    const angle = (i / clNames.length) * Math.PI * 2 - Math.PI / 2;
    const radius = Math.min(w, h) * 0.28;
    clPos[name] = { x: w/2 + Math.cos(angle) * radius, y: h/2 + Math.sin(angle) * radius };
  });
  clPos["Cross-cutting"] = { x: w/2, y: h/2 };
  const prevMap = new Map(prevNodes.map(n => [n.id, n]));
  const nodes: Node[] = topLabels.map(label => {
    const cluster = getCluster(label);
    const cp = clPos[cluster] ?? { x: w/2, y: h/2 };
    const prev = prevMap.get(label);
    if (prev) return { ...prev, count: freq.get(label)! };
    return { id: label, cluster, count: freq.get(label)!, x: cp.x + (Math.random()-0.5)*80, y: cp.y + (Math.random()-0.5)*80, vx: 0, vy: 0 };
  });
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const links: Link[] = [];
  const used = new Set<string>();
  for (const a of topLabels) for (const b of topLabels) {
    if (a >= b) continue;
    const key = `${a}|||${b}`; if (used.has(key)) continue; used.add(key);
    if (!labelSet.has(a) || !labelSet.has(b)) continue;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const w2 = coOcc[lo]?.[hi] ?? 0;
    if (w2 > 1) { const src = nodeById.get(a), tgt = nodeById.get(b); if (src && tgt) links.push({ source: src, target: tgt, weight: w2 }); }
  }
  return { nodes, links };
}

function buildFocusedGraph(data: GraphData, focusedLabel: string, dims: { w: number; h: number }): { nodes: Node[]; links: Link[] } {
  const { freq, coOcc } = data;
  const { w, h } = dims;
  // Collect neighbors
  const neighborWeights = new Map<string, number>();
  for (const [lo, targets] of Object.entries(coOcc)) {
    for (const [hi, weight] of Object.entries(targets)) {
      const other = lo === focusedLabel ? hi : hi === focusedLabel ? lo : null;
      if (other && freq.has(other)) neighborWeights.set(other, (neighborWeights.get(other) ?? 0) + weight);
    }
  }
  const topNeighbors = Array.from(neighborWeights.entries()).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([l]) => l);
  const allLabels = [focusedLabel, ...topNeighbors];

  const centerNode: Node = { id: focusedLabel, cluster: getCluster(focusedLabel), count: freq.get(focusedLabel) ?? 0, x: w/2, y: h/2, vx: 0, vy: 0, fx: w/2, fy: h/2 };
  const neighborNodes: Node[] = topNeighbors.map((label, i) => {
    const angle = (i / topNeighbors.length) * Math.PI * 2 - Math.PI / 2;
    const radius = Math.min(w, h) * 0.32;
    return { id: label, cluster: getCluster(label), count: freq.get(label) ?? 0, x: w/2 + Math.cos(angle) * radius, y: h/2 + Math.sin(angle) * radius, vx: 0, vy: 0 };
  });

  const nodes = [centerNode, ...neighborNodes];
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const links: Link[] = [];
  const used = new Set<string>();
  for (let i = 0; i < allLabels.length; i++) for (let j = i+1; j < allLabels.length; j++) {
    const [lo, hi] = allLabels[i] < allLabels[j] ? [allLabels[i], allLabels[j]] : [allLabels[j], allLabels[i]];
    const key = `${lo}|||${hi}`; if (used.has(key)) continue; used.add(key);
    const w2 = coOcc[lo]?.[hi] ?? 0;
    if (w2 > 0) { const src = nodeById.get(allLabels[i]), tgt = nodeById.get(allLabels[j]); if (src && tgt) links.push({ source: src, target: tgt, weight: w2 }); }
  }
  return { nodes, links };
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
  const graphDataRef = useRef<GraphData | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 560 });
  const [hovNode, setHovNode] = useState<Node | null>(null);
  const [focusedLabel, setFocusedLabel] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      setDims({ w: width, h: Math.max(420, Math.min(640, width * 0.65)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr; canvas.height = dims.h * dpr;
    canvas.style.width = `${dims.w}px`; canvas.style.height = `${dims.h}px`;
    const ctx = canvas.getContext("2d"); if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr, dpr); }
  }, [dims]);

  // Build graphData when courses change
  useEffect(() => {
    const freq = new Map<string, number>();
    for (const c of courses) for (const kw of c.keywordList ?? []) freq.set(kw, (freq.get(kw) ?? 0) + 1);
    const coOcc: Record<string, Record<string, number>> = {};
    for (const c of courses) {
      const kws = c.keywordList ?? [];
      for (let i = 0; i < kws.length; i++) for (let j = i + 1; j < kws.length; j++) {
        const [a, b] = kws[i] < kws[j] ? [kws[i], kws[j]] : [kws[j], kws[i]];
        if (!coOcc[a]) coOcc[a] = {};
        coOcc[a][b] = (coOcc[a][b] ?? 0) + 1;
      }
    }
    graphDataRef.current = { freq, coOcc };
  }, [courses]);

  // Rebuild simulation when graphData, focusedLabel, or dims change
  useEffect(() => {
    const data = graphDataRef.current; if (!data) return;
    simRef.current?.stop();
    transformRef.current = { x: 0, y: 0, scale: 1 };

    let result: { nodes: Node[]; links: Link[] };
    if (focusedLabel) {
      result = buildFocusedGraph(data, focusedLabel, dims);
    } else {
      result = buildFullGraph(data, dims, nodesRef.current);
    }
    nodesRef.current = result.nodes;
    linksRef.current = result.links;
    simRef.current = buildSim(result.nodes, result.links, dims.w, dims.h, focusedLabel ?? undefined);
    return () => simRef.current?.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, focusedLabel, dims.w, dims.h]);

  function actualDraw() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { x: tx, y: ty, scale } = transformRef.current;
    const nodes = nodesRef.current, links = linksRef.current;
    const hov = hovRef.current;
    const { w, h } = dims;
    const dpr = window.devicePixelRatio || 1;
    const isFocused = !!focusedLabel;

    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, w * dpr, h * dpr);
    if (!nodes.length) return;

    ctx.save(); ctx.translate(tx, ty); ctx.scale(scale, scale);

    // Cluster blobs (full mode only)
    if (!isFocused) {
      const clMap = new Map<string, Node[]>();
      for (const nd of nodes) { const a = clMap.get(nd.cluster) ?? []; a.push(nd); clMap.set(nd.cluster, a); }
      for (const [cl, members] of clMap) {
        if (!members.length) continue;
        const color = CLUSTERS[cl]?.color ?? "#94a3b8";
        const cx = members.reduce((s, n) => s + n.x, 0) / members.length;
        const cy = members.reduce((s, n) => s + n.y, 0) / members.length;
        let maxR = 40;
        for (const n of members) { const d = Math.sqrt((n.x-cx)**2 + (n.y-cy)**2) + nodeR(n, false) + 28; if (d > maxR) maxR = d; }
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        grad.addColorStop(0, hex2rgba(color, 0.10));
        grad.addColorStop(0.65, hex2rgba(color, 0.05));
        grad.addColorStop(1, hex2rgba(color, 0));
        ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI*2); ctx.fillStyle = grad; ctx.fill();
        const minY = members.reduce((m, n) => Math.min(m, n.y - nodeR(n, false)), Infinity);
        ctx.font = `600 ${11/scale}px -apple-system,sans-serif`;
        ctx.fillStyle = hex2rgba(color, 0.55); ctx.textAlign = "center";
        ctx.fillText(cl, cx, minY - 14/scale);
      }
    }

    // Edges
    for (const l of links) {
      const a = l.source, b = l.target;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      const opacity = isFocused
        ? Math.min(0.5, 0.08 * Math.log(l.weight + 1))
        : Math.min(0.2, 0.035 * Math.log(l.weight + 1));
      ctx.strokeStyle = `rgba(100,116,139,${opacity})`;
      ctx.lineWidth = Math.max(0.5, Math.log(l.weight + 1) * 0.3) / scale;
      ctx.setLineDash([]); ctx.stroke();
    }

    // Nodes
    for (const node of nodes) {
      const isCenterNode = isFocused && node.id === focusedLabel;
      const r = nodeR(node, isCenterNode);
      const color = getColor(node.id);
      const isHov = hov?.id === node.id;

      ctx.save();
      if (isHov || isCenterNode) { ctx.shadowColor = color; ctx.shadowBlur = isCenterNode ? 24 : 16; }
      ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI*2);
      ctx.fillStyle = hex2rgba(color, isCenterNode ? 0.9 : isHov ? 0.35 : 0.22);
      ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();

      // Label: always in focused mode, only on hover in full mode
      const showLabel = isFocused || isHov || node.count >= 15;
      if (showLabel) {
        const sz = Math.max(9, Math.min(isCenterNode ? 15 : 12, r * 0.9)) / scale;
        ctx.font = `${isCenterNode || isHov ? "700" : "500"} ${sz}px -apple-system,sans-serif`;
        ctx.fillStyle = isCenterNode ? "#fff" : isHov ? "#1e293b" : "#374151";
        ctx.textAlign = "center";
        if (isCenterNode) {
          ctx.textBaseline = "middle";
          ctx.fillText(node.id, node.x, node.y);
        } else {
          ctx.textBaseline = "top";
          ctx.fillText(node.id, node.x, node.y + r + 3/scale);
        }
      }
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
  const onSelectLabelRef = useRef(onSelectLabel);
  useEffect(() => { onSelectLabelRef.current = onSelectLabel; }, [onSelectLabel]);
  const focusedLabelRef = useRef(focusedLabel);
  useEffect(() => { focusedLabelRef.current = focusedLabel; }, [focusedLabel]);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement; if (!canvas) return;
    function toW(cx: number, cy: number) { const t = transformRef.current; return { x: (cx - t.x) / t.scale, y: (cy - t.y) / t.scale }; }
    function hit(wx: number, wy: number): Node | null { for (const n of nodesRef.current) { const isCtr = focusedLabelRef.current === n.id; const r = nodeR(n, isCtr); if ((n.x-wx)**2 + (n.y-wy)**2 <= r*r) return n; } return null; }

    let drag: Node | null = null, pan = false, moved = false;

    function onMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const { x: wx, y: wy } = toW(e.clientX - rect.left, e.clientY - rect.top);
      if (drag) { drag.fx = wx; drag.fy = wy; simRef.current?.reheat(); moved = true; return; }
      if (pan) { transformRef.current.x += e.movementX; transformRef.current.y += e.movementY; moved = true; return; }
      const h = hit(wx, wy); hovRef.current = h; setHovNode(h);
      canvas.style.cursor = h ? "pointer" : "grab";
    }

    function onDown(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const { x: wx, y: wy } = toW(e.clientX - rect.left, e.clientY - rect.top);
      moved = false;
      drag = hit(wx, wy);
      if (!drag) pan = true;
      canvas.style.cursor = "grabbing";
    }

    function onUp(e: MouseEvent) {
      const wasDrag = drag, didMove = moved;
      if (wasDrag && wasDrag.id !== focusedLabelRef.current) { wasDrag.fx = null; wasDrag.fy = null; }
      drag = null; pan = false;
      canvas.style.cursor = "grab";
      if (!didMove) {
        const rect = canvas.getBoundingClientRect();
        const { x: wx, y: wy } = toW(e.clientX - rect.left, e.clientY - rect.top);
        const node = hit(wx, wy);
        if (node) {
          if (focusedLabelRef.current) {
            // In focused mode: click center node → filter; click neighbor → refocus
            if (node.id === focusedLabelRef.current) {
              onSelectLabelRef.current(node.id);
            } else {
              setFocusedLabel(node.id);
            }
          } else {
            // In full mode: click → enter focused sub-graph
            setFocusedLabel(node.id);
          }
        }
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
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
  }, []);

  const focusedCount = focusedLabel ? (graphDataRef.current?.freq.get(focusedLabel) ?? 0) : 0;

  return (
    <div ref={wrapRef} className="w-full bg-white rounded-2xl border border-gray-200 overflow-hidden relative">
      <canvas ref={canvasRef} style={{ display: "block", cursor: "grab" }} />

      {/* Focused mode overlay */}
      {focusedLabel && (
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-3 pointer-events-none">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl text-sm text-gray-600 shadow-sm hover:bg-white transition-colors pointer-events-auto"
            onClick={() => setFocusedLabel(null)}>
            <ArrowLeft className="w-3.5 h-3.5" /> All topics
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm border rounded-xl shadow-sm pointer-events-auto"
            style={{ borderColor: `${getColor(focusedLabel)}40` }}>
            <span className="text-sm font-semibold" style={{ color: getColor(focusedLabel) }}>{focusedLabel}</span>
            <span className="text-xs text-gray-400">{focusedCount} courses</span>
            <button
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg text-white transition-colors"
              style={{ background: getColor(focusedLabel) }}
              onClick={() => { onSelectLabel(focusedLabel); }}>
              <BookOpen className="w-3 h-3" /> View courses
            </button>
          </div>
        </div>
      )}

      {/* Hover tooltip (full mode only) */}
      {!focusedLabel && hovNode && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-md pointer-events-none">
          <p className="text-sm font-semibold text-gray-900">{hovNode.id}</p>
          <p className="text-xs text-gray-400">{hovNode.count} course{hovNode.count !== 1 ? "s" : ""} · {hovNode.cluster}</p>
          <p className="text-xs mt-0.5" style={{ color: getColor(hovNode.id) }}>Click to explore</p>
        </div>
      )}

      {/* Focused mode: click center hint */}
      {focusedLabel && (
        <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-gray-400 pointer-events-none">
          Click center node to filter courses · click neighbors to explore
        </p>
      )}

      {!focusedLabel && (
        <p className="absolute top-3 right-3 text-xs text-gray-400 pointer-events-none">scroll to zoom · drag to pan</p>
      )}
    </div>
  );
}
