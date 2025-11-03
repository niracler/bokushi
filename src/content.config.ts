import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const sharedSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    socialImage: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    hidden: z.boolean().optional().default(false),
    commentId: z.string().optional(),
});

const blog = defineCollection({
    loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
    schema: sharedSchema,
});

const monthly = defineCollection({
    loader: glob({ base: "./src/content/monthly", pattern: "**/*.{md,mdx}" }),
    schema: sharedSchema,
});

const til = defineCollection({
    loader: glob({ base: "./src/content/til", pattern: "**/*.{md,mdx}" }),
    schema: sharedSchema,
});

export const collections = { blog, monthly, til };
