"use client";

import { useEffect, useRef, useState } from "react";
import { useSaved } from "@/lib/useSaved";
import { useTaken } from "@/lib/useTaken";
import { SCHOOL_COLORS } from "@/lib/types";
import {
  Search, Plus, X, BookOpen, CheckCircle, Bookmark,
  Sparkles, Key, RefreshCw, ChevronDown, ExternalLink,
} from "lucide-react";
import type { GraphPageData, CourseSlim } from "@/app/graph/page";

// ─── Clusters ────────────────────────────────────────────────────────────────
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

const SEMESTERS = ["Fall","Spring","Summer","Winter","Fall-Spring","Fall-Winter","Winter-Spring"];

function getCluster(l: string) { for (const [n,{labels}] of Object.entries(CLUSTERS)) if (labels.includes(l)) return n; return "Other"; }
function getClusterColor(cl: string) { return CLUSTERS[cl]?.color ?? "#94a3b8"; }
function hex2rgba(hex: string, a: number) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Node / Link ──────────────────────────────────────────────────────────────
type NodeKind = "taken"|"saved"|"both"|"manual";
interface SimNode { id:string; cluster:string; kind:NodeKind; takenCount:number; savedCount:number; schools:Record<string,number>; topSchool:string; x:number; y:number; vx:number; vy:number; fx?:number|null; fy?:number|null; }
interface SimLink { source:SimNode; target:SimNode; weight:number }
interface MatchCourse extends CourseSlim { matchCount:number }

function nodeR(n: SimNode) { return Math.max(7, Math.sqrt(Math.max(n.takenCount,n.savedCount,1))*6+7); }

function drawNode(ctx: CanvasRenderingContext2D, n: SimNode, hovered: boolean, selected: boolean, dimmed: boolean, scale: number) {
  const r = nodeR(n);
  const clCol = getClusterColor(n.cluster);
  const schHex = SCHOOL_COLORS[n.topSchool]?.hex ?? clCol;

  if (dimmed) ctx.globalAlpha = 0.25;

  // Selection ring (drawn first, behind node)
  if (selected) {
    ctx.beginPath(); ctx.arc(n.x, n.y, r+5/scale, 0, Math.PI*2);
    ctx.strokeStyle = clCol; ctx.lineWidth = 2.5/scale;
    ctx.shadowColor = clCol; ctx.shadowBlur = 14;
    ctx.setLineDash([]); ctx.stroke(); ctx.shadowBlur = 0;
  }

  ctx.save();
  if (hovered && !dimmed) { ctx.shadowColor = clCol; ctx.shadowBlur = 16; }

  if (n.kind === "taken") {
    ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.fillStyle="#e2e8f0"; ctx.fill();
    ctx.strokeStyle="#64748b"; ctx.lineWidth=2/scale; ctx.setLineDash([]); ctx.stroke();
    ctx.beginPath(); ctx.arc(n.x,n.y,r*0.3,0,Math.PI*2); ctx.fillStyle="#64748b"; ctx.fill();
  } else if (n.kind === "saved") {
    ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.fillStyle=hex2rgba(schHex,0.15); ctx.fill();
    ctx.strokeStyle=schHex; ctx.lineWidth=2/scale; ctx.setLineDash([4/scale,3/scale]); ctx.stroke(); ctx.setLineDash([]);
  } else if (n.kind === "both") {
    ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.fillStyle=hex2rgba(schHex,0.28); ctx.fill();
    ctx.strokeStyle=schHex; ctx.lineWidth=2.5/scale; ctx.setLineDash([]); ctx.stroke();
    ctx.beginPath(); ctx.arc(n.x,n.y,r*0.52,0,Math.PI*2); ctx.strokeStyle="#475569"; ctx.lineWidth=1.5/scale; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.fillStyle=hex2rgba("#8b5cf6",0.12); ctx.fill();
    ctx.strokeStyle="#8b5cf6"; ctx.lineWidth=1.5/scale; ctx.setLineDash([2/scale,3/scale]); ctx.stroke(); ctx.setLineDash([]);
  }

  ctx.shadowBlur=0; ctx.restore();
  ctx.globalAlpha=1;
}

