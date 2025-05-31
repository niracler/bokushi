import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';

const parser = new MarkdownIt();

export async function GET(context) {
	const posts = await getCollection('blog');
	const rssResponse = rss({
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
			<feedId>52340201851637799</feedId>
			<userId>41434914948866048</userId>
		</follow_challenge>`,
		stylesheet: '/pretty-feed-v3.xsl',
	});

	// 设置正确的响应头以避免下载问题
	rssResponse.headers.set('Content-Type', 'application/xml; charset=utf-8');
	rssResponse.headers.set('X-Content-Type-Options', 'nosniff');
	
	return rssResponse;
}
