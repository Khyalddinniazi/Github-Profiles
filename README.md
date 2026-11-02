# 🔍 Profile Explorer

Explore any GitHub developer in seconds. Search a username to see their profile, best repositories and most-used languages, or put two developers side by side and compare them.

**🌐 Live demo:** [khyalddinniazi.github.io/Github-Profiles](https://khyalddinniazi.github.io/Github-Profiles/)

![Profile Explorer screenshot](screenshot.png)

## ✨ Features

- **Detailed profiles**: avatar, bio, location, company, website, X/Twitter, join date, followers and repo count
- **Repository cards**: description, language, stars, forks and when each repo was last updated
- **Sort and filter**: order repos by stars, recent activity or name, and filter by language
- **Language breakdown**: a colored bar showing which languages a developer uses most
- **Compare mode**: two developers side by side, with a 🏆 on the winner of each stat
- **Shareable links**: every search updates the URL (`?user=torvalds&vs=gaearon`), and back/forward navigation works
- **Recent searches**: your last 5 searches as one-click shortcuts
- **Dark and light theme**: follows your system setting and remembers your choice
- **Responsive and accessible**: works on phones, supports keyboard navigation and screen readers

## 🛠️ Built with

- **HTML, CSS, JavaScript (ES6+)**, with no frameworks, libraries or build step
- **[GitHub REST API](https://docs.github.com/en/rest)** for live profile and repository data
- **localStorage** to keep search history and theme preference
- **GitHub Pages** for hosting

## 🧠 Engineering highlights

- **XSS protection**: all user-provided text from the API is escaped before it is rendered
- **Race-condition handling**: a request counter makes sure only the latest search is rendered, even when an older response arrives late
- **Error handling**: clear messages for unknown users, network failures and API rate limits, including the time the limit resets
- **Efficient API usage**: profile and repo requests run in parallel, and repo data is cached in memory, so sorting and filtering never call the API again
- **Theme without flicker**: the theme is applied before the first paint using CSS custom properties

## 🚀 Run locally

```bash
git clone https://github.com/khyalddinniazi/Github-Profiles.git
cd Github-Profiles
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). You can also open `index.html` directly in your browser.

## ⚠️ Limitations

- The GitHub API allows **60 unauthenticated requests per hour** per IP address. Each search uses 2 requests, or 4 in compare mode.
- Up to 100 repositories are loaded per user.
- Language stats count repositories per language, not lines of code.
