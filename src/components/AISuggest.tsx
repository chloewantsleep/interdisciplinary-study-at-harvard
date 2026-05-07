"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Key, Send, AlertCircle, BookOpen, RefreshCw } from "lucide-react";
import { useSaved } from "@/lib/useSaved";

const PROMPTS = [
  "I'm an HKS student focused on climate policy. I want to understand the science behind climate change and also learn design thinking for public spaces.",
  "I study computer science at FAS and want to explore AI ethics, public health data, and the societal implications of technology.",
  "I'm at HBS and interested in social entrepreneurship. I'd like courses on education reform, urban design, and behavioral economics.",
  "I'm an HGSE student studying learning sciences. I want to connect with courses on neuroscience, technology design, and policy.",
];

export default function AISuggest() {
  const { savedIds } = useSaved();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [input, setInput] = useState("");
  const [jobTarget, setJobTarget] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("hv-api-key");
      if (stored) setApiKey(stored);
    } catch {}
  }, []);

  const saveKey = (k: string) => {
    setApiKey(k);
    try { sessionStorage.setItem("hv-api-key", k); } catch {}
  };

  const submit = async () => {
    if (!apiKey || !input.trim()) return;
    setLoading(true);
    setResponse("");
    setError("");

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: input,
          jobTarget: jobTarget.trim(),
          savedCourseIds: Array.from(savedIds),
          apiKey,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResponse((prev) => prev + decoder.decode(value));
        if (responseRef.current) {
          responseRef.current.scrollTop = responseRef.current.scrollHeight;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">AI Course Advisor</h1>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          Describe your background, interests, and goals. Claude will recommend courses from across Harvard schools
          to help you build an interdisciplinary path.
          {savedIds.size > 0 && (
            <span className="text-amber-600"> Your {savedIds.size} saved courses will be included as context.</span>
          )}
        </p>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Anthropic API Key</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">stored in session only</span>
        </div>
        <div className="flex gap-2">
          <input
            type={showKey ? "text" : "password"}
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => saveKey(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
          />
          <button onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
        {!apiKey && (
          <p className="text-xs text-gray-400 mt-2">
            Get your key at <span className="font-mono">console.anthropic.com</span>
          </p>
        )}
      </div>

      {/* Input */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Your background &amp; goals</span>
          <span className="text-xs text-gray-400">Try an example →</span>
        </div>

        {/* Example prompts */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PROMPTS.map((p, i) => (
            <button key={i} onClick={() => setInput(p)}
              className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors border border-blue-100">
              Example {i + 1}
            </button>
          ))}
        </div>

        <textarea
          rows={4}
          placeholder="e.g. I'm an HKS student focused on climate policy. I'd like to understand the engineering and design side of sustainable infrastructure..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 resize-none"
        />

        {/* Job target */}
        <div className="mt-3">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Target role or job posting <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text"
            placeholder="Paste a job URL or describe the role, e.g. Policy analyst at the UN"
            value={jobTarget}
            onChange={(e) => setJobTarget(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <BookOpen className="w-3.5 h-3.5" />
            {savedIds.size > 0 ? `${savedIds.size} saved courses included as context` : "Save courses in Explore to include them"}
          </div>
          <button
            onClick={submit}
            disabled={loading || !apiKey || !input.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: loading || !apiKey || !input.trim() ? "#d1d5db" : "#A51C30" }}
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "Thinking..." : "Get Recommendations"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Response */}
      {(response || loading) && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-amber-50">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">AI Recommendations</span>
            {loading && <span className="text-xs text-amber-600 ml-auto animate-pulse">Generating...</span>}
          </div>
          <div
            ref={responseRef}
            className="px-5 py-5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto"
            style={{ fontFamily: "inherit" }}
          >
            {response}
            {loading && <span className="inline-block w-1.5 h-4 bg-amber-400 ml-0.5 animate-pulse rounded-sm" />}
          </div>
        </div>
      )}
    </div>
  );
}
