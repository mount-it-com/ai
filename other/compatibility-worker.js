export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Accept both canonical and legacy paths
    if (url.pathname !== "/ai-compatibility" && url.pathname !== "/compatibility") {
      return new Response(
        JSON.stringify({ error: "Not found" }),
        { status: 404, headers: defaultHeaders() }
      );
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST is allowed" }),
        { status: 405, headers: defaultHeaders() }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: defaultHeaders() }
      );
    }

    // Normalize to canonical schema before validation and logic
    const normalized = normalizeRequest(body);

    const validationError = validateRequest(normalized);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: defaultHeaders() }
      );
    }

    const result = evaluateCompatibility(normalized);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: defaultHeaders() }
    );
  }
};

function defaultHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  };
}

/**
 * Normalize incoming request to a canonical shape
 * so older monitor_* and tv_* fields still work.
 */
function normalizeRequest(body) {
  if (!body || typeof body !== "object") {
    return {};
  }

  const rawType = body.type;
  const rawUser = body.user || {};
  const rawProduct = body.product || {};

  // Canonical type
  const type = rawType === "tv" || rawType === "monitor" ? rawType : "tv";

  // Canonical user fields
  const size_inches =
    typeof rawUser.size_inches === "number"
      ? rawUser.size_inches
      : typeof rawUser.monitor_size_inches === "number"
      ? rawUser.monitor_size_inches
      : typeof rawUser.tv_size_inches === "number"
      ? rawUser.tv_size_inches
      : undefined;

  const weight_lb =
    typeof rawUser.weight_lb === "number"
      ? rawUser.weight_lb
      : typeof rawUser.monitor_weight_lb === "number"
      ? rawUser.monitor_weight_lb
      : typeof rawUser.tv_weight_lb === "number"
      ? rawUser.tv_weight_lb
      : undefined;

  const vesa =
    typeof rawUser.vesa === "string"
      ? rawUser.vesa
      : typeof rawUser.vesa_pattern === "string"
      ? rawUser.vesa_pattern
      : typeof rawUser.vesaPattern === "string"
      ? rawUser.vesaPattern
      : undefined;

  const user = {
    ...rawUser,
    size_inches,
    weight_lb,
    vesa
  };

  // Canonical product fields
  const max_size_inches =
    typeof rawProduct.max_size_inches === "number"
      ? rawProduct.max_size_inches
      : typeof rawProduct.max_tv_size_inches === "number"
      ? rawProduct.max_tv_size_inches
      : typeof rawProduct.max_monitor_size_inches === "number"
      ? rawProduct.max_monitor_size_inches
      : undefined;

  const weight_capacity_lb =
    typeof rawProduct.weight_capacity_lb === "number"
      ? rawProduct.weight_capacity_lb
      : typeof rawProduct.weight_limit_lb === "number"
      ? rawProduct.weight_limit_lb
      : typeof rawProduct.weight_limit === "number"
      ? rawProduct.weight_limit
      : undefined;

  let vesa_supported = rawProduct.vesa_supported;
  if (Array.isArray(rawProduct.vesaSupported)) {
    vesa_supported = rawProduct.vesaSupported;
  }

  const product = {
    ...rawProduct,
    max_size_inches,
    weight_capacity_lb,
    vesa_supported
  };

  return {
    ...body,
    type,
    user,
    product
  };
}

function validateRequest(body) {
  if (!body || typeof body !== "object") {
    return "Body must be an object";
  }

  const { type, user, product } = body;

  if (type !== "tv" && type !== "monitor") {
    return 'type must be "tv" or "monitor"';
  }

  if (!user || typeof user !== "object") {
    return "user object is required";
  }

  if (typeof user.size_inches !== "number") {
    return "user.size_inches must be a number";
  }

  if (typeof user.weight_lb !== "number") {
    return "user.weight_lb must be a number";
  }

  if (typeof user.vesa !== "string") {
    return "user.vesa must be a string";
  }

  if (!product || typeof product !== "object") {
    return "product object is required";
  }

  if (
    !product.url &&
    typeof product.max_size_inches !== "number" &&
    typeof product.weight_capacity_lb !== "number" &&
    !Array.isArray(product.vesa_supported)
  ) {
    return "product must include url or at least one spec field";
  }

  if (
    product.vesa_supported &&
    !Array.isArray(product.vesa_supported)
  ) {
    return "product.vesa_supported must be an array of strings";
  }

  return null;
}

