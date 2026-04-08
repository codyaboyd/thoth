# Thoth: AI-Powered Documentation Generator

Thoth is a Node.js CLI that uses a local AI model service to generate Markdown documentation from source code.

It supports:
- JavaScript (`.js`)
- TypeScript (`.ts`)
- Python (`.py`)
- Rust (`.rs`)
- Solidity (`.sol`)

<p align="center">
  <img src="https://github.com/codyaboyd/thoth/assets/57097960/244566cc-5a68-4bf1-8e5a-9c4c3854ee51" alt="Thoth demo" />
</p>

## What it does

- Generates docs for a **single file** (prints Markdown to stdout).
- Generates docs for an **entire directory** (writes `.md` files under a `docs/` folder).
- Runs a **watch service** that regenerates docs when supported files change.
- Downloads and starts the local AI model binary used for inference.

---

## Prerequisites

- Node.js 18+
- A Unix-like shell (for `chmod`)
- Enough free disk space for the model download (several GB)

---

## Installation

```bash
git clone <repository-url>
cd <repository-directory>
```

---

## Quick start

1. Download the model:

```bash
node thoth.js --download
```

2. Make the model executable (Linux/macOS):

```bash
chmod u+x m7q5
```

3. Start the local AI model service:

```bash
node thoth.js --start
```

The service runs in the background on `127.0.0.1:8080`.

---

## CLI usage

### Generate docs for one file

```bash
node thoth.js <path_to_file>
```

This prints generated Markdown to the terminal.

### Generate docs for a directory

```bash
node thoth.js --directory <path_to_directory>
```

For each supported source file, Thoth writes Markdown to:

```text
<path_to_directory>/docs/<relative_path>.md
```

Example: `src/app.js` → `docs/src/app.md`

### Run watcher service

```bash
node thoth.js --service <path_to_directory>
```

The watcher continuously updates docs when supported files change.

### Show help

```bash
node thoth.js --help
```

---

## Build standalone binaries

```bash
npx pkg thoth.js -t node18-x64-linux
npx pkg thoth.js -t node18-x64-windows
npx pkg thoth.js -t node18-x64-macos
npx pkg thoth.js -t node18-arm64-macos
npx pkg thoth.js -t node18-arm64-linux
```

Outputs include `thoth` (Linux/macOS) or `thoth.exe` (Windows).

---

## Troubleshooting

- **Connection errors to `127.0.0.1:8080`**
  - Make sure you started the service with `node thoth.js --start`.
- **`m7q5: Permission denied`**
  - Run `chmod u+x m7q5` and try again.
- **Large model download seems slow**
  - This is expected; retries/fallback logic is built into `--download`.

---

## License

Licensed under Apache 2.0. See [LICENSE](LICENSE).
