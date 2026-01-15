# 🤖 Centralized GitHub Discord Bot

This repository hosts the centralized logic for Discord notifications across our organization. Instead of configuring a bot for every single repository, we use a **Reusable Workflow**.

## Setup for your repository

### Step 1: Copy the configuration
1.  Go to the **[templates/](./templates/)** folder in this repository.
2.  Copy the content of **`discord-notify.yml`**.
3.  In your project repository, create a file at:
    `.github/workflows/discord-notify.yml`
4.  Paste the content and save.

### Step 2: Verify Permissions (One-time setup)
Ensure this central repository (`github-webhook-bot`) allows access to other repositories:
* Go to **Settings** -> **Actions** -> **General**.
* Scroll to **Access**.
* Ensure **"Accessible from repositories in the 'YOUR_ORG_NAME' organization"** is selected.

---

## 🔐 Configuration (Admins)

The bot relies on a single **Organization Secret**.

1.  Go to **Organization Settings** -> **Secrets and variables** -> **Actions**.
2.  Create a **New organization secret**:
    * **Name:** `DISCORD_REPORTING_BOT_WEBHOOK`
    * **Value:** `https://discord.com/api/webhooks/...` (Your Discord Webhook URL)
    * **Access:** "All repositories".

---

## 🛠️ Development

If you want to change the message format, colors, or logic, you only need to edit this repository.

### Project Structure
* `src/index.js` - **Main Logic.** All the JavaScript code that generates Discord embeds resides here.
* `.github/workflows/reusable-bot.yml` - **The Workflow.** Defines the GitHub Action that other repos call.
* `templates/` - **Boilerplate.** Ready-to-use YAML files for other teams.

### Local Setup
To edit the logic locally:

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Lint/Check:**
    The project uses `node-fetch` and standard Node.js libraries. Ensure you do not commit `node_modules`.

### How to deploy changes?
Just **push to the `main` branch**.
All repositories using the `@main` reference in their workflow will automatically start using the updated logic immediately.

---

## 📦 Dependencies
* `node-fetch`: For sending HTTP requests to Discord.
* `dotenv`: For local development variable management.