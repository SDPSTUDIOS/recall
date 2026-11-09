# Recall

Turn your lecture PDFs into practice exams. Claude writes multiple choice, single choice, fill-in-the-blank, long answer and code questions from your material, then grades your answers with feedback.

It runs on your own computer and uses your **Claude Pro or Max subscription** through Claude Code. No API key, no extra billing, and your files never leave your machine except to be read by Claude.

[![Watch the Recall launch video on YouTube](https://img.youtube.com/vi/_3X7cHaQMOg/maxresdefault.jpg)](https://youtu.be/_3X7cHaQMOg)

▶️ [Watch the launch video](https://youtu.be/_3X7cHaQMOg)

| Take the exam | Get graded with feedback |
| --- | --- |
| ![Quiz view with a question navigator](docs/images/quiz.png) | ![Results with score breakdown and topics to review](docs/images/results.png) |
| **Choose what to generate** | **Claude marks written answers against a rubric** |
| ![New question set form](docs/images/generate.png) | ![Claude's feedback on a long answer, with covered and missed points](docs/images/feedback.png) |

## Features

- **Works for any subject:** maths, engineering, nursing, science, business, law, humanities or computing. Claude writes questions the way an examiner in that field would.
- **Five question types:** multiple choice, single choice, fill in the blanks, long answer, and artifact questions.
- **Artifact questions:** Claude shows you something to work with, chosen to suit the material: equations to solve or derive, a graph to read and interpret, a data table (lab results, patient observations, financial figures), a case study or clinical scenario, or code to explain, trace or debug.
- **Proper maths:** equations are typeset everywhere (questions, options, answers and feedback). Type maths on a keyboard (`x^2`, `sqrt(2)`, `3.2e-4`) and Claude accepts any equivalent form, with method marks for correct working.
- **Combine lectures:** build one exam from several PDFs. Claude spreads the questions across them and cites the document and page for each.
- **Exam or practice mode:** answer everything and submit, or check each answer as you go.
- **Focused quiz view:** one question at a time, with a question navigator, mark-for-review, a timer and keyboard shortcuts. A single-page view is also available.
- **Autosave:** unsubmitted answers are kept in your browser, so a refresh or closed tab doesn't lose work.
- **Grading and feedback:** objective questions are marked instantly. Written answers are marked by Claude against a rubric, with covered and missed points. Results show weak topics to review.
- **Any Claude model:** Sonnet, Opus, Fable, Haiku or a specific model ID, with adjustable effort.
- **Text or Visual reading:** Visual mode lets Claude look at the pages themselves, for scanned slides, diagrams, graphs and equations shown as images.
- **Viva practice:** paste a GitHub repository link (public or private) or upload a zip of your project, and Claude reads the code, then examines you on it in a text-based viva. It asks one question at a time, follows up on your answers and quotes your code. At the end you get a score and feedback for each topic. Progress is saved, so you can leave and come back, and you can retake a viva.
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
| Artifacts | Claude takes an artifact from the material, or creates one that applies what it teaches, and asks you to work with it. Equations are LaTeX rendered with KaTeX; graphs (line, scatter or bar) are drawn from data series, with hover values and a data table; tables, case studies and code are shown as they are. |
| Visual mode | The selected pages are split into PDFs of up to 10 pages each, and Claude reads them with its Read tool, so it also sees diagrams and scanned slides. |
| Grading | Multiple choice, single choice and fill-in-the-blank are graded instantly in code. Long answers and code answers are sent to Claude in one batch with the model answer and marking points. |
| Viva | A GitHub repository is shallow-cloned with `git` into a temporary folder; an uploaded zip (up to 100 MB) is unpacked there instead, skipping dependencies, build output and binaries, refusing any path that would land outside the folder, and capping total size against zip bombs. The zip is deleted once the viva is prepared. Claude explores it with read-only tools (Read, Glob, Grep) and plans the topics, each with an opening question, the relevant code and what a strong answer covers. The clone is deleted afterwards. Each examiner reply is streamed from that plan and the saved transcript. The planned questions stay on the server until the viva is assessed. Needs Git installed. For a private repository, Recall asks you to sign in to GitHub (or paste an access token). The token is used for that one download and is never saved: it's passed to Git in memory, and Git's credential helpers are switched off for the download. |
| Storage | Everything lives in a local SQLite database at `data/exam-helper.db`. |

## Configuration

Optional `.env.local`:

```bash
# Full path to the Claude Code executable if `claude` isn't on PATH
CLAUDE_BIN=C:\Users\you\.local\bin\claude.exe

# Client ID of a GitHub OAuth App, for "Sign in with GitHub" on private repositories (viva)
GITHUB_CLIENT_ID=Ov23li...
```

### Private repositories for vivas

Without any setup, a private repository asks for a GitHub access token. A [fine-grained token](https://github.com/settings/personal-access-tokens/new) with read-only **Contents** access to that repository and a short expiry is the safest choice.

For a **Sign in with GitHub** button instead, which shows a code to enter at github.com/login/device:

1. Create an OAuth App at [github.com/settings/developers](https://github.com/settings/developers). The homepage and callback URL can both be `http://localhost:3000`; the callback isn't used.
2. Tick **Enable Device Flow** in the app's settings.
3. Put its **Client ID** in `.env.local` as `GITHUB_CLIENT_ID` and restart Recall. No client secret is needed.

OAuth Apps can only get the `repo` scope for private repositories, which is broader than read-only. Recall uses the token once and doesn't keep it. To withdraw the authorisation entirely, revoke the app under GitHub's *Settings → Applications → Authorized OAuth Apps*. Organisation repositories may need the organisation to approve the app first.

`ANTHROPIC_API_KEY` is deliberately removed from the CLI's environment, so usage always goes to your subscription login and never to pay-per-use API billing.

## Notes

- Usage counts toward your Claude plan's limits. Haiku and Text mode use the least.
- This is a local, single-user app. It runs the CLI on the machine that hosts it, so don't deploy it publicly.
- If a generation fails, the raw output of the latest run is kept in `data/claude-workdir/last-generation.json`.
