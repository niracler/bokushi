import type { APIRoute } from "astro";
import { trip } from "../../../data/japan-trip";

export const GET: APIRoute = () => Response.json(trip);
