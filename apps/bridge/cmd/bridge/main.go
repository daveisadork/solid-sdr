package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/daveisadork/flex-bridge/internal/config"
	"github.com/daveisadork/flex-bridge/internal/discovery"
	"github.com/daveisadork/flex-bridge/internal/rtc"
	"github.com/daveisadork/flex-bridge/internal/static"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	// ---- Discovery ----
	disco := discovery.New(discovery.Options{Port: cfg.DiscoveryPort})

	go func() {
		err := disco.Run(context.Background())
		if err != nil {
			log.Printf("discovery terminated: %v", err)
		}
	}()

	// ---- RTC ----
	rtcServer := rtc.New(disco, rtc.Options{
		ICEPortStart: cfg.ICEPortStart,
		ICEPortEnd:   cfg.ICEPortEnd,
		STUN:         cfg.StunURLs,
		NAT1To1IPs:   cfg.NAT1To1IPs,
	})

	// ---- HTTP mux ----
	mux := http.NewServeMux()
	mux.Handle("/ws/signal", rtcServer)

	if cfg.StaticDir != "" {
		mux.Handle("/", http.FileServer(http.Dir(cfg.StaticDir)))
	} else if h := static.Handler(); h != nil {
		mux.Handle("/", h)
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("flex-bridge up"))
		})
	}

	handler := http.Handler(mux)
	if cfg.EnableCOI {
		handler = withCOI(handler)
	}

	if cfg.EnableCORS {
		handler = withCORS(handler)
	}

	addr := fmt.Sprintf(":%d", cfg.HTTPPort)
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("listening on %s", addr)

		err := srv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	// ---- graceful shutdown ----
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt)
	<-sig

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = srv.Shutdown(ctx)
}

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