function evaluateCompatibility(body) {
  const { type, user, product } = body;

  const userSize = user.size_inches;
  const userWeight = user.weight_lb;
  const userVesa = (user.vesa || "").toLowerCase().trim();

  // Resolved specs container
  const resolved = {
    max_tv_size_inches: null,
    max_monitor_size_inches: null,
    weight_capacity_lb: null,
    vesa_supported: Array.isArray(product.vesa_supported)
      ? product.vesa_supported.map(v => String(v).toLowerCase().trim())
      : []
  };

  if (typeof product.max_size_inches === "number") {
    if (type === "tv") {
      resolved.max_tv_size_inches = product.max_size_inches;
    } else {
      resolved.max_monitor_size_inches = product.max_size_inches;
    }
  }

  if (typeof product.weight_capacity_lb === "number") {
    resolved.weight_capacity_lb = product.weight_capacity_lb;
  }

  const checks = {
    size: null,
    weight: null,
    vesa: null
  };

  // Size check
  if (type === "tv" && resolved.max_tv_size_inches != null) {
    checks.size = userSize <= resolved.max_tv_size_inches;
  } else if (type === "monitor" && resolved.max_monitor_size_inches != null) {
    checks.size = userSize <= resolved.max_monitor_size_inches;
  }

  // Weight check with fifteen percent safety margin
  if (resolved.weight_capacity_lb != null) {
    const allowed = resolved.weight_capacity_lb * 0.85;
    checks.weight = userWeight <= allowed;
  }

  // VESA check
  if (resolved.vesa_supported.length > 0 && userVesa) {
    checks.vesa = resolved.vesa_supported.includes(userVesa);
  }

  const compatibleFlags = [];

  if (checks.size !== null) compatibleFlags.push(checks.size);
  if (checks.weight !== null) compatibleFlags.push(checks.weight);
  if (checks.vesa !== null) compatibleFlags.push(checks.vesa);

  const compatible =
    compatibleFlags.length === 0 ? false : compatibleFlags.every(Boolean);

  const reasons = [];
  const safetyNotes = [];
  const matchedRules = [];
  const suggestedCollections = [];
  const recommendedSeries = [];

  if (checks.size === false) {
    reasons.push("Screen size exceeds the product size rating.");
  } else if (checks.size === true) {
    matchedRules.push("size_ok");
  }

  if (checks.weight === false) {
    reasons.push(
      "Screen weight exceeds capacity with fifteen percent safety margin."
    );
    safetyNotes.push("Consider a heavier duty mount or reduce load.");
  } else if (checks.weight === true) {
    matchedRules.push("weight_ok_with_margin");
  }

  if (checks.vesa === false) {
    reasons.push("VESA pattern is not listed as supported.");
  } else if (checks.vesa === true) {
    matchedRules.push("vesa_match");
  }

  if (compatible) {
    reasons.push("All available checks pass within safety guidelines.");
  }

  if (type === "tv") {
    suggestedCollections.push(
      "https://www.mount-it.com/collections/tv-mounts"
    );
    if (userWeight >= 100) {
      recommendedSeries.push("The Beast");
    }
  } else if (type === "monitor") {
    suggestedCollections.push(
      "https://www.mount-it.com/collections/monitor-mounts"
    );
    if (userSize <= 34) {
      recommendedSeries.push("CLiX");
    } else {
      recommendedSeries.push("ProFLEX");
    }
  }

  return {
    compatible,
    reasons,
    checks,
    user,
    product,
    resolved_specs: resolved,
    recommended_series: recommendedSeries,
    suggested_collections: suggestedCollections,
    safety_notes: safetyNotes,
    matched_rules: matchedRules
  };
}