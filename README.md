# Simple Finances ![Simple Finances Dashboard Preview](public/favicon.svg)

Simple Finances is a clean, modern, and secure personal finance dashboard designed to give you a unified view of your financial health. Track your net worth, monitor your 30-day spending, and identify recurring subscriptions—all in one beautiful, single-page application.



## 🚀 Features

- **Unified Dashboard:** A 3-column layout providing a high-level summary and detailed breakdowns simultaneously.
- **Secure Integration:** Connects seamlessly with [SimpleFIN](https://bridge.simplefin.org/) using the secure setup token flow.
- **Net Worth Tracking:** Real-time calculation of assets vs. liabilities across all your connected accounts.
- **Smart Spending Analysis:** Automatically filters internal transfers to give you an accurate view of your actual 30-day spending.
- **Subscription Detection:** Identifies recurring costs and monthly commitments.
- **Single-Page Experience:** Optimized 100vh layout with independent scrollable panels for a fluid, app-like feel.
- **Demo Mode:** Explore the features instantly with realistic mock data using `?demo=true`.

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Vanilla CSS (Glassmorphism & Modern UI)
- **Icons:** Lucide React
- **Backend:** Netlify Serverless Functions (for production API proxying)

## 📦 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- A [SimpleFIN](https://bridge.simplefin.org/) account

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/devnamedjean/simple-finances.git
   cd simple-finances
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open in your browser:**
   Navigate to `http://localhost:5173`. You can also try demo mode at `http://localhost:5173/?demo=true`.

### 🌐 Deployment

This project is optimized for deployment on **Netlify**:

1. Push your code to a GitHub repository.
2. Connect the repository to Netlify.
3. The `netlify.toml` file will automatically configure the build command (`npm run build`), publish directory (`dist`), and serverless functions.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ✨ Acknowledgments

- Vibe Coded with the assistance of **Gemini CLI**.
- Powered by the **SimpleFIN Bridge API**.

---
*Created with ❤️ by devnamedjean*
