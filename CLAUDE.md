# Project Overview

This is Sashank's personal website. It serves as a portfolio, professional presence, and blog. The site has three main sections:

- **Home** — Landing page with intro, featured work, and navigation to everything else.
- **Experiences** — Work history, research, education, and notable projects.
- **Blog** — Long-form writing across three categories (see below).

The site should feel personal, opinionated, and human. It is not a corporate site. It is not a template. It's a place where someone shares what they know and what they're working on.

## Blog Categories

The blog has three distinct categories. Each one targets a different reader and has a different voice.

### 1. Technical Deep Dives

- **Audience:** Practitioners, researchers, senior engineers, ML folks.
- **Tone:** Direct, assumes background knowledge, gets to the point fast. Think "here's what I found, here's why it matters, here's what tripped me up." Don't over-explain fundamentals. Use code snippets, diagrams, and math where they help. Skip them where they don't.
- **Topics:** ML research breakdowns, systems engineering war stories, algorithm deep dives, paper reviews, debugging sagas, performance optimization, infrastructure decisions.
- **Slug prefix:** `/blog/technical/`

### 2. General Audience

- **Audience:** Curious people who are not necessarily technical. Could be a friend, a recruiter, someone from a different field.
- **Tone:** Conversational, approachable, uses analogies to ground abstract ideas. Avoid jargon or define it immediately when you use it. Write like you're explaining something cool to a smart friend over coffee.
- **Topics:** What it's like doing CS research, the experience of grad school, thoughts on tech trends that affect everyone, travel/life updates, takes on industry news, career reflections.
- **Slug prefix:** `/blog/general/`

### 3. Beginner Tech

- **Audience:** Early CS students, bootcamp grads, people switching into tech, undergrads trying to figure things out.
- **Tone:** Encouraging but not condescending. Honest about what's hard. Practical above all else. "Here's what I wish someone told me" energy. Use real examples from your own experience when possible.
- **Topics:** How to approach your first research experience, making sense of ML buzzwords, study strategies for algorithms courses, how to actually read a paper, building projects that matter, navigating internship recruiting, tools and workflows that helped you.
- **Slug prefix:** `/blog/beginner/`

## Writing Style Rules

These apply to ALL content on the site, especially blog posts. Follow these strictly.

### Voice

- Write in first person. This is your site.
- Sound like a real person. Not a press release, not a LinkedIn post, not a ChatGPT output.
- Have opinions. Take stances. Say "I think" and "I disagree" and "honestly I have no idea."
- It's fine to be informal. Contractions are good. Starting sentences with "And" or "But" is fine.
- Vary sentence length. Short sentences hit harder. Longer ones let you build up an idea before landing it.

### Things to Avoid (AI-isms)

Do NOT use any of the following. These are dead giveaways of AI-generated text:

- Em dashes. Use commas, periods, or parentheses instead.
- "Dive into" or "deep dive" in intros (the category name is fine).
- "In this article, we will explore..."
- "Let's unpack..."
- "It's worth noting that..."
- "At the end of the day..."
- "In today's fast-paced world..."
- "Straightforward" or "straightforwardly"
- "Leverage" as a verb (say "use")
- "Robust" (say what you actually mean)
- "Utilize" (say "use")
- "Delve" or "delve into"
- "Landscape" when talking about a field or industry
- "Tapestry" or "rich tapestry"
- "Navigate" when used metaphorically about careers or challenges
- "Realm"
- "Crucial" or "critical" when "important" works fine
- "Embark on a journey"
- "Facilitate"
- "Harness the power of"
- Bullet-point-heavy posts that read like documentation instead of writing
- Overly enthusiastic exclamation marks in technical content
- Starting multiple paragraphs with "I" in a row. Mix it up.

### Things to Do

