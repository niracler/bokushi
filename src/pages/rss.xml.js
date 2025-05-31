import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';

const parser = new MarkdownIt();

export async function GET(context) {
	const posts = (await getCollection('blog')).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
	const rssContent = await rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		trailingSlash: false,
		items: posts.map((post) => ({
			...post.data,
			link: `/${post.id}`,
			content: sanitizeHtml(parser.render(post.body), {
				allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img'])
			}),
		})),
		customData: `<follow_challenge>
			<feedId>151531310966515712</feedId>
			<userId>41434914948866048</userId>
		</follow_challenge>`,
		stylesheet: '/pretty-feed-v3.xsl',
	});

	// 返回带有正确响应头的 Response
	return new Response(rssContent.body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'x-content-type-options': 'nosniff',
		},
	});
}
