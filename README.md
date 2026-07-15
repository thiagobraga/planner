<p align="center">
  <img src="app/public/images/bulletjournal-planner.png" alt="Planner" width="96">
</p>

<h1 align="center">Planner</h1>

<p align="center">
  Beautiful and easy-to-use Bullet Journal task management.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/React-149ECA?style=flat-square&logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/license-MIT-3DA639?style=flat-square" alt="MIT License">
</p>

---

## About

Planner is a minimalist Bullet Journal-inspired task manager designed to help you organize your tasks with focus and clarity.

It supports daily planning, monthly organization, habit tracking, projects, tags and filters through a clean and distraction-free interface.

## Features

- Daily, Monthly and Habits views
- Projects, tags and filters
- Mark tasks as completed
- Move completed tasks to the end
- List and Kanban visualization
- Minimal and distraction-free interface
- Local-first task management
- Responsive desktop interface

## Tech Stack

![React](https://img.shields.io/badge/React-149ECA?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-000000?style=for-the-badge&logo=zustand&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-FF4154?style=for-the-badge&logo=react-query&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## Installation

### Requirements

- Node.js 20 or newer
- Docker and Docker Compose

### Setup

```bash
cp .env.example .env

# Installs deps, runs migrations, starts api (4000) + app (5173) + Postgres + Redis
docker compose up -d
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```text
planner/
├── api/
│   ├── src/
│   │   ├── index.ts
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── db/
│   └── package.json
├── app/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── api/
│   │   └── utils/
│   └── package.json
├── docs/
└── compose.yml
```

## Architecture

See [DESIGN.md](./DESIGN.md) for detailed design system specification, component library, and visual guidelines. Data flow, service architecture, and real-time sync mechanisms documented in [CLAUDE.md](./CLAUDE.md).

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a branch:

```bash
git checkout -b feature/my-feature
```

3. Commit your changes:

```bash
git commit -m "feat: add my feature"
```

4. Push the branch:

```bash
git push origin feature/my-feature
```

5. Open a pull request.

## License

This project is licensed under the [MIT License](./LICENSE).