// ─── Simulation ───────────────────────────────────────────────────────────────
function buildSim(nodes: SimNode[], links: SimLink[], w: number, h: number) {
  let alpha=1, stopped=false, raf=0;
  const k=Math.sqrt((w*h)/Math.max(nodes.length,1))*0.9;
  function centroids() {
    const m=new Map<string,{sx:number;sy:number;n:number}>();
    for (const nd of nodes){const e=m.get(nd.cluster)??{sx:0,sy:0,n:0};e.sx+=nd.x;e.sy+=nd.y;e.n++;m.set(nd.cluster,e);}
    const out=new Map<string,{x:number;y:number}>();
    for (const [cl,{sx,sy,n}] of m) out.set(cl,{x:sx/n,y:sy/n});
    return out;
  }
  function tick() {
    if (stopped) return;
    for (let i=0;i<nodes.length;i++) for (let j=i+1;j<nodes.length;j++) {
      const a=nodes[i],b=nodes[j];
      const dx=(b.x-a.x)||0.01,dy=(b.y-a.y)||0.01,d=Math.sqrt(dx*dx+dy*dy)||0.01;
      const kf=a.cluster===b.cluster?k*0.55:k*1.4,f=(kf*kf)/d*alpha;
      a.vx-=(dx/d)*f;a.vy-=(dy/d)*f;b.vx+=(dx/d)*f;b.vy+=(dy/d)*f;
    }
    for (const l of links) {
      const dx=l.target.x-l.source.x,dy=l.target.y-l.source.y,d=Math.sqrt(dx*dx+dy*dy)||0.01,ideal=k*0.6,f=(d-ideal)*0.06*alpha;
      l.source.vx+=(dx/d)*f;l.source.vy+=(dy/d)*f;l.target.vx-=(dx/d)*f;l.target.vy-=(dy/d)*f;
    }
    const cents=centroids();
    for (const nd of nodes){const c=cents.get(nd.cluster);if(c){nd.vx+=(c.x-nd.x)*0.12*alpha;nd.vy+=(c.y-nd.y)*0.12*alpha;}}
    for (const nd of nodes){nd.vx+=(w/2-nd.x)*0.006*alpha;nd.vy+=(h/2-nd.y)*0.006*alpha;}
    for (const nd of nodes){
      if(nd.fx!=null){nd.x=nd.fx;nd.vx=0;}else{nd.vx*=0.45;nd.x+=nd.vx;}
      if(nd.fy!=null){nd.y=nd.fy;nd.vy=0;}else{nd.vy*=0.45;nd.y+=nd.vy;}
    }
    alpha*=0.975;
    if(alpha>0.004) raf=requestAnimationFrame(tick); else stopped=true;
  }
  raf=requestAnimationFrame(tick);
  return { stop:()=>{stopped=true;cancelAnimationFrame(raf);}, reheat:()=>{if(stopped){stopped=false;alpha=0.35;raf=requestAnimationFrame(tick);}} };
}

