/**
 * Studio Categories & Workflow Presets
 * Pre-built multi-step workflow templates for each studio category.
 */

import {
  Video, Code2, FileText, Search, Zap, FolderOpen, Briefcase, User,
  Youtube, Scissors, Image, Share2, PenTool,
  Globe, Server, Database, Layout,
  Presentation, Scale,
  Brain, BookOpen,
  Workflow, TrendingUp,
  Palette, Layers,
  Megaphone, Rocket as RocketBiz,
  Calendar, Mail,
  type LucideIcon,
} from "lucide-react";

export type WorkflowPreset = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  prompt: string; // The multi-step prompt sent to the agent planner
};

export type StudioCategory = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: LucideIcon;
  color: string; // Tailwind color class for accent
  workflows: WorkflowPreset[];
};

export const STUDIO_CATEGORIES: StudioCategory[] = [
  {
    id: "creator-studio",
    name: "AI Creator Studio",
    shortName: "Creator",
    description: "For creators, YouTubers & marketers",
    icon: Video,
    color: "text-red-500",
    workflows: [
      {
        id: "youtube-package",
        name: "YouTube Video Package",
        description: "Ideas → Script → Thumbnail → Video",
        icon: Youtube,
        prompt: "Generate 5 YouTube video ideas about [topic]. Then write a full script for the best idea. Then create a thumbnail image for it. Then export the script as a PDF file.",
      },
      {
        id: "shorts-generator",
        name: "Shorts/Reels Generator",
        description: "Create viral short-form content",
        icon: Scissors,
        prompt: "Generate 5 viral short-form video ideas about [topic]. Then write 60-second scripts for each with hooks, body, and CTA. Then create vertical thumbnail images for the top 3.",
      },
      {
        id: "social-media-pack",
        name: "Social Media Package",
        description: "Posts for all platforms",
        icon: Share2,
        prompt: "Create a social media content package about [topic]. Write posts optimized for Twitter/X (280 chars), Instagram (with hashtags), LinkedIn (professional tone), and Facebook. Then generate a social media image. Then create a content calendar for 7 days.",
      },
    ],
  },
  {
    id: "developer-studio",
    name: "AI Developer Studio",
    shortName: "Developer",
    description: "For developers & builders",
    icon: Code2,
    color: "text-blue-500",
    workflows: [
      {
        id: "fullstack-app",
        name: "Full-Stack App Generator",
        description: "Spec → Architecture → Working app",
        icon: Globe,
        prompt: "Design the architecture for a [description] web application. Then build a production-quality full-stack web app with all features, responsive design, and modern UI.",
      },
      {
        id: "api-builder",
        name: "API Builder",
        description: "Design → Schema → Documentation",
        icon: Server,
        prompt: "Design a RESTful API for [description]. Create the full API schema with endpoints, request/response formats, and authentication. Then generate API documentation in markdown. Then create example code for each endpoint. Then export as a JSON file.",
      },
      {
        id: "landing-page",
        name: "Landing Page Builder",
        description: "Copy → Design → Working page",
        icon: Layout,
        prompt: "Write compelling landing page copy for [product/service] with hero section, features, testimonials, pricing, and CTA. Then build a production-quality responsive landing page web app with animations and modern design.",
      },
    ],
  },
  {
    id: "document-suite",
    name: "AI Document Suite",
    shortName: "Documents",
    description: "AI office workspace",
    icon: FileText,
    color: "text-green-500",
    workflows: [
      {
        id: "resume-builder",
        name: "Resume Builder",
        description: "Info → Optimized resume → PDF",
        icon: User,
        prompt: "Create a professional resume for [name/role] with these details: [experience]. Optimize it with action verbs and quantified achievements. Then format it as a clean, ATS-friendly document. Then export as a PDF file.",
      },
      {
        id: "presentation-builder",
        name: "Presentation Builder",
        description: "Topic → Outline → Full slides",
        icon: Presentation,
        prompt: "Create a presentation outline about [topic] with 10-12 slides. Then write detailed content for each slide with speaker notes. Then generate a cover slide image. Then export the full presentation as a markdown file with slide separators.",
      },
      {
        id: "contract-generator",
        name: "Contract Generator",
        description: "Create legal-ready contracts",
        icon: Scale,
        prompt: "Create a professional [type] contract between [party A] and [party B]. Include all standard clauses: scope of work, payment terms, confidentiality, termination, liability, and dispute resolution. Then review for completeness. Then export as a PDF file.",
      },
    ],
  },
  {
    id: "knowledge-engine",
    name: "AI Knowledge Engine",
    shortName: "Research",
    description: "Research & analysis tools",
    icon: Search,
    color: "text-purple-500",
    workflows: [
      {
        id: "research-assistant",
        name: "Research Assistant",
        description: "Deep research on any topic",
        icon: Brain,
        prompt: "Conduct comprehensive research on [topic]. Cover: background, current state, key players, trends, challenges, and future outlook. Then create an executive summary. Then provide a list of key statistics and data points. Then export as a detailed report PDF.",
      },
      {
        id: "content-summarizer",
        name: "Content Summarizer",
        description: "Summarize any long content",
        icon: BookOpen,
        prompt: "Summarize the following content in multiple formats: [content]. Create a 1-paragraph executive summary, a bullet-point key takeaways list, a detailed 1-page summary, and an actionable insights list. Then export as a markdown file.",
      },
    ],
  },
  {
    id: "automation-studio",
    name: "AI Automation & Agents",
    shortName: "Automation",
    description: "Workflows & task automation",
    icon: Zap,
    color: "text-yellow-500",
    workflows: [
      {
        id: "content-pipeline",
        name: "Content Pipeline",
        description: "Full content production workflow",
        icon: Workflow,
        prompt: "Create a complete content pipeline for [topic/niche]. Generate 10 content ideas with titles. Then write outlines for the top 5. Then create full content for the best one. Then generate social media posts to promote it. Then create a distribution schedule. Then export everything as organized files.",
      },
      {
        id: "marketing-automation",
        name: "Marketing Package",
        description: "Full marketing campaign assets",
        icon: TrendingUp,
        prompt: "Create a complete marketing package for [product/service]. Write ad copy for Google, Facebook, and Instagram. Then create email sequences (welcome, nurture, conversion). Then design landing page content. Then generate promotional images. Then create a campaign timeline.",
      },
    ],
  },
  {
    id: "file-tools",
    name: "AI File & Media Tools",
    shortName: "Media",
    description: "Convert, enhance & process files",
    icon: FolderOpen,
    color: "text-orange-500",
    workflows: [
      {
        id: "image-editor",
        name: "AI Image Editor",
        description: "Generate and edit images with AI",
        icon: Palette,
        prompt: "Create a professional [type] image for [purpose]. Generate the image with high quality. Then create 2 variations with different color schemes. Then create a version optimized for social media (square crop).",
      },
      {
        id: "batch-file-create",
        name: "Batch File Creator",
        description: "Generate multiple files at once",
        icon: Layers,
        prompt: "Create a batch of files for [purpose]: Generate a README.md, a project plan as PDF, a data template as Excel, and a configuration as JSON. Export each file in its proper format.",
      },
    ],
  },
  {
    id: "business-tools",
    name: "AI Business Tools",
    shortName: "Business",
    description: "Marketing, sales & growth tools",
    icon: Briefcase,
    color: "text-emerald-500",
    workflows: [
      {
        id: "business-plan",
        name: "Business Plan Generator",
        description: "Complete business plan with financials",
        icon: RocketBiz,
        prompt: "Create a comprehensive business plan for [business idea]. Include executive summary, market analysis, competitive landscape, business model, marketing strategy, financial projections (3 years), and team structure. Then create a pitch deck outline. Then export as a PDF.",
      },
      {
        id: "product-launch",
        name: "Product Launch Kit",
        description: "Everything for a product launch",
        icon: Megaphone,
        prompt: "Create a product launch kit for [product]. Write the product description, feature highlights, and USP. Then create launch email sequence (teaser, launch day, follow-up). Then write social media launch posts. Then create a press release. Then generate a product image. Then export everything as files.",
      },
    ],
  },
  {
    id: "personal-assistant",
    name: "AI Personal Assistant",
    shortName: "Assistant",
    description: "Your AI personal assistant",
    icon: User,
    color: "text-pink-500",
    workflows: [
      {
        id: "daily-planner",
        name: "Daily Planner",
        description: "Plan your day with AI",
        icon: Calendar,
        prompt: "Create a detailed daily plan for [date/context]. Include time blocks for: morning routine, deep work sessions, meetings, breaks, exercise, and evening wind-down. Then generate a prioritized task list. Then create a meal plan. Then export as a PDF schedule.",
      },
      {
        id: "email-drafter",
        name: "Email Drafter",
        description: "Draft professional emails",
        icon: Mail,
        prompt: "Draft 5 versions of a professional email about [topic] to [recipient]. Include: formal, friendly, brief, detailed, and follow-up versions. Then provide subject line options for each. Then export the best version as a text file.",
      },
    ],
  },
];

/** Get a studio category by ID */
export function getStudioById(id: string): StudioCategory | undefined {
  return STUDIO_CATEGORIES.find((s) => s.id === id);
}

/** Get a workflow preset by ID across all studios */
export function getWorkflowById(id: string): { studio: StudioCategory; workflow: WorkflowPreset } | undefined {
  for (const studio of STUDIO_CATEGORIES) {
    const wf = studio.workflows.find((w) => w.id === id);
    if (wf) return { studio, workflow: wf };
  }
  return undefined;
}
