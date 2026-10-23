export type ProductImportCandidate = {
  id: string;
  name: string;
  description: string;
  supplier_name: string;
  supplier_url: string;
  image_url: string | null;
  category: string;
  supplier_price: number | null;
  selling_price: number | null;
  currency: string;
  sku: string | null;
  stock_quantity: number | null;
  attributes: Record<string, string>;
  warnings: string[];
  is_missing_required_data: boolean;
};

export function normalizeCurrency(value?: string | null) {
  if (!value) return "PKR";
  const cleaned = value.trim().toUpperCase();
  return cleaned.length === 3 ? cleaned : "PKR";
}

export function isAllowedSupplierUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return false;
    }

    if (url.hostname.endsWith(".local") || url.hostname.endsWith(".internal")) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname.startsWith("172.")) {
      return false;
    }

    if (hostname === "[::1]" || hostname === "::1") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    if (!cleaned) return null;
    const asNumber = Number(cleaned);
    return Number.isFinite(asNumber) ? asNumber : null;
  }

  return null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parsePlainTextFromHtml(html: string) {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const normalized = withoutStyles
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeWhitespace(decodeHtmlEntities(normalized));
}

function decodeHtmlEntities(value: string) {
  const textarea = new globalThis.TextEncoder();
  const text = String(value).replace(/&nbsp;/gi, " ");
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&([^;]+);/g, (entity) => {
      const match = entity.match(/^#(\d+)$/);
      if (match) {
        try {
          return String.fromCharCode(Number(match[1]));
        } catch {
          return entity;
        }
      }
      return entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function createConfigError(provider: string) {
  return {
    ok: false,
    error: `Missing ${provider} configuration. Add the required server-side environment variables in Vercel before testing the importer.`,
  } as const;
}

export function buildProductCandidateFromHtml(
  url: string,
  html: string,
  fallbackCategory = "General"
): ProductImportCandidate {
  const text = parsePlainTextFromHtml(html);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : "";
  const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  const description = metaDescription ? decodeHtmlEntities(metaDescription[1]) : text.slice(0, 500);
  const name = title || text.slice(0, 80) || "Untitled product";
  const supplierName = new URL(url).hostname.replace(/^www\./i, "");
  const rawPrice = text.match(/(?:Rs|PKR|Price|price)[^\d]{0,20}(\d+[.,]?\d{0,2})/i)?.[1] ?? null;
  const numericPrice = rawPrice ? Number(rawPrice.replace(/,/g, "")) : null;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: escapeHtml(name).slice(0, 180) || "Untitled product",
    description: escapeHtml(description).slice(0, 1000),
    supplier_name: supplierName,
    supplier_url: url,
    image_url: null,
    category: fallbackCategory,
    supplier_price: numericPrice,
    selling_price: numericPrice ? Math.max(numericPrice * 1.25, numericPrice) : null,
    currency: "PKR",
    sku: null,
    stock_quantity: null,
    attributes: {
      source: "supplier page",
    },
    warnings: [
      "Supplier page was parsed heuristically; verify price, category, and product data before import.",
    ],
    is_missing_required_data: true,
  };
}
