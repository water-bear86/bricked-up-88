# Bricked Up! '88

Retro breakout cabinet built with Vite and React. Scores are stored locally in the browser for now, behind an async leaderboard service that can be swapped for a hosted backend later.

## Run locally

Prerequisite: Node.js

1. Install dependencies:
   `npm install`
2. Start the app:
   `npm run dev`

## Build the portable web object

1. Build the app:
   `npm run build`
2. Ship the entire `dist/` folder.
3. Embed it with `dist/bricked-up-88.js`:

```html
<script type="module" src="./bricked-up-88.js"></script>
<bricked-up-88></bricked-up-88>
```

Open `dist/embed-demo.html` to see the wrapper in action.
