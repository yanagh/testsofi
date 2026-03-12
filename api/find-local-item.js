const JYSK_BASE_URL = "https://jysk.ge";

const CATEGORY_CONFIG = {
  armchair: {
    pageUrl: `${JYSK_BASE_URL}/en/category/Living-Room/Armchairs/`,
    matchTerms: ["armchair", "chair", "recliner", "lounge"],
    avoidTerms: ["cover", "cushion"]
  },
  chair: {
    pageUrl: `${JYSK_BASE_URL}/en/category/Office/Office-Chairs/`,
    matchTerms: ["chair", "office chair", "desk chair"],
    avoidTerms: ["mat", "cover"]
  },
  rug: {
    pageUrl: `${JYSK_BASE_URL}/en/category/Homeware/Rugs/`,
    matchTerms: ["rug", "carpet", "mat"],
    avoidTerms: ["underlay", "cleaner"]
  },
  lamp: {
    pageUrl: `${JYSK_BASE_URL}/en/category/Homeware/Lighting/`,
    matchTerms: ["lamp", "light", "lantern", "lighting"],
    avoidTerms: ["bulb", "battery", "charger"]
  },
  "side table": {
    pageUrl: `${JYSK_BASE_URL}/en/category/Living-Room/Coffee-End-Tables/`,
    matchTerms: ["table", "side table", "end table", "coffee table"],
    avoidTerms: ["desk", "dining"]
  },
  shelving: {
    pageUrl: `${JYSK_BASE_URL}/en/category/Storage/Shelves-Bookcases/`,
    matchTerms: ["shelf", "bookcase", "rack", "storage"],
    avoidTerms: ["box", "basket"]
  },
  mirror: {
    pageUrl: `${JYSK_BASE_URL}/en/category/Homeware/Mirrors/`,
    matchTerms: ["mirror"],
    avoidTerms: ["sticker"]
  }
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absolutize(url) {
  if (!url) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return new URL(url, JYSK_BASE_URL).toString();
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match = regex.exec(html);

  while (match) {
    const text = match[1].trim();
    if (text) {
      blocks.push(text);
    }
    match = regex.exec(html);
  }

  return blocks;
}

function collectProductsFromJsonLd(node, acc) {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => collectProductsFromJsonLd(item, acc));
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  if (node["@type"] === "Product" && node.name && node.url) {
    const image = Array.isArray(node.image) ? node.image[0] : node.image;
    const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    acc.push({
      title: node.name,
      url: absolutize(node.url),
      imageUrl: absolutize(image || ""),
      price: offer?.price ? `${offer.price} ${offer.priceCurrency || ""}`.trim() : ""
    });
  }

  Object.values(node).forEach((value) => collectProductsFromJsonLd(value, acc));
}

function parseProductsFromJsonLd(html) {
  const products = [];
  const blocks = extractJsonLdBlocks(html);

  blocks.forEach((block) => {
    try {
      const parsed = JSON.parse(block);
      collectProductsFromJsonLd(parsed, products);
    } catch (_ignored) {
    }
  });

  return dedupeProducts(products);
}

function dedupeProducts(products) {
  const seen = new Set();
  return products.filter((product) => {
    if (!product?.url || !product?.title) {
      return false;
    }
    if (seen.has(product.url)) {
      return false;
    }
    seen.add(product.url);
    return true;
  });
}

function parseProductsFromAnchors(html) {
  const products = [];
  const anchorRegex = /<a[^>]+href="([^"]*\/en\/product\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match = anchorRegex.exec(html);

  while (match) {
    const url = absolutize(match[1]);
    const rawTitle = decodeHtml(match[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!rawTitle || normalize(rawTitle) === "read more") {
      match = anchorRegex.exec(html);
      continue;
    }

    const windowStart = Math.max(0, match.index - 1200);
    const windowEnd = Math.min(html.length, match.index + 1800);
    const context = html.slice(windowStart, windowEnd);
    const priceMatch = context.match(/([0-9]+(?:[.,][0-9]{2})?\s*(?:GEL|₾))/i);
    const imageMatches = [...context.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi)];
    const imageUrl = imageMatches.length ? absolutize(imageMatches[imageMatches.length - 1][1]) : "";

    products.push({
      title: rawTitle,
      url,
      imageUrl,
      price: priceMatch ? priceMatch[1] : ""
    });

    match = anchorRegex.exec(html);
  }

  return dedupeProducts(products);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RoomByYou/1.0; +https://vercel.com)",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch JYSK page (${response.status})`);
  }

  return response.text();
}

