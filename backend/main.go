package main

import (
	"fmt"
	"os"
	"semprini/od_sponsored_content/backend/server"
)

func main() {
	err := server.Run()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERR: %s\n", err)
		os.Exit(1)
	}
}
