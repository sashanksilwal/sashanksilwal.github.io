# Portfolio

### This is my portfolio. Please check it out by going to this [link](https://ssilwal.com.np/index.html)

## Adding a blog post

1. Write the markdown in `blog/posts/<slug>.md`.
2. Add an entry to `blog/posts.json` (`slug`, `title`, `date`, `description`,
   `tags`, `category`, `readingTime`, and optionally `image` + `imageAlt` for
   the social preview card).
3. Run `npm run build:blog`.

Step 3 generates `blog/<slug>.html`, a real page carrying the title,
description, canonical, Open Graph tags, JSON-LD and the article text in the
markup, so posts are readable by search engines and social scrapers without
running JavaScript. It also regenerates `sitemap.xml` and `feed.xml` from
`posts.json`, so they can't drift out of sync. Skipping it means the post has
no page and appears in neither.
