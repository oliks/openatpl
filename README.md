<p align="center">
  <img src="public/logo.png" alt="OpenATPL" width="200" />
</p>

<h1 align="center">OpenATPL</h1>

<p align="center">
  <img src="https://img.shields.io/badge/EASA-ATPL-0f7a69?style=for-the-badge" alt="EASA ATPL" />
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/oliks/openatpl/ci.yml?label=CI&style=flat-square" alt="CI" />
  <img src="https://img.shields.io/github/last-commit/oliks/openatpl?style=flat-square" alt="Last Commit" />
  <img src="https://img.shields.io/github/issues-pr/oliks/openatpl?style=flat-square" alt="PRs" />
  <img src="https://img.shields.io/github/contributors/oliks/openatpl?style=flat-square" alt="Contributors" />
</p>

An open-source EASA ATPL question bank and practice platform. No accounts, no subscriptions, no fees — just questions. All progress is saved locally in your browser.

## Features

- **Subject-based question bank** covering EASA 2020 ECQB subjects
- **Test creation** with subject selection and question count slider
- **Interactive test runner** with instant answer feedback
- **Keyboard shortcuts** — arrow keys to navigate, A–D to answer, F to flag
- **Question flagging** — mark questions for review (persists across sessions)
- **Personal notes** — add notes per question (500 char limit)
- **Progress tracking** — elapsed time, correct/incorrect rate, completion status
- **Finish test** — explicit finish action with pass/fail result (75% threshold)
- **Dark mode** — toggle in the header, respects system preference
- **Attachment previews** — question images displayed inline
- **Fully client-side** — no backend required

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/oliks/openatpl.git
cd openatpl
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Question Bank Structure

The platform is manifest-driven. All question data lives in `data/tests/`.

```
data/tests/
  manifest.json              # Registry of all subjects
  010/
    index.json               # Subject metadata + question list
    questions/
      0001.json              # Individual question file
      0002.json
      ...
public/attachments/
  010/
    010-att-0001.jpg          # Attachment images ({subjectCode}-att-{number})
```

### manifest.json

An array of subject entries:

```json
[
  {
    "id": "032",
    "name": "032 - Performance",
    "subject": "Performance",
    "description": "ATPL subject bank.",
    "sourceFile": "data/tests/032/index.json"
  }
]
```

| Field | Description |
|-------|-------------|
| `id` | Unique subject code (e.g. `"032"`) |
| `name` | Display name shown in the UI |
| `subject` | Subject category |
| `description` | Short description |
| `sourceFile` | Path to the subject's `index.json` |

### Subject index.json

Each subject has an `index.json` that lists all questions:

```json
{
  "subjectCode": "032",
  "subjectName": "Performance",
  "questionCount": 1356,
  "questions": [
    {
      "number": 1,
      "file": "questions/0001.json",
      "questionId": "032-0001",
      "questionNumber": "032-0001",
      "correctOption": "a"
    }
  ]
}
```

### Question format

Each question is a standalone JSON file:

```json
{
  "number": 1,
  "questionId": "032-0001",
  "questionNumber": "032-0001",
  "stemHtml": "<p>What is the minimum TOD?</p>",
  "options": {
    "a": "<p>2860 ft</p>",
    "b": "<p>3300 ft</p>",
    "c": "<p>3220 ft</p>",
    "d": "<p>2200 ft</p>"
  },
  "correctOption": "a",
  "attachments": [
    {
      "uniqueKey": "032-att-0001",
      "publicUrl": "/attachments/032/032-att-0001.jpg"
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `number` | Yes | Sequential number within the subject |
| `questionId` | Yes | Unique identifier in format `{subjectCode}-{number}` (e.g. `"032-0001"`) |
| `questionNumber` | Yes | Same as `questionId` |
| `stemHtml` | Yes | Question text (HTML) |
| `options` | Yes | Answer choices keyed `a` through `f` (HTML) |
| `correctOption` | Yes | Letter of the correct answer or `null` if unknown |
| `attachments` | No | Array of image attachments |

### Attachment format

| Field | Description |
|-------|-------------|
| `uniqueKey` | Attachment identifier (e.g. `032-att-0001`) |
| `publicUrl` | Path relative to `public/` (e.g. `/attachments/032/032-att-0001.jpg`) |

Place image files in `public/attachments/<subjectCode>/`.

## Contributing

Contributions are welcome! Whether you're adding new subjects, fixing incorrect answers, or improving the platform — here's how.

### Fork & Clone

```bash
# 1. Fork this repo on GitHub (click the Fork button)

# 2. Clone your fork
git clone https://github.com/<your-username>/openatpl.git
cd openatpl

