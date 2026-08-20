import { handleRecommendation } from "../lib/recommendation.js";

export async function onRequestPost(context) {
  return handleRecommendation(context.request);
}
