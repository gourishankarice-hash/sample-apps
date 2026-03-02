/**
 * Tool: search_knowledge_base
 * Searches a mock internal knowledge base.
 * Simulates a company wiki / SharePoint / Confluence integration.
 */

export interface KBArticle {
  id:       string;
  title:    string;
  category: string;
  summary:  string;
  content:  string;
  tags:     string[];
  author:   string;
  lastUpdated: string;
  url:      string;
}

export interface KBSearchResult {
  query:       string;
  category?:   string;
  totalFound:  number;
  articles:    KBArticle[];
}

const ARTICLES: KBArticle[] = [
  {
    id: "kb-001",
    title: "How to Reset Your Password",
    category: "IT Support",
    summary: "Step-by-step guide to resetting your corporate account password.",
    content: "1. Go to https://account.example.com/reset\n2. Enter your email address\n3. Check your email for the reset link\n4. Click the link and follow instructions\n5. Your new password must be 12+ characters and include uppercase, numbers, and symbols.",
    tags: ["password", "account", "security", "IT"],
    author: "IT Help Desk",
    lastUpdated: "2025-01-10",
    url: "https://wiki.example.com/kb-001",
  },
  {
    id: "kb-002",
    title: "Onboarding Checklist for New Employees",
    category: "HR",
    summary: "Complete checklist of tasks every new employee should complete in their first week.",
    content: "Day 1: Complete HR paperwork, set up workstation, attend orientation.\nDay 2: Meet your team, set up development environment.\nDay 3: Complete security training.\nWeek 1: Shadow a senior team member, attend all-hands meeting.",
    tags: ["onboarding", "HR", "new employee"],
    author: "HR Department",
    lastUpdated: "2025-02-01",
    url: "https://wiki.example.com/kb-002",
  },
  {
    id: "kb-003",
    title: "VPN Setup Guide",
    category: "IT Support",
    summary: "Instructions for configuring the corporate VPN on Windows, Mac, and Linux.",
    content: "Download the VPN client from https://vpn.example.com/download.\nInstall and enter your corporate credentials.\nFor MFA, approve the push notification on your authenticator app.",
    tags: ["VPN", "remote work", "security", "network"],
    author: "IT Security",
    lastUpdated: "2025-01-20",
    url: "https://wiki.example.com/kb-003",
  },
  {
    id: "kb-004",
    title: "Expense Reimbursement Policy",
    category: "Finance",
    summary: "Policy and procedures for submitting expense reports and getting reimbursed.",
    content: "Submit expenses within 30 days of the transaction.\nAttach receipts for anything over $25.\nUse the Concur expense system at https://concur.example.com.\nApproval required from your manager for expenses over $500.",
    tags: ["expenses", "finance", "reimbursement", "travel"],
    author: "Finance Team",
    lastUpdated: "2024-12-15",
    url: "https://wiki.example.com/kb-004",
  },
  {
    id: "kb-005",
    title: "Code Review Best Practices",
    category: "Engineering",
    summary: "Guidelines for conducting effective and respectful code reviews.",
    content: "Keep PRs small (< 400 lines). Review for logic, security, performance, and readability.\nProvide constructive, specific feedback. Approve or request changes within 24 hours.\nUse conventional comments prefixes: nit:, blocker:, question:.",
    tags: ["code review", "engineering", "development", "best practices"],
    author: "Engineering Guild",
    lastUpdated: "2025-01-05",
    url: "https://wiki.example.com/kb-005",
  },
  {
    id: "kb-006",
    title: "Azure Resource Naming Conventions",
    category: "Engineering",
    summary: "Standard naming conventions for Azure resources across the organization.",
    content: "Format: {type}-{project}-{environment}-{region}-{sequence}\nExample: rg-payments-prod-eus-001\nEnvironments: dev, test, staging, prod\nRegions: eus (East US), wus (West US), weu (West Europe)",
    tags: ["azure", "cloud", "naming", "conventions", "engineering"],
    author: "Cloud Architecture",
    lastUpdated: "2025-02-10",
    url: "https://wiki.example.com/kb-006",
  },
  {
    id: "kb-007",
    title: "Incident Response Runbook",
    category: "Operations",
    summary: "Step-by-step procedures for responding to production incidents.",
    content: "1. Acknowledge alert in PagerDuty.\n2. Create incident channel in Slack: #inc-{date}-{short-desc}.\n3. Assign Incident Commander (IC).\n4. Diagnose using standard dashboards.\n5. Apply fix or rollback.\n6. Write post-mortem within 48 hours.",
    tags: ["incident", "operations", "on-call", "runbook"],
    author: "Site Reliability",
    lastUpdated: "2025-01-28",
    url: "https://wiki.example.com/kb-007",
  },
];

export function searchKnowledgeBase(
  query: string,
  category?: string,
  limit = 5
): KBSearchResult {
  const q = query.toLowerCase();

  let results = ARTICLES.filter((article) => {
    const haystack = [
      article.title,
      article.summary,
      article.content,
      ...article.tags,
    ].join(" ").toLowerCase();

    return haystack.includes(q);
  });

  if (category) {
    results = results.filter(
      (a) => a.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Simple relevance: title match > tag match > content match
  results.sort((a, b) => {
    const aTitle = a.title.toLowerCase().includes(q) ? 2 : 0;
    const aTag   = a.tags.some((t) => t.toLowerCase().includes(q)) ? 1 : 0;
    const bTitle = b.title.toLowerCase().includes(q) ? 2 : 0;
    const bTag   = b.tags.some((t) => t.toLowerCase().includes(q)) ? 1 : 0;
    return (bTitle + bTag) - (aTitle + aTag);
  });

  return {
    query,
    category,
    totalFound: results.length,
    articles: results.slice(0, limit),
  };
}

export function getCategories(): string[] {
  return [...new Set(ARTICLES.map((a) => a.category))];
}
