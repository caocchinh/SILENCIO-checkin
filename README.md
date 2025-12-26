<div align="center">
  <img src="https://github.com/caocchinh/photospark/blob/master/client/public/vteam-logo.webp?raw=true" alt="VTEAK Logo" width="167"/>
  <p>
    <strong>Silencio Check-in System</strong>
  </p>
  <p>
    <strong>The check-in system for Vinschool Central Park Student Council's Silencio Event</strong>
  </p>
  <p style="margin-top: 10px;">
    <a href="#-features">Features</a> •
    <a href="#️-tech-stack">Tech Stack</a> •
    <a href="#-getting-started">Getting Started</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
    <img src="https://img.shields.io/badge/status-production-green.svg" alt="Status" />
  </p>
  
  <p>
    <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js 16" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind CSS 4" />
    <img src="https://img.shields.io/badge/Ably-Realtime-FF5416?logo=ably&logoColor=white" alt="Ably" />
    <img src="https://img.shields.io/badge/Neon-PostgreSQL-4A9EFF?logo=postgresql&logoColor=white" alt="Neon PostgreSQL" />
    <img src="https://img.shields.io/badge/Railway-0B0D0E?logo=railway&logoColor=white" alt="Railway" />
  </p>
</div>

---

## 📖 Introduction

**Silencio Check-in** is the specialized platform for managing entry and flow at the Silencio Halloween event. Unlike traditional ticketing systems, it integrates entrance validation with a complex **Virtual Queue Management System** for Haunted House attractions, ensuring a smooth experience for hundreds of attendees.

The system comprises two main components:

1.  **Next.js Web Application**: Staff dashboard for check-ins, queue management, and admin controls.
2.  **Standalone Worker**: A high-performance Node.js service handling real-time WebSocket connections for instant QR scanning and queue updates.

## 📸 Footage of Silencio Check-in System in action

<div align="center">
  <a href="https://www.youtube.com/watch?v=b8yXIbeToPo" target="_blank">
    <img src="https://img.youtube.com/vi/b8yXIbeToPo/maxresdefault.jpg" alt="Watch the Demo Video" width="100%" style="border-radius: 10px; margin-bottom: 10px;" />
  </a>
</div>

<img src="https://github.com/caocchinh/SILENCIO-checkin/blob/master/public/assets/github/proof.webp?raw=true" alt="400 students lined up and this system worked flawlessly" style="border-radius: 10px; margin-bottom: 10px; margin-top: 10px; width: 100%;" />

> **"473 students showed up and this system worked flawlessly."**

### ⚠️ The Challenge: Why this system exists?

High-stakes events with limited timeframes are unforgiving. Without this dedicated infrastructure, the event operations would face critical failure points:

- **The "Fake Ticket" Risk**: With simple paper tickets or static lists, preventing double-entry or fake tickets is a logistical nightmare.
  - _Solution_: **Race-Condition Proof Verification** instantly locks the ticket record in the database upon scan. This blocks **fraudulent check-in attempts** immediately, ensuring every entry is unique.
- **The Efficiency Bottleneck**: A slow traditional check-in process using Spreadsheet lookup for 400+ students leads to dangerous overcrowding and delays.
  - _Solution_: **High-Performance WebSocket Worker** processes scans in real-time, enabling **faster check-in times** (under 20s per student) to keep the line moving smoothly.
- **The "Wrong Bracelet" Confusion**: Staff need to quickly identify which bracelet to give each attendee in a chaotic environment.
  - _Solution_: **Distinct Visual Cues** provides large, color-coded instructions on screen, offering **good visuals for staff to collect the right bracelet** without hesitation.

## ✨ Features

### 🎫 Fast Check-in System

- **QR Code Scanning**: Instant validation of student tickets using specialized scanners or mobile devices.
- **Real-time Feedback**: Immediate visual and audio feedback via WebSocket connection.
- **Race Condition Prevention**: Database-level locking to prevent double entry.

<img src="https://github.com/caocchinh/SILENCIO-checkin/blob/master/public/assets/github/admin1.webp?raw=true" alt="400 students lined up and this system worked flawlessly" style="border-radius: 10px; margin-bottom: 10px; margin-top: 10px; width: 100%;" />
<img src="https://github.com/caocchinh/SILENCIO-checkin/blob/master/public/assets/github/admin3.webp?raw=true" alt="400 students lined up and this system worked flawlessly" style="border-radius: 10px; margin-bottom: 10px; margin-top: 10px; width: 100%;" />

### 🛡️ Security & Access Control

- **Staff Verification**: PIN-based authentication for sensitive staff actions.
  <img src="https://github.com/caocchinh/SILENCIO-checkin/blob/master/public/assets/github/lock.webp?raw=true" alt="400 students lined up and this system worked flawlessly" style="border-radius: 10px; margin-bottom: 10px; margin-top: 10px; width: 100%;" />

- **Role-Based Access**: Strict separation of student and staff capabilities.
  <img src="https://github.com/caocchinh/SILENCIO-checkin/blob/master/public/assets/github/user1.webp?raw=true" alt="400 students lined up and this system worked flawlessly" style="border-radius: 10px; margin-bottom: 10px; margin-top: 10px; width: 100%;" />
  <img src="https://github.com/caocchinh/SILENCIO-checkin/blob/master/public/assets/github/user2.webp?raw=true" alt="400 students lined up and this system worked flawlessly" style="border-radius: 10px; margin-bottom: 10px; margin-top: 10px; width: 100%;" />

### ⚡ Architecture & Performance

- **Standalone Ably Worker**: dedicated process for handling high-concurrency real-time events, decoupling check-in logic from the main web server.
- **Neon Serverless Postgres**: Auto-scaling database handling thousands of concurrent read/writes.
- **Edge-Ready**: Optimized for deployment on edge networks with distributed real-time messaging.

## 🛠️ Tech Stack

### Core

- **[Next.js 16](https://nextjs.org/)** - App Router & Turbopack.
- **[React 19](https://react.dev/)** - Latest concurrent features.
- **[TypeScript](https://www.typescriptlang.org/)** - Strict type safety.

### Real-time & Data

- **[Ably](https://ably.com/)** - WebSocket infrastructure for sub-millisecond updates.
- **[Neon PostgreSQL](https://neon.tech/)** - Serverless database.
- **[Drizzle ORM](https://orm.drizzle.team/)** - Database access.
- **[Better Auth](https://www.better-auth.com/)** - Secure authentication.

### ☁️ Infrastructure

- **[Railway](https://railway.app/)** - Production deployment for Web and Worker.

### UI / UX

- **[Tailwind CSS 4](https://tailwindcss.com/)** - Next-gen styling engine.
- **[Radix UI](https://www.radix-ui.com/)** - Accessible primitives.
- **[Framer Motion](https://motion.dev/)** - Smooth interactions.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Neon PostgreSQL Database
- Ably Account for Realtime Messaging

### Installation

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/vteam/silencio-checkin.git
    cd silencio-checkin
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    # Install worker dependencies
    npm run worker:install
    ```

3.  **Environment Setup**:
    Copy the `.env` example and configure:

    ```bash
    cp .env.example .env
    ```

    _Required: `DATABASE_URL`, `ABLY_API_KEY`, `BETTER_AUTH_SECRET`_

4.  **Run Development Environment**:

    Start the Next.js app:

    ```bash
    npm run dev
    ```

    In a separate terminal, start the Real-time Worker:

    ```bash
    npm run worker:dev
    ```

---

<div align="center">
  <p>Developed with ❤️ by Cao Cự Chính</p>
</div>