function parseMetaText(html, attrName, attrValue) {
  const regex = new RegExp(
    `<meta[^>]+${attrName}="${attrValue}"[^>]+content="([^"]+)"[^>]*>|<meta[^>]+content="([^"]+)"[^>]+${attrName}="${attrValue}"[^>]*>`,
    "i"
  );
  const match = html.match(regex);
  return decodeHtml(match?.[1] || match?.[2] || "");
}

async function enrichProduct(product) {
  if (product.imageUrl && product.price) {
    return product;
  }

  try {
    const html = await fetchHtml(product.url);
    return {
      ...product,
      imageUrl: product.imageUrl || absolutize(parseMetaText(html, "property", "og:image")),
      price:
        product.price ||
        parseMetaText(html, "property", "product:price:amount") ||
        parseMetaText(html, "itemprop", "price")
    };
  } catch (_ignored) {
    return product;
  }
}

async function inferItemFromDesign({ imageUrl, summary, roomType, styleText }, apiKey) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You identify one shoppable furniture or decor item from a room image. " +
            "Return valid JSON with keys category, keywords, colorHints, rationale. " +
            "Category must be one of: armchair, chair, rug, lamp, side table, shelving, mirror. " +
            "Pick the most obvious single buyable item and avoid built-ins or architecture. " +
            "keywords must be an array of 2 to 4 short English search terms."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Room type: ${roomType}. Style: ${styleText}. Summary: ${summary}. ` +
                "Choose the most visible practical item a user could buy from a local shop."
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI item inference failed (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content || "{}");
  const category = CATEGORY_CONFIG[parsed.category] ? parsed.category : "lamp";

  return {
    category,
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 4).map(normalize).filter(Boolean) : [],
    colorHints: Array.isArray(parsed.colorHints) ? parsed.colorHints.slice(0, 3).map(normalize).filter(Boolean) : [],
    rationale: parsed.rationale || `Similar to the ${category} used in this design.`
  };
}

function scoreCandidate(candidate, inferred, styleText) {
  const haystack = normalize(`${candidate.title} ${styleText}`);
  const config = CATEGORY_CONFIG[inferred.category];
  let score = 0;

  config.matchTerms.forEach((term) => {
    if (haystack.includes(normalize(term))) {
      score += 5;
    }
  });

  inferred.keywords.forEach((term) => {
    if (haystack.includes(term)) {
      score += 3;
    }
  });

  inferred.colorHints.forEach((term) => {
    if (haystack.includes(term)) {
      score += 2;
    }
  });

  config.avoidTerms.forEach((term) => {
    if (haystack.includes(normalize(term))) {
      score -= 4;
    }
  });

  if (candidate.imageUrl) {
    score += 1;
  }

  return score;
}

async function findJyskMatch(inferred, styleText) {
  const config = CATEGORY_CONFIG[inferred.category];
  const html = await fetchHtml(config.pageUrl);
  const parsedProducts = parseProductsFromJsonLd(html);
  const candidates = parsedProducts.length ? parsedProducts : parseProductsFromAnchors(html);

  if (!candidates.length) {
    return null;
  }

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, inferred, styleText)
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best || best.score < 5) {
    return null;
  }

  return enrichProduct(best);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing. Add it in Vercel environment variables."
      });
    }

    if (!body?.imageUrl || !body?.summary || !body?.styleText || !body?.roomType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (body.country !== "Georgia") {
      return res.status(200).json({
        match: null,
        reason: "Local shop matching is available for Georgia only in v1."
      });
    }

    const inferred = await inferItemFromDesign(body, apiKey);
    const product = await findJyskMatch(inferred, body.styleText);

    if (!product) {
      return res.status(200).json({
        match: null,
        reason: "No similar item found on JYSK Georgia yet."
      });
    }

    return res.status(200).json({
      match: {
        category: inferred.category,
        productName: product.title,
        productUrl: product.url,
        imageUrl: product.imageUrl,
        price: product.price,
        rationale: inferred.rationale,
        store: "JYSK Georgia"
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Failed to find a similar item on JYSK Georgia."
    });
  }
}
