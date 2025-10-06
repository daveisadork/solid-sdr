package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/daveisadork/flex-bridge/internal/core"
	"github.com/daveisadork/flex-bridge/internal/discovery"
	"github.com/daveisadork/flex-bridge/internal/radio"
	"github.com/daveisadork/flex-bridge/internal/rtc"
	"github.com/pion/webrtc/v4"
)

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	staticDir := flag.String("static", "", "directory to serve built UI (optional)")
	discPort := flag.Int("discovery-port", 4992, "UDP discovery port")
	flag.Parse()

	// Discovery service (long-lived, shared)
	disco := discovery.New(discovery.Options{Port: *discPort})
	go func() {
		if err := disco.Run(context.Background()); err != nil {
			log.Printf("discovery terminated: %v", err)
		}
	}()

	sessions := core.NewSessionManager()

	rtcServer := rtc.New(sessions, []webrtc.ICEServer{
		{URLs: []string{"stun:stun.l.google.com:19302"}},
	})

	wsHandler := radio.NewWSHandler(sessions, rtcServer)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws/discovery", disco.WSHandler)
	mux.Handle("/ws/radio", wsHandler)
	mux.HandleFunc("/rtc/offer", rtcServer.OfferHandler)

	// Optional static UI
	if *staticDir != "" {
		mux.Handle("/", http.FileServer(http.Dir(*staticDir)))
	}

	srv := &http.Server{
		Addr:              ":8080",
		Handler:           withCOI(withCORS(mux)),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("listening on %s", *addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt)
	<-sig
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

// withCOI adds COOP/COEP/CORP so SharedArrayBuffer works.
// Enable this in dev; be aware COEP requires all cross-origin
// subresources to be CORS-enabled or to send CORP: cross-origin.
func withCOI(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
