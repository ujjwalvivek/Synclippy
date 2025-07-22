# Synclippy

Universal clipboard synchronization across Windows, macOS, Linux, and web; built with Tauri, Go, and modern web technologies. (Planned)

## Current Status

### Project Structure

```bash
synclippy/
├── assets/         # Fonts and other static assets
├── backend/        # Go server and backend logic
│   ├── content/    # Media and content storage
├── frontend/       # HTML, CSS, JS for the web client
├── functions/      # Utility scripts/functions
├── logs/           # Log files
├── README.md
```

⚠️ **Project is in architectural transition phase**

The initial web-only approach has been **halted due to fundamental browser clipboard API limitations**. I'm pivoting to a hybrid native + web architecture for a truly functional cross-platform solution.

### What's Currently Here

- **Backend**: Go WebSocket server foundation (partially implemented). Handles media synchronization, note management, and API endpoints
- **Frontend**: Basic web interface (limited by browser APIs)
- **Architecture**: Initial web-only approach (being evolved)

## Installation & Development

### Prerequisites

```bash
# Clone the Repository
git clone https://github.com/ujjwalvivek/synclippy.git

# Current development (Go backend)
go mod download
```

### Start the Development Server

```bash
# Install Backend Dependencies
cd backend/
go mod tidy

# Run the Backend Server
go run server.go
#Serve the Backend Folder on Localhost
python -m http.server 8080

#Visit localhost:8080 in your browser
```

### Current Limitations

#### Browser Clipboard API Constraints

- Only supports `text/plain`, `text/html`, and `image/png`
- Requires explicit user interaction for every clipboard access
- No background clipboard monitoring possible
- Cross-origin restrictions prevent seamless sync
- Security sandboxing blocks rich clipboard experiences

#### Technical Debt

- Web-only architecture can't access native clipboard APIs
- No native system integration
- Limited to browser context clipboard operations
- Cannot monitor clipboard changes automatically

## Architecture Evolution

**Current**: Web Frontend ↔ Go Backend  
**Target**: Native Desktop Apps ↔ Go WebSocket Server ↔ Web Management Interface

### Planned Tech Stack

- **Desktop Apps**: Tauri (Rust + Web UI)
- **Backend**: Go with WebSocket (existing foundation)
- **Web Interface**: ReactJs for remote management
- **Mobile**: Native apps (Future)

## Why the Pivot?

Native desktop integration is **required** for:

- Real-time clipboard monitoring
- Rich content support (files, images, formatted text)
- Background operation without user interaction
- True cross-platform functionality
- Performance and reliability

## Vision & Roadmap

For the complete vision, technical analysis, and detailed roadmap, **read my blog post**: [From Web to Native: The Synclippy Architecture Pivot](https://ujjwalvivek.com/blog/proj_0005_the_synclippy.md)

### Key Features (Planned)

- ⚡ Real-time sync between devices
- 🔒 End-to-end encryption by default  
- 🏠 Local-first with optional cloud sync
- 📱 Cross-platform (Windows, macOS, Linux, mobile)
- 🎨 Modern web UI in native packaging
- 📋 Rich clipboard history with search

## Contributing

This project is in **active architectural redesign**. Any Architecture feedback and suggestions, Native app development expertise (Tauri/Rust), UI/UX design contributions are welcomed. Oh, and also, Security and encryption best practices - if anyone would be willing to share some knowledge in this realm.

## License

MIT License

---

**Status**: 🚧 Under heavy development - Architecture pivot in progress  

**Next Milestone**: Native desktop app MVP with basic clipboard sync

[Contact](mailto:hello@ujjwalvivek.com)
