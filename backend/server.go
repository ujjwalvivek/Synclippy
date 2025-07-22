package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/gorilla/websocket"
)

const noteFile = "note.txt"

var (
	clients     = make(map[*websocket.Conn]bool)
	clientsMu   sync.Mutex
	noteContent string
)

func main() {
	http.HandleFunc("/api/note", noteHandler)
	http.HandleFunc("/ws", wsHandler)
	http.Handle("/", http.FileServer(http.Dir("../frontend"))) // Serves static files
	// Load note content at startup
	if data, err := ioutil.ReadFile(noteFile); err == nil {
		noteContent = string(data)
	}
	log.Println("Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func noteHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	switch r.Method {
	case http.MethodGet:
		data, err := ioutil.ReadFile(noteFile)
		if err != nil && !os.IsNotExist(err) {
			http.Error(w, "Failed to read note", 500)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"content": string(data)})
	case http.MethodPost:
		var req struct {
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", 400)
			return
		}
		if err := ioutil.WriteFile(noteFile, []byte(req.Content), 0644); err != nil {
			http.Error(w, "Failed to save note", 500)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	clientsMu.Lock()
	clients[conn] = true
	clientsMu.Unlock()
	// Send current note and no cursor on connect
	conn.WriteJSON(map[string]interface{}{"content": noteContent, "cursor": nil})
	for {
		var rawMsg map[string]interface{}
		if err := conn.ReadJSON(&rawMsg); err != nil {
			break
		}
		// Clipboard sync message
		if clip, ok := rawMsg["clipboard"].(string); ok {
			broadcastClipboard(clip, conn)
			continue
		}
		// Note sync message (legacy)
		var msg struct {
			Content string `json:"content"`
			Cursor  *int   `json:"cursor"`
		}
		msg.Content, _ = rawMsg["content"].(string)
		if c, ok := rawMsg["cursor"].(float64); ok {
			ci := int(c)
			msg.Cursor = &ci
		}
		noteContent = msg.Content
		ioutil.WriteFile(noteFile, []byte(noteContent), 0644)
		broadcastNoteWithCursor(noteContent, msg.Cursor, conn)
	}
	clientsMu.Lock()
	delete(clients, conn)
	clientsMu.Unlock()
	conn.Close()
}

func broadcastNoteWithCursor(content string, cursor *int, except *websocket.Conn) {
	clientsMu.Lock()
	defer clientsMu.Unlock()
	for c := range clients {
		if c != except {
			c.WriteJSON(map[string]interface{}{"content": content, "cursor": cursor})
		}
	}
}

func broadcastClipboard(clip string, except *websocket.Conn) {
	clientsMu.Lock()
	defer clientsMu.Unlock()
	for c := range clients {
		if c != except {
			c.WriteJSON(map[string]interface{}{"clipboard": clip})
		}
	}
}