- Open posts with something specific. A moment, a problem, a question, a strong claim.
- Use concrete examples over abstract generalizations.
- When referencing your own projects or research, link to the relevant page on your site (cross-link).
- End posts with something worth remembering, not a generic "thanks for reading!"
- Use subheadings to break up long posts, but don't overdo it.
- Include a short meta description (1-2 sentences) for every post. Write it like a hook, not a summary.

## SEO Guidelines

### On-Page SEO

- Every page needs a unique `<title>` tag. Format: `{Page Title} | Sashank's Site`.
- Every page needs a unique `<meta name="description">` between 120-160 characters. Write it for humans first, search engines second.
- Use one `<h1>` per page. Blog post title = h1. Section headings = h2. Sub-sections = h3. Don't skip levels.
- Images need descriptive alt text. Not keyword-stuffed, just accurate.
- Use semantic HTML: `<article>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, `<time>`.
- Blog post URLs should be clean and readable.
- Add `<time datetime="YYYY-MM-DD">` to every blog post with the publish date.
- Add structured data (JSON-LD) for blog posts: BlogPosting schema with author, datePublished, description, headline.

### Cross-Linking Strategy

- **Blog to Experiences:** When a blog post mentions a project, role, or research topic on the Experiences page, link to it.
- **Blog to Blog:** Link between posts when they're related.
- **Experiences to Blog:** If there are blog posts that expand on an experience entry, link from the experience to the post.
- **Home to Everything:** The home page should surface recent or featured blog posts from each category, and link to the Experiences page.
- Use descriptive anchor text. "Read my post on debugging HDF5 library conflicts in Docker" is better than "I wrote about this."
- Don't force links where they don't make sense.

### Technical SEO

- Site should have a `sitemap.xml` that includes all pages and blog posts.
- Add a `robots.txt` that allows crawling of all public content.
- Use canonical URLs on every page.
- Mobile-responsive. Test at 375px width minimum.
- Optimize images (WebP where possible, lazy loading for below-fold images).
- Use proper Open Graph tags (`og:title`, `og:description`, `og:image`, `og:type`).
- Add Twitter Card meta tags too.
- If using client-side rendering, make sure pages are SSR or SSG for crawlability.

## Blog Post Front Matter

Every blog post should include front matter with at minimum:

```yaml
title: "Post title here"
slug: "url-friendly-slug"
date: "YYYY-MM-DD"
category: "technical" | "general" | "beginner"
description: "120-160 char meta description written as a hook."
tags: ["relevant", "tags", "here"]
featured: false
draft: false
```

Tags should be lowercase, hyphenated for multi-word (`machine-learning`, not `Machine Learning`). Reuse existing tags before creating new ones. Keep total unique tags under 30.

## Page-Specific Notes

### Home Page

- Should immediately communicate who Sashank is and what they do.
- Show 2-3 recent or featured blog posts, ideally one from each category.
- Link to Experiences page.
- Keep it scannable. Someone should get the gist in under 10 seconds.

### Experiences Page

- Organize by type (Research, Industry, Education) or chronologically.
- Each entry should be concise but specific. What you did, what tools/methods you used, what the outcome was.
- Link out to blog posts, papers, repos, or demos where available.
- Don't just list job titles. Explain what you actually worked on.

### Blog Index / Category Pages

- Each category should have its own index page.
- Main `/blog/` page shows recent posts across all categories with visible category labels.
- Posts should show: title, date, category tag, description, estimated reading time.
- Include pagination or infinite scroll for when post count grows.

## General Dev Notes

- Keep components modular. Blog post rendering, SEO meta injection, and navigation should all be reusable.
- If adding analytics, use something privacy-respecting (Plausible, Umami, or Fathom over Google Analytics).
- RSS feed at `/feed.xml` or `/rss.xml` covering all blog posts. Optionally, per-category feeds.
- 404 page should be helpful, not just "page not found." Link back to home and blog.
- Accessibility: proper heading hierarchy, sufficient color contrast, keyboard navigation, focus indicators.
- Dark mode support: respect `prefers-color-scheme` and let users toggle.
