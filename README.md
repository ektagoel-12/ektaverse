# EktaVerse  [Have a look](https://ektaverse.vercel.app/)
**A portfolio you can play.** EktaVerse is Ekta Goel's portfolio as a 16-bit pixel-art platformer. Ekta graduates, throws her cap, and drives through her career one level at a time. Along the way she picks up experience, fixes bugs and tells her story in her own words. It was built for the Wispr Flow India Growth Team challenge.



https://github.com/user-attachments/assets/b524e11d-bcd0-47fe-b8d0-c8ee7ce5c24b


## Ways in

The home page offers five ways to explore:

- **Play the game:** four short levels, Intel Campus → Zeta Tech Park → Creative Lane → Rush Hour.
- **Watch it play:** a self-playing walkthrough. Press any key or tap to take the wheel.
- **60-second version:** just the story, chapter by chapter, with no platforming.
- **Chapter map:** jump straight to any level. It's also on the 🗺 button in the game, and it has a Home button that brings you back here.
- **Resume (PDF):** the classic one-pager.

## What's inside

- **Opening scene:** Ekta walks out of college with her Integrated B.Tech + M.Tech in Computer Science and throws her graduation cap.
- **Experience mushrooms:** one per level. Each one makes Ekta grow and shows what she learned there.
- **Gates:** levels 1–3 end with her walking into a building (INTEL, ZETA, STUDIO).
- **Hurdle cards:** when a bug hits her, a card shows a real problem she faced at work and how she solved it.
- **Checkpoints:** each one opens a chapter of her story, with subtitles and optional voice clips.
- **Project billboard:** her projects, with links to the code.
- **Ask Ekta:** a chat in the corner that answers questions about her work from answers she wrote herself, and points to email or LinkedIn for anything else.
- **Captions:** turn them on with the **CC** button or the **C** key, so the game works with the sound off.
- **Home page:** a pixel-art Ekta, drawn from her photo, waves hello while a terminal line types out real numbers from her resume.

All the art, music and sound effects are generated in code. There are no image or music files, and no build step.

## Controls

| Key | Action |
|---|---|
| ← → | Move |
| Space | Jump |
| H | Honk |
| M | Mute |
| C | Captions |

On phones, the on-screen buttons do the same.

## Run it locally

You only need Python 3. There's no npm and no build step.

```bash
ADMIN_PASSWORD=pick-a-password python3 server.py
```

Then open:

- http://localhost:8000 to play.
- http://localhost:8000/admin.html to edit the content. Saving asks for the password above.

## Edit the content

Everything the game says lives in [`data/content.json`](data/content.json): profile links, dialog subtitles, level names, hurdle cards, projects, chat answers and captions. You can edit it on the admin page, which can also upload voice clips and the resume. Changes show up on the next page load, with no rebuild.

**Voice clips:** put recordings in `audio/` using the names listed in [`audio/README.txt`](audio/README.txt). Scripts for the hurdle clips are in [`audio/HURDLE_SCRIPTS.md`](audio/HURDLE_SCRIPTS.md). If a clip is missing, the game shows the subtitles on their own.

## Ask Ekta (chat)

By default the chat is free and needs no server:

- **How it answers:** it matches keywords against `chat.answers` in `data/content.json`, and `{email}` and `{linkedin}` are filled in automatically.
- **Anything else:** it gets the `chat.fallback` reply, which gives Ekta's email and LinkedIn.

**Optional AI mode:**

1. Install the Anthropic SDK:

   ```bash
   python3 -m pip install anthropic
   ```

2. Set `chat.mode` to `"ai"` in `data/content.json`.
3. Start `server.py` with an `ANTHROPIC_API_KEY` set.

Typed questions then go to [`chat.py`](chat.py), and the written answers stay as the fallback.

## Deploy

- **Vercel (the live site):** import this repo at [vercel.com/new](https://vercel.com/new) and keep the defaults. `vercel.json` serves it as a static site with no build step, and `.vercelignore` leaves out the Python server and the admin page. Every push to `main` redeploys it. To change the content, edit `data/content.json` and push.
- **Other static hosts (GitHub Pages, Netlify):** publish the folder as it is. The game reads `data/content.json` directly. The admin page can't save on a static host, so edit the JSON and commit it instead.
- **With live editing (Render, Railway, Fly.io, any VPS):** run `server.py` with `HOST=0.0.0.0`, `PORT` and `ADMIN_PASSWORD` set. Use a host with a persistent disk, because saves are written to `data/content.json`.

## Project structure

| Path | What it does |
|---|---|
| `index.html` | The page: home screen, HUD, dialogs, chat |
| `js/game.js` | Phaser scenes and game flow: graduation intro, levels, walkthrough autopilot, 60-second version, victory, menus |
| `js/levels.js` | Level layouts: platforms, potholes, bugs, chai, checkpoints, gates |
| `js/art.js` | All pixel art, drawn in code: Ekta, the home-page portrait, bugs, vehicles, tiles, backgrounds |
| `js/audio.js` | Chiptune music, sound effects and voice clips |
| `js/ui.js` | Home page animation, dialogs, HUD, hurdle cards, billboard, chapter map, victory screen |
| `js/chat.js` | The Ask Ekta chat box |
| `js/content.js` | Loads the content from the server, or from `data/content.json` |
| `css/style.css` | All styles |
| `server.py` | Small Python server: static files, content API, password-checked saving and uploads |
| `chat.py` | Optional AI mode for Ask Ekta |
| `admin.html`, `js/admin.js` | The content editor |
| `data/content.json` | Every piece of text, link and setting |
| `resume/` | The resume PDF |

## Built with

[Phaser 3](https://phaser.io/) (loaded from a CDN), plain JavaScript, CSS and a Python standard-library server.

## Contact

**Ekta Goel**, software engineer in Bengaluru.

- [LinkedIn](https://www.linkedin.com/in/ektagoel12/)
- [GitHub](https://github.com/ektagoel-12)
