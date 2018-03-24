package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"
)

type Server struct {
	store *Store
}

func Run() error {
	listenAddr := ":5000"

	srv, err := newServer()
	if err != nil {
		return err
	}
	defer srv.Close()

	router := http.NewServeMux()
	router.HandleFunc("/api/lookup/", func(w http.ResponseWriter, req *http.Request) {
		srv.lookupHandler(w, req)
	})

	s := &http.Server{
		Addr:    listenAddr,
		Handler: router,
		//	ErrorLog:     logger,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  15 * time.Second,
	}
	idleConnsClosed := make(chan struct{})
	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt)
		<-sigint

		log.Printf("shutdown requested...\n")
		// We received an interrupt signal, shut down.
		if err := s.Shutdown(context.Background()); err != nil {
			// Error from closing listeners, or context timeout:
			log.Printf("HTTP server Shutdown: %v", err)
		}
		close(idleConnsClosed)
	}()

	err = s.ListenAndServe()
	<-idleConnsClosed

	if err == http.ErrServerClosed {
		err = nil
	}
	return err
}

func newServer() (*Server, error) {

	var err error
	srv := &Server{}
	srv.store, err = NewStore("fook.db")
	if err != nil {
		return nil, err
	}
	return srv, nil
}

func (srv *Server) Close() {
	srv.store.Close()
}

func (srv *Server) lookupHandler(w http.ResponseWriter, req *http.Request) {

	q := req.URL.Query()
	u := q.Get("u")

	inf, err := srv.store.InfoForURL(u)
	if err != nil {
		fmt.Fprintf(w, "UHOH... %s\n", err)
		return
	}

	fmt.Fprintf(w, "result: %v\n", inf)
}
