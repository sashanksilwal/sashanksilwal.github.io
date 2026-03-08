Summer Yue is the director of alignment at Meta's Superintelligence Labs. Her LinkedIn says she's "passionate about ensuring powerful AIs are aligned with human values." In February, she let an OpenClaw AI agent loose on her real email inbox. It started speedrun-deleting everything. She frantically typed "STOP OPENCLAW" from her phone. It kept going. She had to physically run to her Mac Mini and yank the connection to stop it. When someone asked if she was testing the agent's guardrails on purpose, she replied: "Rookie mistake tbh."

If Meta's head of AI safety can get burned by an autonomous agent, the rest of us probably need a game plan. Claude Code is one of these agentic tools, and it operates directly on your codebase. Here's everything I wish someone had told me on day one.

## It's Not a Chatbot

First, let's get this out of the way. Claude Code is not ChatGPT in your terminal. It's an agentic coding tool. That means it can read your files, edit them, run shell commands, install packages, create directories, and execute tests. It operates directly on your codebase. When you ask it to refactor a function, it actually opens the file and changes the code. When you ask it to fix a failing test, it runs the test, reads the error, and modifies your source until the test passes.

This distinction matters because it changes how you interact with it. You're not asking for code snippets to copy-paste. You're directing an agent that has real access to your project. That's powerful, and it means you need to be thoughtful about what you ask for.

## Starting Your First Session

Open your terminal, navigate to your project directory, and type `claude`. That's it. Claude Code launches and immediately starts building an understanding of your project structure.

Here's the thing that tripped me up early on: **specificity is everything**. Compare these two prompts:

Bad: "Fix the authentication."

Good: "The login endpoint in `src/api/auth.ts` returns a 500 error when the user's email contains a plus sign. The validation regex on line 42 is probably too strict. Fix it and make sure the existing tests in `tests/auth.test.ts` still pass."

The second prompt gives Claude Code exactly what it needs: the file, the problem, a hypothesis, and a way to verify the fix. The first prompt forces it to guess what you mean, and guessing wastes your context window (more on that in a minute).

As the Anthropic team recommends, treat your prompts like instructions to a capable junior developer. You wouldn't tell a new hire to "fix the authentication" without any context. Give Claude Code the same courtesy.

## CLAUDE.md: Your Project's Instruction Manual

Every time Claude Code starts a session, it looks for a file called `CLAUDE.md` in your project root. Think of it as onboarding documentation for a new team member. If it exists, Claude reads it automatically and uses it to understand your project.

What should you put in it? The HumanLayer blog post on Claude Code recommends a WHY/WHAT/HOW framework, and I think that's exactly right:

- **WHY**: What does this project do? What problem does it solve? A sentence or two is enough.
- **WHAT**: Tech stack, project structure, key directories, important files. Where does the business logic live? Where are the tests?
- **HOW**: Build commands, test commands, lint commands, deployment steps. How do you run this thing locally?

Here's a rough example:

```markdown
## Why
Personal finance tracker that syncs with bank APIs.

## What
- Next.js 14 with App Router
- PostgreSQL via Prisma ORM
- Key dirs: src/app (routes), src/lib (business logic), src/components (UI)

## How
- Install: npm install
- Dev server: npm run dev
- Tests: npm run test (uses Vitest)
- Lint: npm run lint
- DB migrations: npx prisma migrate dev
```

Keep it under 200 lines. If your CLAUDE.md is longer than that, you're probably including things Claude can figure out on its own by reading your code. Focus on the stuff that isn't obvious from the codebase itself.

## Context Window Management (This Is the Big One)

If you only remember one concept from this post, make it this.

Claude Code has a context window of roughly 200,000 tokens. That sounds like a lot. It isn't. Every file Claude reads, every command it runs, every output it receives, all of it fills up that window. You can check where you stand anytime with the `/context` command, which shows a breakdown like "Messages: 39.7k tokens (19.8%), Free space: 113k (56.7%)." Once that free space shrinks, Claude starts losing track of earlier information. Your carefully crafted instructions from the beginning of the session? Gone. The file structure it analyzed twenty minutes ago? Fading.

This is why the `/clear` command exists. Use it aggressively. Finished a task? `/clear`. Moving on to a different part of the codebase? `/clear`. Notice Claude starting to repeat itself or forget earlier decisions? Definitely `/clear`.

Think of each task as a fresh conversation. As the Anthropic best practices guide puts it, you want to keep your context focused on the current task. Don't let residue from previous work pollute your current session.

