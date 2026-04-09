export const thetaToPercent = (theta) => Math.round(((theta + 3) / 6) * 100);

export const scoreColor = (score) => {
  if (score >= 7.5) return "text-emerald-600";
  if (score >= 5) return "text-amber-600";
  return "text-red-600";
};

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const RUBRIC_DIMS = [
  { key: "clarity", label: "Clarity", desc: "How clearly communicated?" },
  { key: "depth", label: "Depth", desc: "Technical depth & completeness" },
  {
    key: "relevance",
    label: "Relevance",
    desc: "Directly addresses the question?",
  },
  {
    key: "communication",
    label: "Communication",
    desc: "Professional tone & vocabulary",
  },
  {
    key: "starStructure",
    label: "STAR Structure",
    desc: "Situation→Task→Action→Result",
  },
  {
    key: "specificity",
    label: "Specificity",
    desc: "Concrete examples vs vague",
  },
];
