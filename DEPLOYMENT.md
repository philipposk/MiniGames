# Deploying Bounce Ball to GitHub Pages

## Option 1: Automatic Deployment (Recommended)

The GitHub Actions workflow is already set up. You just need to:

1. **Push the workflow file** (if not already pushed):
   ```bash
   git push origin main
   ```
   Note: You may need a Personal Access Token with `workflow` scope, or push through GitHub Desktop/web interface.

2. **Enable GitHub Pages**:
   - Go to your repository: https://github.com/philipposk/MiniGames
   - Click **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - The workflow will automatically deploy when you push changes to the `bounce-ball/` folder

3. **Access your game**:
   - After deployment (usually takes 1-2 minutes), your game will be available at:
   - `https://philipposk.github.io/MiniGames/bounce-ball/`

## Option 2: Manual GitHub Pages Setup

If you prefer to set up GitHub Pages manually:

1. Go to **Settings** → **Pages** in your repository
2. Under **Source**, select **Deploy from a branch**
3. Select **main** branch and **/ (root)** folder
4. Click **Save**

Then create a simple redirect or serve the files directly.

## Verification

After deployment, check:
- ✅ Workflow runs successfully in **Actions** tab
- ✅ Game is accessible at the GitHub Pages URL
- ✅ All game files (index.html, game.js, styles.css) load correctly

## Troubleshooting

- If the workflow fails, check the **Actions** tab for error messages
- Ensure GitHub Pages is enabled in repository settings
- Wait 1-2 minutes after pushing for deployment to complete