A practical rule I follow: one task, one context. If I'm fixing a bug and then want to add a feature, I clear between them. It takes two seconds and saves you from confusing, context-muddled responses.

## Commands You'll Use Every Day

Claude Code has a handful of built-in commands that you should know from the start:

- **`/init`**: Generates a CLAUDE.md for your project by analyzing your codebase. If you don't have one yet, start here. It won't be perfect but it gives you a solid starting point to edit.
- **`/clear`**: Wipes the conversation context. Start fresh without restarting the session. Use it between tasks.
- **`/compact`**: Compresses the current conversation into a shorter summary, freeing up context space. Useful when you're mid-task but running low on context.
- **`/context`**: Shows your current token usage broken down by category. Check it often.
- **`/cost`**: Shows how much you've spent in the current session. Good habit to check periodically so you don't get surprised on your bill.
- **`/rewind`**: Goes back to a previous point in the conversation. More powerful than Esc Esc because you can roll back multiple steps, not just the last one.
- **`/help`**: Shows all available commands. Run it once so you know what's there.
- **Shift+Tab**: Toggles between "plan mode" and "code mode." Plan mode lets Claude think and outline an approach without making any changes. Code mode lets it actually edit files and run commands. I start almost every complex task in plan mode, review the plan, then switch to code mode.
- **Esc Esc** (double-press Escape): Undoes the last action Claude took. Made an edit you don't like? Hit Escape twice. It's your safety net.
- **Ctrl+C**: Cancels the current generation mid-stream. If Claude is going in the wrong direction, don't wait for it to finish. Kill it and redirect.
- **`@` mentions**: Type `@` in your prompt to autocomplete file paths. Way faster than typing out full paths, and it ensures Claude reads the exact file you mean.
- **`!` prefix**: Type `!` at the start of your message to run a bash command directly. For example, `! npm test` runs your tests without leaving the Claude Code session.

Shrivu Shankar's breakdown of Claude Code features highlights that the plan-then-execute workflow is one of the most underused patterns. I agree completely. Letting Claude draft a plan before it starts changing files catches bad approaches before they become bad code.

## The Feedback Loop: Let Claude Check Its Own Work

Claude Code works best when it can verify what it just did. This is probably the single biggest difference between people who get great results and people who get frustrated.

Here's the pattern:

1. Ask Claude to write or modify code
2. Have it run the tests (or lint, or build, or whatever verification step makes sense)
3. If something fails, Claude sees the error output and fixes it
4. Repeat until green

The key insight is that you should include the verification step in your prompt. Don't just say "write a function that parses CSV files." Say "write a function that parses CSV files, then run `npm test` to make sure it passes the existing test suite." That way Claude doesn't stop at writing code. It closes the loop.

If your project doesn't have tests, you can still create feedback loops. Ask Claude to write the code and then run it with sample input. Ask it to add a quick sanity check. Anything that produces output Claude can evaluate. The goal is to move from "write and hope" to "write and verify."

## Commit Often

This one is simple but people (including me) forget it constantly.

When you're working with Claude Code, commit your changes frequently. At least once per hour, more often if you're making substantial changes. Here's why: if Claude goes down a wrong path and makes a dozen file changes before you notice, you want a recent commit to roll back to. Without one, you're left doing `git diff` archaeology trying to figure out what was intentional and what was a mistake.

My workflow looks like this:

1. Start a task
2. Claude makes changes
3. I review the changes (`git diff`)
4. If they look good, I commit
5. Move to the next task

Don't let Claude accumulate a mountain of uncommitted changes. Small, frequent commits give you checkpoints. They're your undo button at a much larger scale than Esc Esc.

## The Mental Model That Helped Me Most

After a few weeks of daily use, I realized the best way to think about Claude Code is as a very fast, very knowledgeable pair programmer who has amnesia. It can do incredible work within a focused session. It can see patterns you miss, write boilerplate in seconds, and debug errors faster than you can read the stack trace. But it forgets everything between contexts, and it will do exactly what you tell it to do, even if what you told it was wrong.

Your job is to be the one with memory and judgment. Set the direction. Be specific. Clear the context when it gets stale. Commit your work. And always, always have a way to verify the output.

That deleted directory I mentioned at the start? I got everything back because I had committed ten minutes earlier. Lesson learned, lesson applied, and now it's yours too.

If you're already comfortable with the basics and want to go further, I wrote a follow-up on [agents, context engineering, and advanced workflows](/blog/post.html?post=claude-code-intermediate).
