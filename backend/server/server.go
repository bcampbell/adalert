package server

import (
	"context"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	//	"strings"
	"encoding/json"
	"time"
)

type Server struct {
	store *Store
}

func Run() error {
	listenAddr := ":4000"

	srv, err := newServer()
	if err != nil {
		return err
	}
	defer srv.Close()

	router := http.NewServeMux()
	router.HandleFunc("/api/lookup", func(w http.ResponseWriter, req *http.Request) {
		srv.lookupHandler(w, req)
	})
	router.HandleFunc("/api/report", func(w http.ResponseWriter, req *http.Request) {
		srv.reportHandler(w, req)
	})
	router.HandleFunc("/browse", func(w http.ResponseWriter, req *http.Request) {
		srv.browseHandler(w, req)
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

func (src *Server) Emit500(w http.ResponseWriter, req *http.Request, err error) {
	msg := fmt.Sprintf("500 Internal Server Error\n\n(%s)\n", err)
	http.Error(w, msg, http.StatusInternalServerError)
	fmt.Fprintf(os.Stderr, "ERR: %s\n", err)
}

func (srv *Server) lookupHandler(w http.ResponseWriter, req *http.Request) {

	q := req.URL.Query()
	u := q.Get("u")
	h := q.Get("h")

	fmt.Printf("Lookup: %s\n", u)

	if h == "" && u != "" {
		h = HashURL(u)
	}

	inf, err := srv.store.PageInfoByHash(h)
	if err != nil {
		srv.Emit500(w, req, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if inf == nil {
		return
	}

	enc := json.NewEncoder(w)
	err = enc.Encode(inf)
	if err != nil {
		srv.Emit500(w, req, err)
		return
	}
}

func (srv *Server) reportHandler(w http.ResponseWriter, req *http.Request) {

	u := req.FormValue("u")
	title := req.FormValue("t")

	fmt.Printf("report: %s %s\n", u, title)

	err := srv.store.Report([]string{u}, title, "sponsored", 1)
	if err != nil {
		srv.Emit500(w, req, err)
		return
	}
	// TODO: return updated pageinfo
}

func (srv *Server) browseHandler(w http.ResponseWriter, req *http.Request) {
	q := req.URL.Query()
	offset, err := strconv.Atoi(q.Get("o"))

	limit := 100
	pages, err := srv.store.Query(limit, offset)
	if err != nil {
		srv.Emit500(w, req, err)
		return
	}
	/*
		const (
			master  = `Names:{{block "list" .}}{{"\n"}}{{range .}}{{println "-" .}}{{end}}{{end}}`
			overlay = `{{define "list"}} {{join . ", "}}{{end}} `
		)
		var (
			funcs     = template.FuncMap{"join": strings.Join}
			guardians = []string{"Gamora", "Groot", "Nebula", "Rocket", "Star-Lord"}
		)
	*/

	tmplTxt := `<!DOCTYPE html>
<html>
  <body>
    <table>
      <thead>
	    <tr>
          <th>Title</th>
          <th>URL</th>
          <th>Added</th>
        </tr>
      </thead>
      <tbody>
        {{ range .pages }}
        <tr>
          <td>{{.Title}}</td>
          <td><a href="{{.CanonicalURL}}">{{.CanonicalURL}}</a></td>
          <td>{{.Created}}</td>
        </tr>
        {{ end }}
      </tbody>
    </table>
  </body>
</html>
`

	dat := map[string]interface{}{
		"pages": pages,
	}

	tmpl, err := template.New("").Parse(tmplTxt)
	if err != nil {
		srv.Emit500(w, req, err)
		return
	}
	err = tmpl.Execute(w, dat)
	if err != nil {
		srv.Emit500(w, req, err)
		return
	}

}
