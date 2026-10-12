# Recall

Turn your lecture PDFs into practice exams. Claude writes multiple choice, single choice, fill-in-the-blank, long answer and code questions from your material, then grades your answers with feedback.

It runs on your own computer and uses your **Claude Pro or Max subscription** through Claude Code. No API key, no extra billing, and your files never leave your machine except to be read by Claude.

## Features

- **Five question types:** multiple choice, single choice, fill in the blanks, long answer, and code/artifact questions (explain, trace or debug a snippet from the lecture).
- **Combine lectures:** build one exam from several PDFs. Claude spreads the questions across them and cites the document and page for each.
- **Exam or practice mode:** answer everything and submit, or check each answer as you go.
- **Focused quiz view:** one question at a time, with a question navigator, mark-for-review, a timer and keyboard shortcuts. A single-page view is also available.
- **Autosave:** unsubmitted answers are kept in your browser, so a refresh or closed tab doesn't lose work.
- **Grading and feedback:** objective questions are marked instantly. Written answers are marked by Claude against a rubric, with covered and missed points. Results show weak topics to review.
- **Any Claude model:** Sonnet, Opus, Fable, Haiku or a specific model ID, with adjustable effort.
- **Text or Visual reading:** Visual mode lets Claude look at the pages themselves, for scanned slides, diagrams and screenshots of code.
- Light and dark themes, renameable materials and sets, and attempt history with score trends.

## Quick start

You need [Node.js](https://nodejs.org) 22 or newer and [Claude Code](https://claude.com/claude-code).

```bash
# 1. Install Claude Code and sign in with your Claude account
npm install -g @anthropic-ai/claude-code
claude auth login

# 2. Install and run Recall
npm install
npm run dev
```

Open http://localhost:3000. The first time, a welcome page checks that Claude Code is installed and signed in, and shows how to fix anything missing. It only appears once; to see it again, delete `data/onboarded.json`. Setup help is always at `/setup`.

There is no Recall account or sign-in. It's open source and runs entirely on your computer.

## Keyboard shortcuts (quiz view)

| Key | Action |
| --- | --- |
| `←` `→` | Previous / next question |
| `A`–`F` | Choose an option |
| `M` | Mark for review |
| `Enter` | Check answer (practice mode) |

## How it works

| Step | What happens |
| --- | --- |
| Upload | The PDF is saved to `data/uploads/` and its text is extracted per page (`unpdf`). |
| Generate | `claude -p --model <model> --json-schema …` runs in the background. The lecture text goes in on stdin, and the questions come back as schema-validated JSON. Answer options are shuffled so the correct answer isn't always first. |
| Combined sets | **New set** (`/generate`) builds one exam from several PDFs, with all selected by default. |
| Code & artifacts | Optional question type (off by default). Claude shows a code snippet, query, algorithm, config or formula from the material, or writes one that applies what it teaches, and asks you to explain, trace or debug it. |
| Visual mode | The selected pages are split into PDFs of up to 10 pages each, and Claude reads them with its Read tool, so it also sees diagrams and scanned slides. |
| Grading | Multiple choice, single choice and fill-in-the-blank are graded instantly in code. Long answers and code answers are sent to Claude in one batch with the model answer and marking points. |
| Storage | Everything lives in a local SQLite database at `data/exam-helper.db`. |

## Configuration

Optional `.env.local`:

```bash
# Full path to the Claude Code executable if `claude` isn't on PATH
CLAUDE_BIN=C:\Users\you\.local\bin\claude.exe
```

`ANTHROPIC_API_KEY` is deliberately removed from the CLI's environment, so usage always goes to your subscription login and never to pay-per-use API billing.

## Notes

- Usage counts toward your Claude plan's limits. Haiku and Text mode use the least.
- This is a local, single-user app. It runs the CLI on the machine that hosts it, so don't deploy it publicly.
- If a generation fails, the raw output of the latest run is kept in `data/claude-workdir/last-generation.json`.
