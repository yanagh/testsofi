function makeFakeFurniture(roomType, styleText, variantId) {
  const styleSlug = styleText.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const roomSlug = roomType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const base = [
    "Main seating piece",
    "Storage unit",
    "Accent lighting",
    "Textile set",
    "Decor element"
  ];

  return base.map((name, idx) => {
    const itemSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      name,
      store: `DemoStore ${idx + 1}`,
      url: `https://shop.example/${roomSlug}/${styleSlug}/${itemSlug}-${variantId}`
    };
  });
}

function createDesignBlueprints(input) {
  const variants = [
    {
      id: "A",
      title: "Option A",
      angle: "clean composition, strong natural light, practical layout"
    },
    {
      id: "B",
      title: "Option B",
      angle: "bold statement accents, layered textures, expressive styling"
    },
    {
      id: "C",
      title: "Option C",
      angle: "cozy atmosphere, warm mood, comfort-first zoning"
    }
  ];

  const budgetNum = Number(input.budget);
  const hasBudget = Number.isFinite(budgetNum) && budgetNum > 0;

  return variants.map((variant, idx) => {
    const low = hasBudget ? Math.round(budgetNum * (0.8 + idx * 0.08)) : 500 + idx * 200;
    const high = hasBudget ? Math.round(budgetNum * (1.1 + idx * 0.1)) : 1100 + idx * 250;

    return {
      id: variant.id,
      title: variant.title,
      summary: `${input.styleText} ${input.roomType} concept with ${variant.angle}. Built for ${input.livingSetup}.`,
      budgetRange: `$${low} - $${high}`,
      prompt: [
        `Photorealistic interior design render of a complete ${input.roomType}.`,
        `Style: ${input.styleText}.`,
        `Room size: ${input.size} square meters.`,
        `User profile: ${input.livingSetup}.`,
        `Preferences: ${input.wishes || "none"}.`,
        `Creative direction: ${variant.angle}.`,
        "Show the full room, not a cropped corner.",
        "Use a wide-angle interior camera view that captures most of the space from wall to wall.",
        "Show floor, ceiling, main furniture layout, circulation paths, and overall room composition.",
        "Architectural interior photography, ultra-detailed, realistic materials, balanced perspective, no text, no watermark, no people."
      ].join(" "),
      furniture: makeFakeFurniture(input.roomType, input.styleText, variant.id)
    };
  });
}

async function generateImageWithOpenAI(prompt, apiKey) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI image generation failed (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const item = json?.data?.[0];

  if (item?.url) {
    return item.url;
  }

  if (item?.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }

  throw new Error("OpenAI returned no image payload");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const input = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (!input?.roomType || !input?.styleText) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing. Add it in Vercel environment variables."
      });
    }

    const blueprints = createDesignBlueprints(input);

    const images = await Promise.all(
      blueprints.map((bp) => generateImageWithOpenAI(bp.prompt, apiKey))
    );

    const designs = blueprints.map((bp, idx) => ({
      id: bp.id,
      title: bp.title,
      summary: bp.summary,
      budgetRange: bp.budgetRange,
      imageUrl: images[idx],
      furniture: bp.furniture
    }));

    return res.status(200).json({ designs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to generate designs" });
  }
}