# 3. Add upstream remote
git remote add upstream https://github.com/oliks/openatpl.git
```

### Adding a New Subject

1. Create the folder structure:
   ```
   data/tests/<subjectCode>/
     index.json
     questions/
       0001.json
       0002.json
       ...
   ```

2. Add an entry to `data/tests/manifest.json`:
   ```json
   {
     "id": "<subjectCode>",
     "name": "<subjectCode> - <Subject Name>",
     "subject": "<Subject Name>",
     "description": "ATPL subject bank.",
     "sourceFile": "data/tests/<subjectCode>/index.json"
   }
   ```

3. Create `index.json` listing all questions with `number`, `file`, `questionId`, `questionNumber`, and `correctOption`.

4. Create individual question JSON files following the format above.

5. If questions have image attachments, place them in `public/attachments/<subjectCode>/` and reference them in the question's `attachments` array.

### Adding Questions to an Existing Subject

1. Add the question JSON file to `data/tests/<subjectCode>/questions/` with the next sequential number (e.g. `0457.json`).

2. Add a corresponding entry to the subject's `index.json` `questions` array.

3. Update the `questionCount` in `index.json`.

### Submitting a Pull Request

```bash
# 1. Create a feature branch
git checkout -b add-<subjectCode>-questions

# 2. Add your files
git add data/tests/<subjectCode>/ data/tests/manifest.json
git add public/attachments/<subjectCode>/  # if adding images

# 3. Commit
git commit -m "Add questions for <Subject Name>"

# 4. Push to your fork
git push origin add-<subjectCode>-questions

# 5. Open a Pull Request on GitHub against main
```

### PR Checks

Every pull request runs automated checks:

| Check | What it does |
|-------|-------------|
| **Lint** | Runs `next lint` to catch code issues |
| **Build** | Ensures the project builds successfully |
| **Validate Question Bank** | Verifies manifest structure, checks that all referenced `index.json` and question files exist |

All checks must pass before a PR can be merged. If the validate step fails, check that:
- Your manifest entry has `id`, `name`, and `sourceFile`
- The `sourceFile` path points to a valid `index.json`
- All questions listed in `index.json` have corresponding files in the `questions/` folder

### Guidelines

- Follow the existing JSON format exactly — the validator will catch structural issues
- Use sequential numbering for question files (`0001.json`, `0002.json`, ...)
- Keep `correctOption` accurate — set to `null` if unsure rather than guessing
- Crop any watermarks from attachment images before submitting
- One subject per PR keeps reviews manageable

## Project Structure

```
app/                           # Next.js App Router pages
  layout.jsx                   # Root layout (header, footer, theme)
  page.jsx                     # Home (saved tests list)
  create-test/page.jsx         # Test creation form
  tests/[testId]/run/page.jsx  # Test runner
  globals.css                  # All styles (CSS variables, dark mode)
components/
  MyTestsList.jsx              # Saved tests grid
  CreateTestForm.jsx           # Subject + question count form
  TestRunner.jsx               # Interactive quiz engine
  ThemeToggle.jsx              # Dark/light mode toggle
lib/
  test-bank.js                 # Server-side test data loader
  saved-tests-client.js        # Client-side localStorage management
  derive-test-client.js        # Question filtering for derived tests
data/tests/                    # Question bank data
public/attachments/            # Question images
.github/workflows/ci.yml       # PR checks (lint, build, validate)
```

## Disclaimer

Questions in this repository are contributed by the community based on publicly available EASA ATPL study material. OpenATPL is not affiliated with, endorsed by, or connected to EASA, any national aviation authority, or any commercial question bank provider.

This project is intended solely as a free study aid for student pilots. The questions are reconstructed from memory by exam candidates and may not reflect the exact wording or content of any official examination.

### Content Removal (DMCA / Takedown)

If you believe any content in this repository infringes on your intellectual property rights, please open a [GitHub issue](https://github.com/oliks/openatpl/issues) or contact us [directly](mailto:oliver@skupinainovace.com). We take all claims seriously and will promptly review and remove any content that is found to be infringing.

Please include in your request:
- Identification of the copyrighted work you believe is being infringed
- The specific files or content you want removed
- Your contact information
- A statement that you have a good faith belief that the use is not authorised

We aim to respond to all valid requests within 48 hours.

## Support the Project

OpenATPL is free and open source. If you find it useful, consider supporting development — it helps cover hosting, domains, and ongoing maintenance.

<p align="center">
  <a href="https://buy.stripe.com/28E4gz6nY2XtgRIdAgfEk0Q">
    <img src="https://img.shields.io/badge/Donate-Support%20OpenATPL-0f7a69?style=for-the-badge&logo=stripe&logoColor=white" alt="Donate" />
  </a>
</p>

## License

OpenATPL is open source. No warranties or liabilities are provided. Use at your own risk.
