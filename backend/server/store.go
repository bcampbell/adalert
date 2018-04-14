package server

import (
	"database/sql"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
	//	"log"
	//	"os"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"
)

func HashURL(u string) string {
	bin := sha256.Sum256([]byte(u))
	return hex.EncodeToString(bin[:])
}

type Store struct {
	db *sql.DB
}

func NewStore(filename string) (*Store, error) {
	db, err := sql.Open("sqlite3", filename)
	if err != nil {
		return nil, err
	}

	st := &Store{}
	st.db = db
	err = st.initDB()
	if err != nil {
		return nil, err
	}
	return st, nil
}

func (st *Store) Close() {
	st.db.Close()
}

// create/upgrade db, if needed
func (st *Store) initDB() error {

	var err error

	ver, err := st.schemaVersion()
	if err != nil {
		return err
	}
	switch ver {
	case 0:
		// starting from scratch
		schema := `
CREATE TABLE url (
	id INTEGER PRIMARY KEY,
	url TEXT NOT NULL,
	hash TEXT NOT NULL,
	page_id INTEGER NOT NULL,
	created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY(page_id) REFERENCES page(id)
);

CREATE TABLE page (
	id INTEGER PRIMARY KEY,
	canonical_url TEXT NOT NULL,
	title TEXT NOT NULL,
	created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE warning (
	id INTEGER PRIMARY KEY,
	page_id INTEGER NOT NULL,
	kind TEXT NOT NULL,
	quant INT NOT NULL,
	created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY(page_id) REFERENCES page(id)
);


CREATE TABLE version (
	ver INTEGER NOT NULL );

INSERT INTO version (ver) VALUES (1);
`
		//		`CREATE INDEX article_tag_artid ON article_tag(article_id)`,
		//		`CREATE INDEX article_url_artid ON article_url(article_id)`,

		_, err = st.db.Exec(schema)
		if err != nil {
			return err
		}
		break
	case 1: // all good. this is what we're expecting
		break
	default:
		return fmt.Errorf("Bad db schema version (expected 1, got %d)", ver)
	}

	return nil
}

