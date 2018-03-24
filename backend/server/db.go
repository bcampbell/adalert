package server

import (
	"database/sql"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
	//	"log"
	//	"os"
	"time"
)

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

type Page struct {
	ID           int
	CanonicalURL string
	Title        string
	Created      time.Time
	Warns        int
	Disputes     int
}

func (st *Store) InfoForURL(url string) (*Page, error) {
	var pageID int
	err := st.db.QueryRow(`SELECT page_id FROM url WHERE url=?`, url).Scan(&pageID)
	if err == sql.ErrNoRows {
		return nil, nil // not in db, nothing to return
	}
	if err != nil {
		return nil, err
	}

	inf := &Page{}

	// it's in the db, so look it up
	err = st.db.QueryRow(`SELECT id,canonical_url,title,created FROM page WHERE id=?`, pageID).Scan(&inf.ID, &inf.CanonicalURL, &inf.Title, &inf.Created)
	if err != nil {
		return nil, err
	}

	// count the warnings
	err = st.db.QueryRow(`SELECT count(*) FROM warning WHERE page_id=?`, pageID).Scan(&inf.Warns)
	if err != nil {
		return nil, err
	}

	return inf, nil
}
