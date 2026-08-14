# NoteZ — Git Workflow Guide 🚀

Welcome to the NoteZ codebase! This guide covers essential Git commands for pulling updates, committing changes, and pushing your code safely to GitHub.

---

## 📥 1. How to Get the Latest Code (Git Pull)

Before starting work or before pushing new changes, pull the latest changes from the main branch:

```bash
git pull origin main
```

> 💡 **Best Practice**: Run `git pull origin main` every time you begin coding to make sure you have the newest updates from your teammates.

---

## 📤 2. How to Save and Push Your Changes (Git Push)

Follow these 3 steps whenever you finish writing or fixing code:

### Step 1: Check your modified files

```bash
git status
```

### Step 2: Stage all modified files

```bash
git add .
```

### Step 3: Save your changes with a clear commit message

```bash
git commit -m "feat: describe your change here"
```

### Step 4: Push your commit to GitHub

```bash
git push origin main
```

---

## ⚡ Quick Reference Sheet

| Action | Command |
| :--- | :--- |
| **Get latest updates** | `git pull origin main` |
| **Check current status** | `git status` |
| **Stage all changes** | `git add .` |
| **Commit changes** | `git commit -m "your message"` |
| **Push to GitHub** | `git push origin main` |
| **View commit history** | `git log --oneline` |

---

## ⚠️ Important Rules for Pushing

1. **Never commit secrets or API keys**: Keep sensitive keys inside your local `.env` file (which is git-ignored).
2. **Pull before pushing**: If your push gets rejected, run `git pull origin main` first, resolve any conflicts, and then run `git push origin main`.
3. **Write clear commit messages**: Use short, descriptive messages like `feat: add exam timer` or `fix: sidebar responsive alignment`.

---

## 🛠 Local Setup & Development

Install dependencies:

```bash
npm install
```

Start local development server:

```bash
npm run dev
```

Build for production verification:

```bash
npm run build
```
