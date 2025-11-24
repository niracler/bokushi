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

// Galleries collection for Pandabox lightbox component
const galleries = defineCollection({
    loader: glob({ base: "./src/content/galleries", pattern: "*.json" }),
    schema: ({ image }) =>
        z.object({
            images: z.array(
                z.object({
                    src: image(),
                    alt: z.string(),
                    title: z.string().optional(),
                    description: z.string().optional(),
                }),
            ),
        }),
});

// Mangashots collection - fetches data from worker API or D1 database
const mangashots = defineCollection({
    loader: async () => {
        // TODO: Replace with your actual worker API endpoint
        // Example: const response = await fetch('https://your-worker.workers.dev/api/mangashots');

        // Mock data matching the actual schema.sql structure
        // Fields: id, title, photo_url, thumbnail_url, caption, created_at, updated_at
        const mockData = [
            {
                id: "sample-1",
                title: "有趣的表情",
                photo_url: "https://picsum.photos/seed/manga1/400/600",
                thumbnail_url: "https://picsum.photos/seed/manga1/400/600",
                caption: "这是一个示例漫画截图",
                created_at: new Date("2024-01-01"),
            },
            {
                id: "sample-2",
                title: "可爱的反应",
                photo_url: "https://picsum.photos/seed/manga2/500/700",
                thumbnail_url: "https://picsum.photos/seed/manga2/500/700",
                caption: "另一个示例截图",
                created_at: new Date("2024-01-02"),
            },
            {
                id: "sample-3",
                title: "经典场景",
                photo_url: "https://picsum.photos/seed/manga3/600/400",
                thumbnail_url: "https://picsum.photos/seed/manga3/600/400",
                caption: null,
                created_at: new Date("2024-01-03"),
            },
        ];
        return mockData;
    },
    schema: z.object({
        id: z.string(),
        title: z.string(),
        photo_url: z.string().url(),
        thumbnail_url: z.string().url(),
        caption: z.string().nullable(),
        created_at: z.coerce.date(),
    }),
});

export const collections = { blog, monthly, til, galleries, mangashots };