// ─── Right panel: course match card ──────────────────────────────────────────
function MatchCard({ course, selectedLabels, isSaved, isTaken, onSave, onTaken }: {
  course: MatchCourse; selectedLabels: Set<string>;
  isSaved: boolean; isTaken: boolean; onSave: ()=>void; onTaken: ()=>void;
}) {
  const col = SCHOOL_COLORS[course.school];
  const pct = Math.round((course.matchCount / selectedLabels.size) * 100);
  return (
    <div className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border ${col?.bg} ${col?.text} ${col?.border}`}>
          {course.school}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {/* Match strength pill */}
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${pct===100?"bg-green-100 text-green-700":pct>=60?"bg-blue-100 text-blue-700":"bg-gray-100 text-gray-500"}`}>
            {course.matchCount}/{selectedLabels.size}
          </span>
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-900 leading-snug mb-1.5 line-clamp-2">{course.name}</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {course.keywordList.slice(0,5).map(kw=>(
          <span key={kw} className={`px-1.5 py-0.5 text-xs rounded ${selectedLabels.has(kw)?"bg-blue-100 text-blue-700 font-medium":"bg-gray-100 text-gray-500"}`}>{kw}</span>
        ))}
        {course.keywordList.length>5&&<span className="text-xs text-gray-400">+{course.keywordList.length-5}</span>}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {course.semester&&<span>{course.semester}</span>}
          {course.year&&<span>{course.year}</span>}
          {course.credits&&<span>· {course.credits} cr</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onTaken} title="Mark taken"
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isTaken?"bg-slate-200 text-slate-600":"bg-gray-100 text-gray-300 hover:text-slate-500"}`}>
            <CheckCircle className="w-3.5 h-3.5"/>
          </button>
          <button onClick={onSave} title="Save"
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isSaved?"bg-red-100 text-red-600":"bg-gray-100 text-gray-300 hover:text-red-500"}`}>
            <BookOpen className="w-3.5 h-3.5"/>
          </button>
          {course.url&&(
            <a href={course.url} target="_blank" rel="noopener noreferrer"
              className="w-6 h-6 rounded bg-gray-100 text-gray-300 hover:text-blue-500 flex items-center justify-center transition-colors">
              <ExternalLink className="w-3.5 h-3.5"/>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function KnowledgeGraph({ data }: { data: GraphPageData }) {
  const { courseSlim, allLabels, coOccurrence } = data;
  const { savedIds, toggle: toggleSave, isSaved } = useSaved();
  const { takenIds, toggle: toggleTaken, isTaken } = useTaken();

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef       = useRef<{stop:()=>void;reheat:()=>void}|null>(null);
  const nodesRef     = useRef<SimNode[]>([]);
  const linksRef     = useRef<SimLink[]>([]);
  const transformRef = useRef({x:0,y:0,scale:1});
  const prevIdsRef   = useRef<Set<string>>(new Set());
  const drawRef      = useRef<()=>void>(()=>{});
  const hovRef       = useRef<SimNode|null>(null);
  const selectedRef  = useRef<Set<string>>(new Set());

  const [dims,        setDims]        = useState({w:900,h:600});
  const [mounted,     setMounted]     = useState(false);
  const [manualLbls,  setManualLbls]  = useState<Set<string>>(new Set());
  const [query,       setQuery]       = useState("");
  const [courseQ,     setCourseQ]     = useState("");
  const [hovNode,     setHovNode]     = useState<SimNode|null>(null);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [semFilter,   setSemFilter]   = useState("");
  // AI summary
  const [apiKey,      setApiKey]      = useState("");
  const [summary,     setSummary]     = useState("");
  const [sumLoading,  setSumLoading]  = useState(false);
  const [sumError,    setSumError]    = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Keep selectedRef in sync for the draw loop
  useEffect(()=>{ selectedRef.current = selectedLabels; }, [selectedLabels]);

  useEffect(()=>{ setMounted(true); },[]);
  useEffect(()=>{ try{const k=sessionStorage.getItem("hv-api-key");if(k)setApiKey(k);}catch{} },[]);
  useEffect(()=>{
    const el=containerRef.current; if(!el) return;
    const obs=new ResizeObserver(()=>setDims({w:el.clientWidth,h:el.clientHeight}));
    obs.observe(el); setDims({w:el.clientWidth,h:el.clientHeight});
    return()=>obs.disconnect();
  },[]);

  // ── Label info ──
  const takenCourses = mounted ? courseSlim.filter(c=>takenIds.has(c.id)) : [];
  const savedCourses = mounted ? courseSlim.filter(c=>savedIds.has(c.id)) : [];
  const labelInfo = new Map<string,{takenCount:number;savedCount:number;schools:Record<string,number>}>();
  for (const c of takenCourses) for (const kw of c.keywordList){const e=labelInfo.get(kw)??{takenCount:0,savedCount:0,schools:{}};e.takenCount++;e.schools[c.school]=(e.schools[c.school]??0)+1;labelInfo.set(kw,e);}
  for (const c of savedCourses) for (const kw of c.keywordList){const e=labelInfo.get(kw)??{takenCount:0,savedCount:0,schools:{}};e.savedCount++;e.schools[c.school]=(e.schools[c.school]??0)+1;labelInfo.set(kw,e);}
  for (const ml of manualLbls) if(!labelInfo.has(ml)) labelInfo.set(ml,{takenCount:0,savedCount:0,schools:{}});
  const activeLabels=Array.from(labelInfo.keys());
  function nodeKind(l:string):NodeKind{const i=labelInfo.get(l);if(!i)return"manual";if(i.takenCount>0&&i.savedCount>0)return"both";if(i.takenCount>0)return"taken";if(i.savedCount>0)return"saved";return"manual";}

  // ── Course matching (right panel) ──
  const matchingCourses: MatchCourse[] = selectedLabels.size === 0 ? [] :
    courseSlim
      .filter(c=>{
        if (semFilter && c.semester !== semFilter) return false;
        return c.keywordList.some(kw=>selectedLabels.has(kw));
      })
      .map(c=>({...c, matchCount: c.keywordList.filter(kw=>selectedLabels.has(kw)).length}))
      .sort((a,b)=>b.matchCount-a.matchCount)
      .slice(0,50);

  // ── Draw ──
  function actualDraw() {
    const canvas=canvasRef.current as HTMLCanvasElement; if(!canvas) return;
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    const {x:tx,y:ty,scale}=transformRef.current;
    const nodes=nodesRef.current, links=linksRef.current;
    const hov=hovRef.current, sel=selectedRef.current;
    const hasSelection=sel.size>0;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#f8fafc"; ctx.fillRect(0,0,canvas.width,canvas.height);
    if(!nodes.length) return;

    ctx.save(); ctx.translate(tx,ty); ctx.scale(scale,scale);

    // Cluster blobs
    const clMap=new Map<string,SimNode[]>();
    for(const nd of nodes){const a=clMap.get(nd.cluster)??[];a.push(nd);clMap.set(nd.cluster,a);}
    for(const [cl,members] of clMap){
      if(!members.length) continue;
      const color=getClusterColor(cl);
      const cx=members.reduce((s,n)=>s+n.x,0)/members.length;
      const cy=members.reduce((s,n)=>s+n.y,0)/members.length;
      let maxR=40;
      for(const n of members){const d=Math.sqrt((n.x-cx)**2+(n.y-cy)**2)+nodeR(n)+28;if(d>maxR)maxR=d;}
      const grad=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR);
      grad.addColorStop(0,hex2rgba(color,hasSelection?0.04:0.1));
      grad.addColorStop(0.65,hex2rgba(color,hasSelection?0.02:0.05));
      grad.addColorStop(1,hex2rgba(color,0));
      ctx.beginPath();ctx.arc(cx,cy,maxR,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();
      const minY=members.reduce((m,n)=>Math.min(m,n.y-nodeR(n)),Infinity);
      ctx.font=`600 ${11/scale}px -apple-system,sans-serif`;
      ctx.fillStyle=hex2rgba(color,hasSelection?0.3:0.55);ctx.textAlign="center";
      ctx.fillText(cl,cx,minY-12/scale);
    }

    // Edges
    for(const l of links){
      const a=l.source,b=l.target;
      const bothSel=sel.has(a.id)&&sel.has(b.id);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      const base=Math.min(0.3,0.04*Math.log(l.weight+1));
      ctx.strokeStyle=`rgba(100,116,139,${hasSelection?(bothSel?base*2:base*0.2):base})`;
      ctx.lineWidth=Math.max(0.5,Math.log(l.weight+1)*0.22)/scale;
      ctx.setLineDash([]); ctx.stroke();
    }

    // Nodes
    for(const node of nodes){
      const selected=sel.has(node.id);
      const dimmed=hasSelection&&!selected;
      drawNode(ctx,node,hov?.id===node.id,selected,dimmed,scale);
    }

    // Labels
    for(const node of nodes){
      const selected=sel.has(node.id), dimmed=hasSelection&&!selected;
      if(dimmed) ctx.globalAlpha=0.3;
      const r=nodeR(node),isHov=hov?.id===node.id;
      const sz=Math.max(9,Math.min(12,r*0.85))/scale;
      ctx.font=`${selected||isHov?"600":"500"} ${sz}px -apple-system,sans-serif`;
      ctx.fillStyle=selected?"#1e293b":isHov?"#1e293b":"#374151";
      ctx.textAlign="center"; ctx.textBaseline="top";
      ctx.fillText(node.id,node.x,node.y+r+4/scale);
      ctx.globalAlpha=1;
    }

    ctx.restore();
  }

  useEffect(()=>{ drawRef.current=actualDraw; });
  useEffect(()=>{
    let raf=0;
    const loop=()=>{ drawRef.current(); raf=requestAnimationFrame(loop); };
    raf=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf);
  },[]);

  // ── Rebuild simulation ──
  useEffect(()=>{
    simRef.current?.stop();
    if(!activeLabels.length){nodesRef.current=[];linksRef.current=[];return;}
    const {w,h}=dims;
    const clNames=Object.keys(CLUSTERS);
    const clPos:Record<string,{x:number;y:number}>={};
    clNames.forEach((name,i)=>{const angle=(i/clNames.length)*Math.PI*2-Math.PI/2,radius=Math.min(w,h)*0.28;clPos[name]={x:w/2+Math.cos(angle)*radius,y:h/2+Math.sin(angle)*radius};});
    clPos["Other"]={x:w/2,y:h/2};
    const prevIds=prevIdsRef.current;
    const newNodes:SimNode[]=activeLabels.map(label=>{
      const info=labelInfo.get(label)!;
      const topSchool=Object.entries(info.schools).sort((a,b)=>b[1]-a[1])[0]?.[0]??"";
      const cluster=getCluster(label); const cp=clPos[cluster]??{x:w/2,y:h/2};
      if(prevIds.has(label)){const ex=nodesRef.current.find(n=>n.id===label);if(ex)return{...ex,kind:nodeKind(label),takenCount:info.takenCount,savedCount:info.savedCount,schools:info.schools,topSchool};}
      return{id:label,cluster,kind:nodeKind(label),takenCount:info.takenCount,savedCount:info.savedCount,schools:info.schools,topSchool,x:cp.x+(Math.random()-0.5)*60,y:cp.y+(Math.random()-0.5)*60,vx:0,vy:0};
    });
    const nodeById=new Map(newNodes.map(n=>[n.id,n]));
    const used=new Set<string>(); const newLinks:SimLink[]=[];
    for(let i=0;i<activeLabels.length;i++) for(let j=i+1;j<activeLabels.length;j++){
      const [a,b]=activeLabels[i]<activeLabels[j]?[activeLabels[i],activeLabels[j]]:[activeLabels[j],activeLabels[i]];
      const key=`${a}|||${b}`;if(used.has(key))continue;used.add(key);
      const w2=coOccurrence[a]?.[b]??0;
      if(w2>0){const src=nodeById.get(activeLabels[i])!,tgt=nodeById.get(activeLabels[j])!;if(src&&tgt)newLinks.push({source:src,target:tgt,weight:w2});}
    }
    nodesRef.current=newNodes; linksRef.current=newLinks;
    prevIdsRef.current=new Set(newNodes.map(n=>n.id));
    simRef.current=buildSim(newNodes,newLinks,w,h);
    return()=>simRef.current?.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeLabels.join(","),dims.w,dims.h]);

  // ── Mouse interactions ──
  useEffect(()=>{
    const canvas=canvasRef.current as HTMLCanvasElement; if(!canvas) return;
    function toW(cx:number,cy:number){const t=transformRef.current;return{x:(cx-t.x)/t.scale,y:(cy-t.y)/t.scale};}
    function hit(wx:number,wy:number):SimNode|null{for(const n of nodesRef.current){const r=nodeR(n);if((n.x-wx)**2+(n.y-wy)**2<=r*r)return n;}return null;}
    let drag:SimNode|null=null, pan=false, downX=0, downY=0, downOnNode=false;
    function onMove(e:MouseEvent){
      const rect=canvas.getBoundingClientRect();
      const{x:wx,y:wy}=toW(e.clientX-rect.left,e.clientY-rect.top);
      if(drag){drag.fx=wx;drag.fy=wy;simRef.current?.reheat();return;}
      if(pan){transformRef.current.x+=e.movementX;transformRef.current.y+=e.movementY;return;}
      const h=hit(wx,wy); hovRef.current=h; setHovNode(h);
      canvas.style.cursor=h?"pointer":"grab";
    }
    function onDown(e:MouseEvent){
      const rect=canvas.getBoundingClientRect();
      const{x:wx,y:wy}=toW(e.clientX-rect.left,e.clientY-rect.top);
      downX=e.clientX; downY=e.clientY;
      const h=hit(wx,wy);
      downOnNode=!!h;
      if(h){drag=h;canvas.style.cursor="grabbing";}else pan=true;
    }
    function onUp(e:MouseEvent){
      const moved=Math.hypot(e.clientX-downX,e.clientY-downY);
      if(moved<5){
        if(downOnNode&&drag){
          // Click on node → toggle selection
          const id=drag.id;
          setSelectedLabels(prev=>{
            const next=new Set(prev);
            next.has(id)?next.delete(id):next.add(id);
            selectedRef.current=next;
            return next;
          });
        } else if(!downOnNode){
          // Click on empty → clear selection
          setSelectedLabels(new Set());
          selectedRef.current=new Set();
        }
      }
      if(drag){drag.fx=null;drag.fy=null;drag=null;}
      pan=false; canvas.style.cursor="grab";
    }
    function onWheel(e:WheelEvent){
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left,my=e.clientY-rect.top,f=e.deltaY<0?1.12:0.9;
      const t=transformRef.current;
      t.x=mx-f*(mx-t.x);t.y=my-f*(my-t.y);t.scale=Math.max(0.15,Math.min(6,t.scale*f));
    }
    canvas.addEventListener("mousemove",onMove);
    canvas.addEventListener("mousedown",onDown);
    canvas.addEventListener("mouseup",onUp);
    canvas.addEventListener("wheel",onWheel,{passive:false});
    return()=>{canvas.removeEventListener("mousemove",onMove);canvas.removeEventListener("mousedown",onDown);canvas.removeEventListener("mouseup",onUp);canvas.removeEventListener("wheel",onWheel);};
  },[]);

  // ── AI summary ──
  const generateSummary = async () => {
    if(!apiKey) return;
    setSumLoading(true); setSummary(""); setSumError("");
    try {
      sessionStorage.setItem("hv-api-key",apiKey);
      const clusterBreakdown:Record<string,{taken:string[];saved:string[]}>=Object.fromEntries(Object.keys(CLUSTERS).map(cl=>[cl,{taken:[],saved:[]}]));
      for(const [label,info] of labelInfo){const cl=getCluster(label);if(!clusterBreakdown[cl])clusterBreakdown[cl]={taken:[],saved:[]};if(info.takenCount>0)clusterBreakdown[cl].taken.push(label);if(info.savedCount>0)clusterBreakdown[cl].saved.push(label);}
      const res=await fetch("/api/knowledge-summary",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({takenCourses:takenCourses.map(c=>({name:c.name,school:c.school,labels:c.keywordList})),savedCourses:savedCourses.map(c=>({name:c.name,school:c.school,labels:c.keywordList})),clusterBreakdown,apiKey})});
      if(!res.ok)throw new Error(await res.text());
      const reader=res.body?.getReader(),dec=new TextDecoder();
      if(!reader)throw new Error("No stream");
      while(true){const{done,value}=await reader.read();if(done)break;setSummary(p=>p+dec.decode(value));}
    } catch(e){setSumError(e instanceof Error?e.message:"Error");}
    setSumLoading(false);
  };

  const labelSuggestions=query.length>=1?allLabels.filter(l=>l.toLowerCase().includes(query.toLowerCase())&&!labelInfo.has(l)).slice(0,6):[];
  const courseSuggestions=courseQ.length>=2?courseSlim.filter(c=>c.name.toLowerCase().includes(courseQ.toLowerCase())&&!takenIds.has(c.id)).slice(0,6):[];
  const takenCount=activeLabels.filter(l=>labelInfo.get(l)!.takenCount>0).length;
  const savedCount=activeLabels.filter(l=>labelInfo.get(l)!.savedCount>0&&labelInfo.get(l)!.takenCount===0).length;

  return (
    <div className="flex h-[calc(100vh-56px)] bg-white">

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-72 border-r border-gray-200 flex flex-col shrink-0 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Knowledge Graph</h2>
          <p className="text-xs text-gray-400 mt-0.5">Click nodes to select · find matching courses →</p>
        </div>

        {/* Legend */}
        <div className="px-4 py-2.5 border-b border-gray-100 grid grid-cols-2 gap-1.5">
          {[{sym:"●",cls:"text-slate-400",lbl:"Taken"},{sym:"○",cls:"text-blue-500",lbl:"Will take"},{sym:"◉",cls:"text-blue-600",lbl:"Both"},{sym:"○",cls:"text-purple-400",lbl:"Manual"}].map(({sym,cls,lbl})=>(
            <div key={lbl} className="flex items-center gap-1.5"><span className={`text-sm leading-none ${cls}`}>{sym}</span><span className="text-xs text-gray-500">{lbl}</span></div>
          ))}
        </div>

        {/* Stats */}
        {mounted&&(
          <div className="px-4 py-2.5 border-b border-gray-100 grid grid-cols-3 gap-1.5">
            {[{v:takenCourses.length,l:"Taken"},{v:savedCourses.length,l:"Saved"},{v:activeLabels.length,l:"Labels"}].map(({v,l})=>(
              <div key={l} className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-sm font-bold text-gray-900">{v}</div><div className="text-xs text-gray-400">{l}</div></div>
            ))}
          </div>
        )}

        {/* Hovered node */}
        {hovNode&&(
          <div className="px-4 py-2.5 border-b border-gray-100 bg-slate-50">
            <p className="text-xs font-semibold text-gray-900">{hovNode.id}</p>
            <p className="text-xs text-gray-400">{hovNode.cluster}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Mark course as taken */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mark as taken</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"/>
              <input type="text" placeholder="Search courses..." value={courseQ} onChange={e=>setCourseQ(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200"/>
            </div>
            {courseSuggestions.length>0&&(
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white z-10 relative">
                {courseSuggestions.map(c=>{const col=SCHOOL_COLORS[c.school];return(
                  <button key={c.id} onClick={()=>{toggleTaken(c.id);setCourseQ("");}}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 border-b border-gray-100 last:border-0 flex items-start gap-1.5">
                    <span className={`font-semibold shrink-0 ${col?.text??"text-gray-600"}`}>{c.school}</span>
                    <span className="text-gray-700 line-clamp-1">{c.name}</span>
                  </button>);})}
              </div>
            )}
            {takenCourses.length>0&&(
              <div className="mt-2 space-y-1">
                {takenCourses.map(c=>{const col=SCHOOL_COLORS[c.school];return(
                  <div key={c.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <CheckCircle className="w-3 h-3 text-slate-400 shrink-0"/>
                    <div className="flex-1 min-w-0"><span className={`text-xs font-semibold ${col?.text??"text-gray-600"}`}>{c.school} </span><span className="text-xs text-gray-600 truncate">{c.name}</span></div>
                    <button onClick={()=>toggleTaken(c.id)} className="text-gray-300 hover:text-red-400 shrink-0"><X className="w-3 h-3"/></button>
                  </div>);})}
              </div>
            )}
          </div>

          {/* Add label manually */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add topic</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"/>
              <input type="text" placeholder="e.g. artificial intelligence" value={query} onChange={e=>setQuery(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&labelSuggestions[0]){setManualLbls(p=>new Set([...p,labelSuggestions[0]]));setQuery("");}}}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"/>
            </div>
            {labelSuggestions.length>0&&(
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
                {labelSuggestions.map(s=>(
                  <button key={s} onClick={()=>{setManualLbls(p=>new Set([...p,s]));setQuery("");}}
                    className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-purple-50 flex items-center gap-1.5 border-b border-gray-100 last:border-0">
                    <Plus className="w-3 h-3 text-gray-400 shrink-0"/><span className="truncate">{s}</span>
                    <span className="ml-auto text-gray-300 text-xs shrink-0">{getCluster(s)}</span>
                  </button>
                ))}
              </div>
            )}
            {manualLbls.size>0&&(
              <div className="mt-2 flex flex-wrap gap-1">
                {Array.from(manualLbls).map(ml=>(
                  <span key={ml} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-200">
                    {ml}<button onClick={()=>setManualLbls(p=>{const n=new Set(p);n.delete(ml);return n;})}><X className="w-3 h-3"/></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Saved from Explore */}
          {savedCourses.length>0&&(
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-1.5 mb-2"><Bookmark className="w-3 h-3 text-blue-500"/><p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Saved</p></div>
              <div className="space-y-1">
                {savedCourses.map(c=>{const col=SCHOOL_COLORS[c.school];return(
                  <div key={c.id} className="bg-blue-50 rounded-lg px-2.5 py-1.5 text-xs">
                    <span className={`font-semibold ${col?.text??"text-gray-600"}`}>{c.school} </span><span className="text-gray-600 line-clamp-1">{c.name}</span>
                  </div>);})}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="px-4 py-3">
            <button onClick={()=>setSummaryOpen(v=>!v)}
              className="w-full flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 hover:bg-amber-100 transition-colors">
              <Sparkles className="w-3.5 h-3.5"/>AI Knowledge Summary<span className="ml-auto text-amber-400">{summaryOpen?"▲":"▼"}</span>
            </button>
            {summaryOpen&&(
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-gray-400 shrink-0"/>
                  <input type="password" placeholder="sk-ant-..." value={apiKey}
                    onChange={e=>{setApiKey(e.target.value);try{sessionStorage.setItem("hv-api-key",e.target.value);}catch{}}}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-200"/>
                </div>
                <button onClick={generateSummary} disabled={sumLoading||!apiKey||(takenCourses.length===0&&savedCourses.length===0)}
                  className="w-full flex items-center justify-center gap-1.5 bg-amber-600 text-white text-xs font-semibold py-1.5 rounded-lg disabled:opacity-40 hover:bg-amber-700 transition-colors">
                  {sumLoading?<><RefreshCw className="w-3 h-3 animate-spin"/>Generating...</>:<><Sparkles className="w-3 h-3"/>Generate</>}
                </button>
                {sumError&&<p className="text-xs text-red-500">{sumError}</p>}
                {summary&&(
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {summary}{sumLoading&&<span className="inline-block w-1 h-3 bg-amber-400 ml-0.5 animate-pulse rounded-sm"/>}
                  </div>
                )}
              </div>
            )}
          </div>

          {mounted&&takenCourses.length===0&&savedCourses.length===0&&manualLbls.size===0&&(
            <div className="px-4 py-6 text-center">
              <BookOpen className="w-6 h-6 text-gray-300 mx-auto mb-2"/>
              <p className="text-xs text-gray-400 leading-relaxed">Search taken courses, save from <a href="/explore" className="text-blue-500 underline">Explore</a>, or add topics above.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CANVAS ── */}
      <div ref={containerRef} className="flex-1 relative bg-slate-50 min-w-0">
        <canvas ref={canvasRef} width={dims.w} height={dims.h} className="absolute inset-0" style={{cursor:"grab"}}/>
        {mounted&&activeLabels.length===0&&(
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center max-w-xs">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="text-sm font-medium text-gray-500 mb-1">Your knowledge map is empty</p>
              <p className="text-xs text-gray-400">Mark courses as taken or save courses from Explore</p>
            </div>
          </div>
        )}
        {activeLabels.length>0&&selectedLabels.size===0&&(
          <div className="absolute bottom-4 left-4 bg-white/90 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-400 shadow-sm">
            Click nodes to select · scroll to zoom · drag to pan
          </div>
        )}
        {selectedLabels.size>0&&(
          <div className="absolute bottom-4 left-4 bg-white/90 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500 shadow-sm flex items-center gap-2">
            <span className="font-semibold text-blue-600">{selectedLabels.size} selected</span>
            · click empty space to clear
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL: COURSE MATCHES ── */}
      {selectedLabels.size>0&&(
        <div className="w-80 border-l border-gray-200 flex flex-col shrink-0 bg-white">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Matching Courses</h3>
              <button onClick={()=>{setSelectedLabels(new Set());selectedRef.current=new Set();}} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><X className="w-3 h-3"/>Clear</button>
            </div>
            {/* Selected label chips */}
            <div className="flex flex-wrap gap-1 mb-2">
              {Array.from(selectedLabels).map(l=>{
                const color=getClusterColor(getCluster(l));
                return(
                  <span key={l} onClick={()=>setSelectedLabels(p=>{const n=new Set(p);n.delete(l);selectedRef.current=n;return n;})}
                    className="flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs rounded-full cursor-pointer border"
                    style={{background:hex2rgba(color,0.1),borderColor:hex2rgba(color,0.3),color}}>
                    {l}<X className="w-2.5 h-2.5"/>
                  </span>);
              })}
            </div>
            <p className="text-xs text-gray-400">{matchingCourses.length} courses found</p>
          </div>

          {/* Semester filter */}
          <div className="px-4 py-2.5 border-b border-gray-100">
            <div className="relative">
              <select value={semFilter} onChange={e=>setSemFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-7 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer">
                <option value="">All semesters</option>
                {SEMESTERS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
            </div>
          </div>

          {/* Course list */}
          <div className="flex-1 overflow-y-auto">
            {matchingCourses.length===0?(
              <div className="text-center py-8 text-gray-400">
                <p className="text-xs">No courses match{semFilter?` in ${semFilter}`:""}</p>
                {semFilter&&<button onClick={()=>setSemFilter("")} className="text-xs text-blue-500 mt-1 underline">Clear filter</button>}
              </div>
            ):(
              matchingCourses.map(c=>(
                <MatchCard key={c.id} course={c} selectedLabels={selectedLabels}
                  isSaved={isSaved(c.id)} isTaken={isTaken(c.id)}
                  onSave={()=>toggleSave(c.id)} onTaken={()=>toggleTaken(c.id)}/>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
