export interface Course {
  id: string;
  name: string;
  school: string;
  semester: string;
  year: string;
  type: string;
  credits: string;
  creditsNum: number;
  mode: string;
  schedule: string;
  instructor: string;
  department: string;
  prerequisites: string;
  restrictions: string;
  description: string;
  url: string;
  keywords: string;
  keywordList: string[];
}

export const SCHOOL_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  FAS:  { bg: "bg-red-100",    text: "text-red-800",    border: "border-red-300",    hex: "#A51C30" },
  GSD:  { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-300",   hex: "#1D4ED8" },
  HBS:  { bg: "bg-rose-100",   text: "text-rose-800",   border: "border-rose-300",   hex: "#8B0000" },
  HDS:  { bg: "bg-amber-100",  text: "text-amber-800",  border: "border-amber-300",  hex: "#B45309" },
  HGSE: { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300", hex: "#4338CA" },
  HKS:  { bg: "bg-teal-100",   text: "text-teal-800",   border: "border-teal-300",   hex: "#0F766E" },
  HLS:  { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300", hex: "#7E22CE" },
  HSPH: { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300",  hex: "#166534" },
};

export const SCHOOL_FULL: Record<string, string> = {
  FAS:  "Faculty of Arts & Sciences",
  GSD:  "Graduate School of Design",
  HBS:  "Business School",
  HDS:  "Divinity School",
  HGSE: "Graduate School of Education",
  HKS:  "Kennedy School",
  HLS:  "Law School",
  HSPH: "School of Public Health",
};
