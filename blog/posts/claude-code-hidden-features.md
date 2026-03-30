Boris Cherny, who works on Claude Code at Anthropic, posted a thread on X last week with 15 features that most people don't know about. I've been using Claude Code daily for months now (wrote about the [basics](/blog/post.html?post=claude-code-basics) and [intermediate workflows](/blog/post.html?post=claude-code-intermediate) earlier), and half of these were new to me. Some of them genuinely change how you'd use the tool.

Here's every tip from his thread, with my notes on each.

## 1. Claude Code Has a Mobile App

You can write code from your phone. Open the Claude app on iOS or Android, tap the Code tab on the left. That's it. Boris says he writes a lot of his code from the iOS app. I haven't gone that far, but for quick fixes or reviewing what Claude did while you're away from your desk, it's surprisingly useful.

## 2. Move Sessions Between Devices

This one blew my mind. You can start a session on your phone, then pick it up on your laptop, or the other way around.

- `claude --teleport` or `/teleport` continues a cloud session on your local machine
- `/remote-control` lets you control a locally running session from your phone or browser

Boris has "Enable Remote Control for all sessions" turned on in his `/config`. The implication: you can kick off a big task on your desktop, leave the house, and monitor or steer it from your phone.

## 3. /loop and /schedule for Automated Workflows

These two might be the most powerful features in the list. They let Claude run automatically on a schedule, for up to a week at a time.

Boris has a bunch of loops running locally:

- `/loop 5m /babysit` to auto-address code review, auto-rebase, and shepherd PRs to production
- `/loop 30m /slack-feedback` to automatically put up PRs for Slack feedback every 30 minutes
- `/loop /post-merge-sweeper` to put up PRs addressing code review comments he missed
- `/loop 1h /pr-pruner` to close out stale and no longer necessary PRs

The pattern is: turn a workflow into a custom skill, then loop it. Claude becomes a background process that handles the tedious parts of your development cycle while you focus on the actual engineering.

## 4. Hooks for Deterministic Logic in the Agent Lifecycle

Hooks let you run your own code at specific points in Claude's lifecycle. This is different from skills or prompts. Hooks are deterministic, they run every time, no matter what.

Some examples:

- **SessionStart**: dynamically load context every time you start Claude
- **PreToolUse**: log every bash command the model runs
- **PermissionRequest**: route permission prompts to WhatsApp for you to approve or deny remotely
- **Stop**: poke Claude to keep going whenever it stops

That permission routing one is wild. You could have Claude working autonomously and just approve or deny actions from your phone via WhatsApp.

Docs: [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)

## 5. Dispatch for Non-Coding Tasks

Dispatch is a secure remote control for the Claude Desktop app. Boris uses it daily to catch up on Slack and emails, manage files, and do things on his laptop when he's not at a computer. It can use your MCPs, browser, and computer, with your permission.

Think of it as: Claude Code is for your codebase, Dispatch is for everything else on your machine.

## 6. Chrome Extension for Frontend Work

Boris's tip here is more of a principle: give Claude a way to verify its output. For frontend work, the Chrome extension lets Claude see what it built in the browser. Without it, Claude is coding blind, writing HTML and CSS without being able to see the result.

With the extension, Claude can iterate on the visual output the same way a human developer would. Write code, check the browser, adjust, repeat. The quality difference is significant.

Docs: [code.claude.com/docs/en/browser-tool](https://code.claude.com/docs/en/browser-tool)

## 7. Desktop App Auto-Starts and Tests Web Servers

Along the same lines, the Desktop app can automatically run your web server and test it in a built-in browser. No manual setup, no switching between terminal and browser. Claude starts the server, opens it, checks the result, and iterates.

You can set up something similar in CLI or VS Code with MCP tools, but the Desktop app bundles it in natively.

## 8. Fork Your Session

Sometimes you're mid-conversation and want to try a different approach without losing your current context. Two ways to fork:

1. Run `/branch` from your session
2. From the CLI: `claude --resume <session-id> --fork-session`

Both create a copy of the conversation up to that point. You can take the fork in a completely different direction without affecting the original. Useful for "what if" experiments.

## 9. /btw for Side Queries

While Claude is working on a task (editing files, running commands), you can ask it a quick side question with `/btw`. It won't interrupt the current work. Boris says he uses this all the time.

Practical example: Claude is refactoring a file and you suddenly wonder "wait, what does that util function do?" Type `/btw what does formatTimestamp do?` and get an answer without derailing the refactor.

## 10. Git Worktrees for Parallel Agents

This is how Boris runs dozens of Claudes simultaneously on the same repository. Git worktrees create separate working directories that share the same git history. Each Claude instance gets its own worktree so they don't step on each other's files.

Start a new session in a worktree with `claude -w`. Claude Code has deep support for this built in, it handles the worktree creation, branch management, and cleanup.

If you're only running one Claude at a time, you don't need this. If you want to parallelize (fix bug A in one session while building feature B in another), worktrees are the way.

## 11. /batch for Massive Changesets

`/batch` interviews you about what you want to do, then fans out the work to as many worktree agents as needed. Dozens, hundreds, even thousands.

The use case: large code migrations. Rename a function across 500 files. Update an API call everywhere. Convert a codebase from one framework to another. Instead of doing it sequentially, `/batch` parallelizes it across many agents.

## 12. --bare for Faster SDK Startup

By default, `claude -p` (and the TypeScript/Python SDKs) searches for local CLAUDE.md files, settings, and MCPs. That takes time.

For non-interactive usage (scripts, CI pipelines, automation), you usually want to explicitly specify what to load. The `--bare` flag skips the search and can speed up startup by up to 10x.

If you're building tools on top of Claude Code's SDK and noticing slow startup times, this is probably the fix.

## 13. --add-dir for Multi-Repo Access

When working across multiple repositories, start Claude in one repo and use `--add-dir` (or `/add-dir` during a session) to let Claude see the other repo. This not only tells Claude about the other codebase but also gives it permissions to read and edit files there.

I can see this being useful for monorepo-adjacent setups, or when your frontend and backend live in separate repos but you need to make coordinated changes.

## 14. --agent for Custom System Prompts and Tools

Custom agents let you define a specific system prompt and tool configuration for a particular workflow.

Define a new agent in `.claude/agents/`, then run `claude --agent=<your agent's name>`. The agent gets its own instructions, available tools, and behavior. Think of it as creating specialized personas: a code reviewer agent, a documentation writer agent, a migration agent.

Docs: [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents)

## 15. /voice for Voice Input

Boris says he does most of his coding by speaking to Claude rather than typing. Run `/voice` in CLI, then hold the space bar to talk. On Desktop, press the voice button. On iOS, enable dictation in your settings.

I haven't tried this for serious coding yet, but for describing what you want ("refactor this function to use async/await and add error handling for the API call"), speaking is faster than typing a detailed prompt.

---

The features I'm most excited to try are `/loop` with custom skills (tip 3) and worktree-based parallel agents (tip 10). The combination of those two basically turns Claude Code into a fleet of autonomous developers you can orchestrate from your phone.

Boris mentioned he'd post more soon. I'll update this post or write a follow-up when he does.
