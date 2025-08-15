# DoujinDesk

**DoujinDesk** is a comprehensive Progressive Web Application (PWA) designed for doujin and comic convention management. Built with modern web technologies, it provides a complete solution for managing conventions with support for 35K+ booths, 750K+ attendees, and offline-first architecture.

## 🚀 Features

### Core Management
- **Dashboard**: Real-time statistics and role-based access control
- **Circle Management**: Application processing, directory management, multi-currency support
- **Booth Allocation**: Interactive floor plans with custom booth visualization using React Leaflet
- **Ticketing System**: Multi-tier pricing, QR/RFID generation, and validation
- **Financial Management**: Revenue tracking, payment processing, and reporting
- **Staff Coordination**: Role management, task assignment, and communication

### User Experience
- **Event Guide**: Interactive maps, catalogs, and schedules
- **Notification Center**: Push notifications and real-time alerts
- **PWA Features**: Service workers, offline synchronization, responsive design
- **Multi-language Support**: English, Japanese, Indonesian
- **Multi-currency**: IDR/USD support

### Technical Features
- **Offline-first Architecture**: Works without internet connectivity
- **Real-time Updates**: Live attendance tracking, queue management
- **Security**: End-to-end encryption, GDPR compliance, role-based access
- **Scalability**: Handles large-scale conventions with thousands of participants

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **shadcn/ui** + **Tailwind CSS** for modern UI components
- **Lucide React** for consistent iconography
- **React Router** for client-side routing

### State Management & Data
- **Zustand** with persistence for state management
- **IndexedDB** + **Dexie.js** for offline data storage
- **Workbox** for service worker management

### Backend & Services
- **Supabase** for PostgreSQL database, authentication, and storage
- **Leaflet.js** for interactive floor plan mapping

### Development Tools
- **TypeScript** for type safety
- **ESLint** for code quality
- **PostCSS** for CSS processing
- **PWA** capabilities with manifest and service workers

## 📁 Project Structure

```
doujindesk/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── Footer.tsx      # Navigation footer
│   │   └── ...
│   ├── pages/              # Page components
│   │   ├── Home.tsx
│   │   ├── Dashboard.tsx
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   ├── assets/             # Static assets
│   │   └── fonts/          # Font files
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Application entry point
├── supabase/               # Supabase configuration
├── public/                 # Public assets
├── docs/                   # Documentation
└── ...
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (recommended: 24.4.1)
- npm or pnpm package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd doujindesk
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Run TypeScript type checking
- `npm run lint` - Run ESLint

## 🌐 Deployment

The application is optimized for deployment on modern hosting platforms:

### Vercel (Recommended)
1. Connect your repository to Vercel
2. Configure environment variables
3. Deploy automatically on push

### Other Platforms
- **Netlify**: Configure build command as `npm run build`
- **Firebase Hosting**: Use `npm run build` and deploy `dist/` folder
- **Static Hosting**: Deploy the `dist/` folder after running `npm run build`

## 🔧 Configuration

### Supabase Setup
1. Create a new Supabase project
2. Configure authentication providers
3. Set up database tables and RLS policies
4. Add environment variables to your deployment

### PWA Configuration
The application includes PWA capabilities:
- Service worker for offline functionality
- Web app manifest for installation
- Responsive design for mobile devices

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the `docs/` folder
- Review the component documentation in `src/components/`

---

**DoujinDesk** - Empowering convention organizers with modern, scalable, and user-friendly management tools.