// fetch the scheme version (0=no version table)
func (st *Store) schemaVersion() (int, error) {
	var n string
	err := st.db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name='version';`).Scan(&n)
	if err == sql.ErrNoRows {
		return 0, nil // assume db is blank
	}
	if err != nil {
		return 0, err
	}

	var v int
	err = st.db.QueryRow(`SELECT MAX(ver) FROM version`).Scan(&v)
	if err != nil {
		return 0, err
	}

	return v, nil
}

type Warning struct {
	Kind       string `json:"kind"`
	For        int    `json:"for"`
	Against    int    `json:"against"`
	DefaultMsg string `json:"default_msg"`
}

type Page struct {
	ID           int64
	CanonicalURL string    `json:"canonical_url"`
	Title        string    `json:"title"`
	Created      time.Time `json:"created"`
	Warnings     []Warning `json:"warnings"`
}

// look up a page in the database by hashed url
// returns nil if no info found
func (st *Store) PageInfoByHash(hashed string) (*Page, error) {
	var pageID int64
	err := st.db.QueryRow(`SELECT page_id FROM url WHERE hash=?`, hashed).Scan(&pageID)
	if err == sql.ErrNoRows {
		return nil, nil // not in db, nothing to return
	}
	if err != nil {
		return nil, err
	}
	return st.pageInfo(pageID)
}

func (st *Store) pageInfo(pageID int64) (*Page, error) {

	inf := &Page{}

	// it's in the db, so look it up
	err := st.db.QueryRow(`SELECT id,canonical_url,title,created FROM page WHERE id=?`, pageID).Scan(&inf.ID, &inf.CanonicalURL, &inf.Title, &inf.Created)
	if err != nil {
		return nil, err
	}

	// count the warnings

	//	err = st.db.QueryRow(`SELECT count(*) FROM warning WHERE page_id=?`, pageID).Scan(&inf.Warns)
	if err != nil {
		return nil, err
	}

	// collate the warnings
	q := `SELECT count(*) as cnt, kind,quant FROM warning WHERE page_id=? GROUP BY page_id, kind, quant`
	rows, err := st.db.Query(q, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	warns := map[string]Warning{}
	for rows.Next() {
		var cnt int
		var kind string
		var quant int
		err := rows.Scan(&cnt, &kind, &quant)
		if err != nil {
			return nil, err
		}
		w, got := warns[kind]
		if !got {
			w.Kind = kind
			// TODO!
			if kind == "sponsored" {
				w.DefaultMsg = "Sponsored content"
			}
		}
		if quant < 0 {
			w.Against = cnt
		}
		if quant > 0 {
			w.For = cnt
		}
		warns[kind] = w
	}
	err = rows.Err()
	if err != nil {
		return nil, err
	}

	// return collated warnings as list
	inf.Warnings = []Warning{}
	for _, w := range warns {
		inf.Warnings = append(inf.Warnings, w)
	}

	return inf, nil
}

func (st *Store) findPageByURL(pageURLs []string) (int64, error) {
	hashes := make([]string, len(pageURLs))

	for i := 0; i < len(pageURLs); i++ {
		hashes[i] = HashURL(pageURLs[i])
	}
	return st.findPageByHash(hashes)
}

func (st *Store) findPageByHash(pageHashes []string) (int64, error) {
	placeholders := make([]string, len(pageHashes))
	params := make([]interface{}, len(pageHashes))
	for i := 0; i < len(pageHashes); i++ {
		placeholders[i] = "?"
		params[i] = pageHashes[i]
	}

	q := `SELECT page_id FROM url WHERE hash IN (` + strings.Join(placeholders, ",") + `)`
	var pageID int64
	err := st.db.QueryRow(q, params...).Scan(&pageID)

	// TODO: how to handle multiple pages with same URL?
	// (some stupid pages are always going to have google.com as a short url or something...)

	if err == sql.ErrNoRows {
		return 0, nil // not found in db
	}
	if err != nil {
		return 0, err
	}

	return pageID, nil
}

// first url should be canonical
func (st *Store) Report(pageURLs []string, pageTitle string, kind string, quant int) error {

	pageID, err := st.findPageByURL(pageURLs)
	if err != nil {
		return err
	}

	// TODO: should all be in a transaction...

	if pageID == 0 {
		// it's new - add a page entry

		q := `INSERT INTO page (canonical_url,title) VALUES (?,?)`

		result, err := st.db.Exec(q, pageURLs[0], pageTitle)
		if err != nil {
			return fmt.Errorf("%s (%s)", err, q)
		}
		pageID, err = result.LastInsertId()
		if err != nil {
			return err
		}

	}

	// add the report
	_, err = st.db.Exec(`INSERT INTO warning (page_id,kind,quant) VALUES (?,?,?)`,
		pageID, kind, quant)
	if err != nil {
		return fmt.Errorf("failed warning insert: %s", err)
	}

	// add any urls not already in system
	for _, u := range pageURLs {
		hashed := HashURL(u)
		var id int64
		err := st.db.QueryRow(`SELECT id FROM url WHERE hash=?`, hashed).Scan(&id)
		if err != nil {
			if err == sql.ErrNoRows {
				// it's new - add it
				_, err2 := st.db.Exec(`INSERT INTO url (page_id,url,hash) VALUES (?,?,?)`,
					pageID, u, hashed)
				if err2 != nil {
					return fmt.Errorf("failed url insert: %s", err)
				}
			} else {
				return fmt.Errorf("failed check for existing url: %s", err)
			}
		}
	}

	return nil
}

func (st *Store) Query(limit int, offset int) ([]*Page, error) {

	q := `SELECT id,canonical_url,title,created FROM page ORDER BY created DESC LIMIT ? OFFSET ?`

	rows, err := st.db.Query(q, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []*Page{}
	for rows.Next() {
		pg := Page{}
		err = rows.Scan(&pg.ID, &pg.CanonicalURL, &pg.Title, &pg.Created)
		if err != nil {
			return nil, err
		}
		out = append(out, &pg)
	}
	err = rows.Err()
	if err != nil {
		return nil, err
	}
	return out, nil
}
